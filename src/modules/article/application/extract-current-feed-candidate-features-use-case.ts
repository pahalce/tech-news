import { type FeatureVocabularyConfig } from "../../feature/application/feature-vocabulary-config";
import { type CurrentFeedCandidate } from "../domain/current-feed-candidate";
import {
  createBodyFetchFailure,
  createFailedExtractionAttempt,
  createFeatureExtraction,
  parseFeatureExtractionState,
  type FeatureExtractionState,
} from "../domain/feature-extraction";

export type ExtractCurrentFeedCandidateFeaturesInput = {
  candidates: readonly CurrentFeedCandidate[];
  featureExtractionState: FeatureExtractionState;
  featureVocabulary: FeatureVocabularyConfig;
  now(): string;
  fetchArticleBody(candidate: CurrentFeedCandidate): Promise<{ body: string }>;
  extractArticleFeatures(input: {
    candidate: CurrentFeedCandidate;
    body: string;
  }): Promise<unknown>;
};

export type ExtractCurrentFeedCandidateFeaturesResult = {
  state: FeatureExtractionState;
};

export async function extractCurrentFeedCandidateFeatures(
  input: ExtractCurrentFeedCandidateFeaturesInput,
): Promise<ExtractCurrentFeedCandidateFeaturesResult> {
  const state = parseFeatureExtractionState(input.featureExtractionState);

  for (const candidate of input.candidates) {
    if (state.extractions.some((extraction) => extraction.articleId === candidate.articleId)) {
      continue;
    }

    let body: { body: string };
    try {
      body = await input.fetchArticleBody(candidate);
    } catch (error) {
      state.bodyFetchFailures.push(
        createBodyFetchFailure({
          articleId: candidate.articleId,
          failedAt: input.now(),
          message: errorMessage(error),
        }),
      );
      continue;
    }

    try {
      const llmOutput = await input.extractArticleFeatures({
        candidate,
        body: body.body,
      });

      state.extractions.push(
        createFeatureExtraction(
          {
            articleId: candidate.articleId,
            extractedAt: input.now(),
            llmOutput,
          },
          input.featureVocabulary,
        ),
      );
    } catch (error) {
      state.failedExtractionAttempts.push(
        createFailedExtractionAttempt({
          articleId: candidate.articleId,
          attemptedAt: input.now(),
          message: errorMessage(error),
        }),
      );
    }
  }

  return { state: parseFeatureExtractionState(state) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

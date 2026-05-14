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
    progress: FeatureExtractionProgress;
    featureVocabulary: FeatureVocabularyConfig;
  }): Promise<unknown>;
  onFeatureExtractionFailure?(input: {
    candidate: CurrentFeedCandidate;
    progress: FeatureExtractionProgress;
    message: string;
    llmResponse?: unknown;
  }): void;
};

export type FeatureExtractionProgress = {
  index: number;
  total: number;
};

export type ExtractCurrentFeedCandidateFeaturesResult = {
  state: FeatureExtractionState;
};

export async function extractCurrentFeedCandidateFeatures(
  input: ExtractCurrentFeedCandidateFeaturesInput,
): Promise<ExtractCurrentFeedCandidateFeaturesResult> {
  const state = parseFeatureExtractionState(input.featureExtractionState);
  const extractedArticleIds = new Set(state.extractions.map((extraction) => extraction.articleId));
  const targetCandidates = input.candidates.filter(
    (candidate) => !extractedArticleIds.has(candidate.articleId),
  );

  for (const [index, candidate] of targetCandidates.entries()) {
    const progress = {
      index: index + 1,
      total: targetCandidates.length,
    };
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

    let llmOutput: unknown;
    try {
      llmOutput = await input.extractArticleFeatures({
        candidate,
        body: body.body,
        progress,
        featureVocabulary: input.featureVocabulary,
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
      input.onFeatureExtractionFailure?.({
        candidate,
        progress,
        message: errorMessage(error),
        llmResponse: typeof llmOutput === "undefined" ? undefined : llmOutput,
      });
    }
  }

  return { state: parseFeatureExtractionState(state) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

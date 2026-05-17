import { type ArticleAuthor } from "src/features/digest/application/article-author";
import { type FeatureVocabularyConfig } from "src/domains/article/article-feature-vocabulary-config";
import { type CurrentFeedCandidate } from "src/features/digest/application/current-feed-candidate";
import {
  createBodyFetchFailure,
  createFailedExtractionAttempt,
  createFeatureExtraction,
  parseFeatureExtractionState,
  type FeatureExtractionState,
} from "src/domains/article/feature-extraction";

export type ExtractCurrentFeedCandidateFeaturesInput = {
  candidates: readonly CurrentFeedCandidate[];
  featureExtractionState: FeatureExtractionState;
  featureVocabulary: FeatureVocabularyConfig;
  now(): string;
  fetchArticleBody(
    candidate: CurrentFeedCandidate,
  ): Promise<{ body: string; author: ArticleAuthor | null }>;
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
    let fetchedArticle: { body: string; author: ArticleAuthor | null };
    try {
      fetchedArticle = await input.fetchArticleBody(candidate);
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
        body: fetchedArticle.body,
        progress,
        featureVocabulary: input.featureVocabulary,
      });

      state.extractions.push(
        createFeatureExtraction(
          {
            articleId: candidate.articleId,
            extractedAt: input.now(),
            llmOutput,
            author: fetchedArticle.author,
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

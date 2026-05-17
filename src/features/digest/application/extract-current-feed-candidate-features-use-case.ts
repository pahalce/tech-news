import { type ArticleAuthor } from "src/domains/article";
import { type FeatureVocabularyConfig } from "src/domains/article";
import { type CurrentFeedCandidate } from "src/domains/article";
import {
  addBodyFetchFailureToRegistry,
  addFailedExtractionAttemptToRegistry,
  addFeatureExtractionToRegistry,
  createBodyFetchFailure,
  createFailedExtractionAttempt,
  createFeatureExtraction,
  type ArticleExtractionRegistry,
} from "src/domains/article";

export type ExtractCurrentFeedCandidateFeaturesInput = {
  candidates: readonly CurrentFeedCandidate[];
  articleExtractionRegistry: ArticleExtractionRegistry;
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
  articleExtractionRegistry: ArticleExtractionRegistry;
};

export async function extractCurrentFeedCandidateFeatures(
  input: ExtractCurrentFeedCandidateFeaturesInput,
): Promise<ExtractCurrentFeedCandidateFeaturesResult> {
  let articleExtractionRegistry = input.articleExtractionRegistry;
  const extractedArticleIds = new Set(
    articleExtractionRegistry.extractions.map((extraction) => extraction.articleId),
  );
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
      articleExtractionRegistry = addBodyFetchFailureToRegistry(
        articleExtractionRegistry,
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

      articleExtractionRegistry = addFeatureExtractionToRegistry(
        articleExtractionRegistry,
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
      articleExtractionRegistry = addFailedExtractionAttemptToRegistry(
        articleExtractionRegistry,
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

  return {
    articleExtractionRegistry,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

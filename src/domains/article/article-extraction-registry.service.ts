import type {
  ArticleExtractionRegistry,
  BodyFetchFailure,
  FeatureExtraction,
  FailedExtractionAttempt,
} from "src/domains/article/feature-extraction";
import { parseArticleExtractionRegistry } from "src/domains/article/feature-extraction";
import type { ArticleFeatures } from "src/domains/article/article-features";
import type { CurrentFeedCandidate } from "src/domains/article/current-feed-candidate";

export type ReadableCurrentFeedCandidate = {
  candidate: CurrentFeedCandidate;
  articleFeatures: ArticleFeatures;
};

export function addFeatureExtractionToRegistry(
  registry: ArticleExtractionRegistry,
  extraction: FeatureExtraction,
): ArticleExtractionRegistry {
  return parseArticleExtractionRegistry({
    version: registry.version,
    extractions: [...registry.extractions, extraction],
    bodyFetchFailures: registry.bodyFetchFailures,
    failedExtractionAttempts: registry.failedExtractionAttempts,
  });
}

export function addBodyFetchFailureToRegistry(
  registry: ArticleExtractionRegistry,
  failure: BodyFetchFailure,
): ArticleExtractionRegistry {
  return parseArticleExtractionRegistry({
    version: registry.version,
    extractions: registry.extractions,
    bodyFetchFailures: [...registry.bodyFetchFailures, failure],
    failedExtractionAttempts: registry.failedExtractionAttempts,
  });
}

export function addFailedExtractionAttemptToRegistry(
  registry: ArticleExtractionRegistry,
  attempt: FailedExtractionAttempt,
): ArticleExtractionRegistry {
  return parseArticleExtractionRegistry({
    version: registry.version,
    extractions: registry.extractions,
    bodyFetchFailures: registry.bodyFetchFailures,
    failedExtractionAttempts: [...registry.failedExtractionAttempts, attempt],
  });
}

export function selectReadableCurrentFeedCandidatesFromRegistry(input: {
  currentFeedCandidates: readonly CurrentFeedCandidate[];
  articleExtractionRegistry: ArticleExtractionRegistry;
}): ReadableCurrentFeedCandidate[] {
  const extractionsByArticleId = new Map(
    input.articleExtractionRegistry.extractions.map((extraction) => [
      extraction.articleId,
      extraction,
    ]),
  );
  const readableCandidates: ReadableCurrentFeedCandidate[] = [];

  for (const candidate of input.currentFeedCandidates) {
    const extraction = extractionsByArticleId.get(candidate.articleId);

    if (!extraction?.readability.isReadable || extraction.articleFeatures === null) {
      continue;
    }

    readableCandidates.push({
      candidate: {
        ...candidate,
        feedIds: [...candidate.feedIds],
      },
      articleFeatures: extraction.articleFeatures,
    });
  }

  return readableCandidates;
}

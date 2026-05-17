import { type CurrentFeedCandidate } from "src/modules/article/application/current-feed-candidate";
import type { ArticleFeatures } from "src/modules/feature-extraction/domain/article-features";
import {
  parseFeatureExtractionState,
  type FeatureExtractionState,
} from "src/modules/feature-extraction/domain/feature-extraction";

export type SelectReadableCurrentFeedCandidatesInput = {
  currentFeedCandidates: readonly CurrentFeedCandidate[];
  featureExtractionState: FeatureExtractionState;
};

export type ReadableCurrentFeedCandidate = {
  candidate: CurrentFeedCandidate;
  articleFeatures: ArticleFeatures;
};

export type SelectReadableCurrentFeedCandidatesResult = {
  readableCandidates: ReadableCurrentFeedCandidate[];
};

export function selectReadableCurrentFeedCandidates(
  input: SelectReadableCurrentFeedCandidatesInput,
): SelectReadableCurrentFeedCandidatesResult {
  const featureExtractionState = parseFeatureExtractionState(input.featureExtractionState);
  const extractionsByArticleId = new Map(
    featureExtractionState.extractions.map((extraction) => [extraction.articleId, extraction]),
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

  return { readableCandidates };
}

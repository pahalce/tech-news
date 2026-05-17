import type {
  PublicationRecord,
  PublishedDigestRegistry,
  RecommendedArticle,
} from "src/domains/digest/publication-record";
import type {
  RecommendationContent,
  RecommendationContentHistory,
} from "src/domains/digest/recommendation-content";

export function appendRecommendationContentsToHistory(
  history: RecommendationContentHistory,
  recommendationContents: readonly RecommendationContent[],
): RecommendationContentHistory {
  return {
    version: history.version,
    recommendationContents: [...history.recommendationContents, ...recommendationContents],
  };
}

export function replacePublishedDigestRegistryEntries(input: {
  version: 1;
  publicationRecords: readonly PublicationRecord[];
  recommendedArticles: readonly RecommendedArticle[];
}): PublishedDigestRegistry {
  return {
    version: input.version,
    publicationRecords: [...input.publicationRecords],
    recommendedArticles: [...input.recommendedArticles],
  };
}

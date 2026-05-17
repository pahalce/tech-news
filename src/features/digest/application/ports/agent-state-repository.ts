import type {
  ArticleExtractionRegistryRepository,
  PreferenceProfileRepository,
  PreferenceSummaryHistoryRepository,
  PublishedDigestRegistryRepository,
  RecommendationContentHistoryRepository,
} from "src/shared/application/state-repositories";

export type DigestStateRepositories = {
  articleExtractionRegistry: ArticleExtractionRegistryRepository;
  preferenceProfile: PreferenceProfileRepository;
  preferenceSummaryHistory: PreferenceSummaryHistoryRepository;
  publishedDigestRegistry: PublishedDigestRegistryRepository;
  recommendationContentHistory: RecommendationContentHistoryRepository;
};

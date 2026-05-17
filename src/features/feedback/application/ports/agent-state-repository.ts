import type {
  ArticleExtractionRegistryRepository,
  PreferenceProfileRepository,
  PreferenceSummaryHistoryRepository,
  PublishedDigestRegistryRepository,
} from "src/shared/application/state-repositories";

export type FeedbackStateRepositories = {
  articleExtractionRegistry: ArticleExtractionRegistryRepository;
  preferenceProfile: PreferenceProfileRepository;
  preferenceSummaryHistory: PreferenceSummaryHistoryRepository;
  publishedDigestRegistry: PublishedDigestRegistryRepository;
};

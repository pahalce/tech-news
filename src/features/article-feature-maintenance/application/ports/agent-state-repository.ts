import type {
  ArticleExtractionRegistryRepository,
  ArticleFeatureSuggestionHistoryRepository,
  PublishedDigestRegistryRepository,
} from "src/shared/application/state-repositories";

export type ArticleFeatureMaintenanceStateRepositories = {
  articleExtractionRegistry: ArticleExtractionRegistryRepository;
  publishedDigestRegistry: PublishedDigestRegistryRepository;
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistoryRepository;
};

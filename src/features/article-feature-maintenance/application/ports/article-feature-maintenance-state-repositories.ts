import type {
  ArticleExtractionRegistry,
  ArticleFeatureSuggestionHistory,
} from "src/domains/article";
import type { PublishedDigestRegistry } from "src/domains/digest";

export type ArticleExtractionRegistryRepository = {
  load(): Promise<ArticleExtractionRegistry>;
  save(registry: ArticleExtractionRegistry): Promise<void>;
};

export type PublishedDigestRegistryRepository = {
  load(): Promise<PublishedDigestRegistry>;
  save(registry: PublishedDigestRegistry): Promise<void>;
};

export type ArticleFeatureSuggestionHistoryRepository = {
  load(): Promise<ArticleFeatureSuggestionHistory>;
  save(history: ArticleFeatureSuggestionHistory): Promise<void>;
};

export type ArticleFeatureMaintenanceStateRepositories = {
  articleExtractionRegistry: ArticleExtractionRegistryRepository;
  publishedDigestRegistry: PublishedDigestRegistryRepository;
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistoryRepository;
};

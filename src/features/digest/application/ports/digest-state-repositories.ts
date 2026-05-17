import type { ArticleExtractionRegistry } from "src/domains/article";
import type { PublishedDigestRegistry, RecommendationContentHistory } from "src/domains/digest";
import type { PreferenceProfile, PreferenceSummaryHistory } from "src/domains/preference";

export type ArticleExtractionRegistryRepository = {
  load(): Promise<ArticleExtractionRegistry>;
  save(registry: ArticleExtractionRegistry): Promise<void>;
};

export type PublishedDigestRegistryRepository = {
  load(): Promise<PublishedDigestRegistry>;
  save(registry: PublishedDigestRegistry): Promise<void>;
};

export type RecommendationContentHistoryRepository = {
  load(): Promise<RecommendationContentHistory>;
  save(history: RecommendationContentHistory): Promise<void>;
};

export type PreferenceProfileRepository = {
  load(): Promise<PreferenceProfile>;
  save(profile: PreferenceProfile): Promise<void>;
};

export type PreferenceSummaryHistoryRepository = {
  load(): Promise<PreferenceSummaryHistory>;
  save(history: PreferenceSummaryHistory): Promise<void>;
};

export type DigestStateRepositories = {
  articleExtractionRegistry: ArticleExtractionRegistryRepository;
  preferenceProfile: PreferenceProfileRepository;
  preferenceSummaryHistory: PreferenceSummaryHistoryRepository;
  publishedDigestRegistry: PublishedDigestRegistryRepository;
  recommendationContentHistory: RecommendationContentHistoryRepository;
};

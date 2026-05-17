import type { FeatureExtractionState, VocabularySuggestionState } from "src/domains/article";
import type { PublicationState, RecommendationContentState } from "src/domains/digest";
import type { PreferenceProfile, PreferenceSummaryHistory } from "src/domains/preference";

export type ArticleExtractionRegistryRepository = {
  load(): Promise<FeatureExtractionState>;
  save(state: FeatureExtractionState): Promise<void>;
};

export type PublishedDigestRegistryRepository = {
  load(): Promise<PublicationState>;
  save(state: PublicationState): Promise<void>;
};

export type RecommendationContentHistoryRepository = {
  load(): Promise<RecommendationContentState>;
  save(state: RecommendationContentState): Promise<void>;
};

export type PreferenceProfileRepository = {
  load(): Promise<PreferenceProfile>;
  save(profile: PreferenceProfile): Promise<void>;
};

export type PreferenceSummaryHistoryRepository = {
  load(): Promise<PreferenceSummaryHistory>;
  save(history: PreferenceSummaryHistory): Promise<void>;
};

export type ArticleFeatureSuggestionHistoryRepository = {
  load(): Promise<VocabularySuggestionState>;
  save(state: VocabularySuggestionState): Promise<void>;
};

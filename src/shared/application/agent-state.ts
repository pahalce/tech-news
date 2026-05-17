import type { FeatureExtractionState, VocabularySuggestionState } from "src/domains/article";
import type { PublicationState, RecommendationContentState } from "src/domains/digest";
import type { PreferenceProfile, PreferenceSummaryHistory } from "src/domains/preference";

export type AgentState = {
  featureExtractionState: FeatureExtractionState;
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
  publicationState: PublicationState;
  recommendationContentState: RecommendationContentState;
  vocabularySuggestionState: VocabularySuggestionState;
};

export type AgentStateRepository = {
  load(): Promise<AgentState>;
  save(state: AgentState): Promise<void>;
};

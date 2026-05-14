import type { AgentState } from "../modules/agent-state/infrastructure/file-agent-state";
import type { FeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import {
  suggestFeatureVocabularyCandidates,
  type VocabularyCandidateDescriber,
  type VocabularySuggestionNotifier,
} from "../modules/vocabulary-maintenance/application/suggest-feature-vocabulary-candidates-use-case";

export type RunSuggestFeatureVocabularyWorkflowInput = {
  agentState: AgentState;
  featureVocabulary: FeatureVocabularyConfig;
  suggestedAt: string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
};

export type RunSuggestFeatureVocabularyWorkflowResult = {
  agentState: AgentState;
};

export async function runSuggestFeatureVocabularyWorkflow(
  input: RunSuggestFeatureVocabularyWorkflowInput,
): Promise<RunSuggestFeatureVocabularyWorkflowResult> {
  const suggested = await suggestFeatureVocabularyCandidates({
    featureExtractions: input.agentState.featureExtractionState.extractions,
    featureVocabulary: input.featureVocabulary,
    publicationRecords: input.agentState.publicationState.publicationRecords,
    vocabularySuggestionState: input.agentState.vocabularySuggestionState,
    suggestedAt: input.suggestedAt,
    describer: input.describer,
    notifier: input.notifier,
  });

  return {
    agentState: {
      ...input.agentState,
      vocabularySuggestionState: suggested.vocabularySuggestionState,
    },
  };
}

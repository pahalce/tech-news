import type { AgentState } from "../modules/agent-state/infrastructure/file-agent-state";
import type { FeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import type {
  VocabularyCandidateDescriber,
  VocabularySuggestionNotifier,
} from "../modules/vocabulary-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import { runSuggestFeatureVocabularyWorkflow } from "./run-suggest-feature-vocabulary-workflow";

export type RunSuggestFeatureVocabularyJobInput = {
  loadAgentState(): Promise<AgentState>;
  saveAgentState(state: AgentState): Promise<void>;
  loadFeatureVocabulary(): Promise<FeatureVocabularyConfig>;
  suggestedAt(): string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
};

export async function runSuggestFeatureVocabularyJob(
  input: RunSuggestFeatureVocabularyJobInput,
): Promise<void> {
  const [agentState, featureVocabulary] = await Promise.all([
    input.loadAgentState(),
    input.loadFeatureVocabulary(),
  ]);
  const result = await runSuggestFeatureVocabularyWorkflow({
    agentState,
    featureVocabulary,
    suggestedAt: input.suggestedAt(),
    describer: input.describer,
    notifier: input.notifier,
  });

  await input.saveAgentState(result.agentState);
}

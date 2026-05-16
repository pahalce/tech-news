import type { AgentState } from "../modules/agent-state/infrastructure/file-agent-state";
import type { FeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import type {
  VocabularyCandidateDescriber,
  VocabularySuggestionNotifier,
} from "../modules/vocabulary-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import { runSuggestFeatureVocabularyWorkflow } from "./run-suggest-feature-vocabulary-workflow";
import { elapsedMs, silentWorkflowLogger, type WorkflowLogger } from "./workflow-logger";

export type RunSuggestFeatureVocabularyJobInput = {
  loadAgentState(): Promise<AgentState>;
  saveAgentState(state: AgentState): Promise<void>;
  loadFeatureVocabulary(): Promise<FeatureVocabularyConfig>;
  suggestedAt(): string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
  logger?: WorkflowLogger;
};

export async function runSuggestFeatureVocabularyJob(
  input: RunSuggestFeatureVocabularyJobInput,
): Promise<void> {
  const logger = input.logger ?? silentWorkflowLogger;
  const startedAt = performance.now();
  logger.info("job started");
  logger.info("loading Agent State and Feature Vocabulary");
  const [agentState, featureVocabulary] = await Promise.all([
    input.loadAgentState(),
    input.loadFeatureVocabulary(),
  ]);
  logger.info("loaded Agent State and Feature Vocabulary", {
    featureExtractionCount: agentState.featureExtractionState.extractions.length,
    publicationRecordCount: agentState.publicationState.publicationRecords.length,
    vocabularySuggestionRunCount: agentState.vocabularySuggestionState.suggestionRuns.length,
  });
  const suggestedAt = input.suggestedAt();
  logger.info("running vocabulary suggestion workflow", { suggestedAt });
  const result = await runSuggestFeatureVocabularyWorkflow({
    agentState,
    featureVocabulary,
    suggestedAt,
    describer: input.describer,
    notifier: input.notifier,
    logger,
  });

  logger.info("saving Agent State");
  await input.saveAgentState(result.agentState);
  logger.info("job finished", {
    elapsedMs: elapsedMs(startedAt),
    vocabularySuggestionRunCount: result.agentState.vocabularySuggestionState.suggestionRuns.length,
  });
}

import type { ArticleFeatureMaintenanceAgentStateRepository } from "src/features/article-feature-maintenance/application/ports/agent-state-repository";
import type { ArticleFeatureVocabularyReader } from "src/features/article-feature-maintenance/application/ports/article-feature-vocabulary-reader";
import type {
  VocabularyCandidateDescriber,
  VocabularySuggestionNotifier,
} from "src/features/article-feature-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import { runSuggestFeatureVocabularyWorkflow } from "src/features/article-feature-maintenance/application/run-suggest-feature-vocabulary-workflow";
import {
  elapsedMs,
  silentWorkflowLogger,
  type WorkflowLogger,
} from "src/shared/application/workflow-logger";

export type RunSuggestFeatureVocabularyJobInput = {
  agentStateRepository: ArticleFeatureMaintenanceAgentStateRepository;
  articleFeatureVocabularyReader: ArticleFeatureVocabularyReader;
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
    input.agentStateRepository.load(),
    input.articleFeatureVocabularyReader.read(),
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
  await input.agentStateRepository.save(result.agentState);
  logger.info("job finished", {
    elapsedMs: elapsedMs(startedAt),
    vocabularySuggestionRunCount: result.agentState.vocabularySuggestionState.suggestionRuns.length,
  });
}

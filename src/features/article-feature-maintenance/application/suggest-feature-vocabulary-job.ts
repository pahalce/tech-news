import type { ArticleFeatureMaintenanceStateRepositories } from "src/features/article-feature-maintenance/application/ports/article-feature-maintenance-state-repositories";
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
  stateRepositories: ArticleFeatureMaintenanceStateRepositories;
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
  logger.info("loading article feature maintenance state and Feature Vocabulary");
  const [
    articleExtractionRegistry,
    publishedDigestRegistry,
    articleFeatureSuggestionHistory,
    featureVocabulary,
  ] = await Promise.all([
    input.stateRepositories.articleExtractionRegistry.load(),
    input.stateRepositories.publishedDigestRegistry.load(),
    input.stateRepositories.articleFeatureSuggestionHistory.load(),
    input.articleFeatureVocabularyReader.read(),
  ]);
  logger.info("loaded article feature maintenance state and Feature Vocabulary", {
    featureExtractionCount: articleExtractionRegistry.extractions.length,
    publicationRecordCount: publishedDigestRegistry.publicationRecords.length,
    vocabularySuggestionRunCount: articleFeatureSuggestionHistory.suggestionRuns.length,
  });
  const suggestedAt = input.suggestedAt();
  logger.info("running vocabulary suggestion workflow", { suggestedAt });
  const result = await runSuggestFeatureVocabularyWorkflow({
    articleExtractionRegistry,
    publishedDigestRegistry,
    articleFeatureSuggestionHistory,
    featureVocabulary,
    suggestedAt,
    describer: input.describer,
    notifier: input.notifier,
    logger,
  });

  logger.info("saving article feature suggestion history");
  await input.stateRepositories.articleFeatureSuggestionHistory.save(
    result.articleFeatureSuggestionHistory,
  );
  logger.info("job finished", {
    elapsedMs: elapsedMs(startedAt),
    vocabularySuggestionRunCount: result.articleFeatureSuggestionHistory.suggestionRuns.length,
  });
}

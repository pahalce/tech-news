import type {
  ArticleExtractionRegistry,
  FeatureVocabularyConfig,
  ArticleFeatureSuggestionHistory,
} from "src/domains/article";
import type { PublishedDigestRegistry } from "src/domains/digest";
import {
  isInsideSuggestionLookbackWindow,
  suggestFeatureVocabularyCandidates,
  type VocabularyCandidateDescriber,
  type VocabularyPromotionCandidate,
  type VocabularySuggestionNotifier,
} from "src/features/article-feature-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import {
  elapsedMs,
  silentWorkflowLogger,
  type WorkflowLogger,
} from "src/shared/application/workflow-logger";

export type RunSuggestFeatureVocabularyWorkflowInput = {
  articleExtractionRegistry: ArticleExtractionRegistry;
  publishedDigestRegistry: PublishedDigestRegistry;
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistory;
  featureVocabulary: FeatureVocabularyConfig;
  suggestedAt: string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
  logger?: WorkflowLogger;
};

export type RunSuggestFeatureVocabularyWorkflowResult = {
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistory;
};

export async function runSuggestFeatureVocabularyWorkflow(
  input: RunSuggestFeatureVocabularyWorkflowInput,
): Promise<RunSuggestFeatureVocabularyWorkflowResult> {
  const logger = input.logger ?? silentWorkflowLogger;
  const workflowStartedAt = performance.now();
  const lookbackExtractions = input.articleExtractionRegistry.extractions.filter((extraction) =>
    isInsideSuggestionLookbackWindow(extraction.extractedAt, input.suggestedAt),
  );

  logger.info("workflow started", {
    suggestedAt: input.suggestedAt,
    featureExtractionCount: input.articleExtractionRegistry.extractions.length,
    lookbackExtractionCount: lookbackExtractions.length,
    publicationRecordCount: input.publishedDigestRegistry.publicationRecords.length,
  });

  logger.info("collecting vocabulary promotion candidates");
  const suggested = await suggestFeatureVocabularyCandidates({
    featureExtractions: input.articleExtractionRegistry.extractions,
    featureVocabulary: input.featureVocabulary,
    publicationRecords: input.publishedDigestRegistry.publicationRecords,
    articleFeatureSuggestionHistory: input.articleFeatureSuggestionHistory,
    suggestedAt: input.suggestedAt,
    describer: input.describer,
    notifier: input.notifier,
  });

  logger.info("collected vocabulary promotion candidates", {
    candidateCount: suggested.candidates.length,
    candidateKeys: summarizeCandidateKeys(suggested.candidates),
  });

  logger.info("workflow finished", { elapsedMs: elapsedMs(workflowStartedAt) });

  return {
    articleFeatureSuggestionHistory: suggested.articleFeatureSuggestionHistory,
  };
}

function summarizeCandidateKeys(candidates: readonly VocabularyPromotionCandidate[]): string[] {
  return candidates.map((candidate) => candidate.key);
}

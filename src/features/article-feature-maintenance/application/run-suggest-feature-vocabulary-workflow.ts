import type {
  FeatureExtractionState,
  FeatureVocabularyConfig,
  VocabularySuggestionState,
} from "src/domains/article";
import type { PublicationState } from "src/domains/digest";
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
  articleExtractionRegistry: FeatureExtractionState;
  publishedDigestRegistry: PublicationState;
  articleFeatureSuggestionHistory: VocabularySuggestionState;
  featureVocabulary: FeatureVocabularyConfig;
  suggestedAt: string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
  logger?: WorkflowLogger;
};

export type RunSuggestFeatureVocabularyWorkflowResult = {
  articleFeatureSuggestionHistory: VocabularySuggestionState;
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
    vocabularySuggestionState: input.articleFeatureSuggestionHistory,
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
    articleFeatureSuggestionHistory: suggested.vocabularySuggestionState,
  };
}

function summarizeCandidateKeys(candidates: readonly VocabularyPromotionCandidate[]): string[] {
  return candidates.map((candidate) => candidate.key);
}

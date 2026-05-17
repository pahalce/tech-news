import type { AgentState } from "src/shared/infrastructure/file-agent-state";
import type { FeatureVocabularyConfig } from "src/domains/article/article-feature-vocabulary-config";
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
} from "src/shared/infrastructure/workflow-logger";

export type RunSuggestFeatureVocabularyWorkflowInput = {
  agentState: AgentState;
  featureVocabulary: FeatureVocabularyConfig;
  suggestedAt: string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
  logger?: WorkflowLogger;
};

export type RunSuggestFeatureVocabularyWorkflowResult = {
  agentState: AgentState;
};

export async function runSuggestFeatureVocabularyWorkflow(
  input: RunSuggestFeatureVocabularyWorkflowInput,
): Promise<RunSuggestFeatureVocabularyWorkflowResult> {
  const logger = input.logger ?? silentWorkflowLogger;
  const workflowStartedAt = performance.now();
  const lookbackExtractions = input.agentState.featureExtractionState.extractions.filter(
    (extraction) => isInsideSuggestionLookbackWindow(extraction.extractedAt, input.suggestedAt),
  );

  logger.info("workflow started", {
    suggestedAt: input.suggestedAt,
    featureExtractionCount: input.agentState.featureExtractionState.extractions.length,
    lookbackExtractionCount: lookbackExtractions.length,
    publicationRecordCount: input.agentState.publicationState.publicationRecords.length,
  });

  logger.info("collecting vocabulary promotion candidates");
  const suggested = await suggestFeatureVocabularyCandidates({
    featureExtractions: input.agentState.featureExtractionState.extractions,
    featureVocabulary: input.featureVocabulary,
    publicationRecords: input.agentState.publicationState.publicationRecords,
    vocabularySuggestionState: input.agentState.vocabularySuggestionState,
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
    agentState: {
      ...input.agentState,
      vocabularySuggestionState: suggested.vocabularySuggestionState,
    },
  };
}

function summarizeCandidateKeys(candidates: readonly VocabularyPromotionCandidate[]): string[] {
  return candidates.map((candidate) => candidate.key);
}

import {
  collectReactionFeedback,
  type PreferenceSummaryUpdater,
  type ReactionFeedbackReader,
} from "src/modules/preference/application/collect-reaction-feedback-use-case";
import type { AgentState } from "src/modules/agent-state/infrastructure/file-agent-state";

export type RunCollectFeedbackWorkflowInput = {
  agentState: AgentState;
  collectedAt: string;
  reactionFeedbackReader: ReactionFeedbackReader;
  preferenceSummaryUpdater: PreferenceSummaryUpdater;
};

export type RunCollectFeedbackWorkflowResult = {
  agentState: AgentState;
};

export async function runCollectFeedbackWorkflow(
  input: RunCollectFeedbackWorkflowInput,
): Promise<RunCollectFeedbackWorkflowResult> {
  const collected = await collectReactionFeedback({
    publicationRecords: input.agentState.publicationState.publicationRecords,
    featureExtractions: input.agentState.featureExtractionState.extractions,
    preferenceProfile: input.agentState.preferenceProfile,
    preferenceSummaryHistory: input.agentState.preferenceSummaryHistory,
    collectedAt: input.collectedAt,
    reactionFeedbackReader: input.reactionFeedbackReader,
    preferenceSummaryUpdater: input.preferenceSummaryUpdater,
  });

  return {
    agentState: {
      ...input.agentState,
      preferenceProfile: collected.preferenceProfile,
      preferenceSummaryHistory: collected.preferenceSummaryHistory,
      publicationState: {
        version: input.agentState.publicationState.version,
        publicationRecords: collected.publicationRecords,
        recommendedArticles: input.agentState.publicationState.recommendedArticles,
      },
    },
  };
}

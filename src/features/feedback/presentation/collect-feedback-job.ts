import type { AgentState } from "src/shared/infrastructure/file-agent-state";
import type {
  PreferenceSummaryUpdater,
  ReactionFeedbackReader,
} from "src/features/feedback/application/collect-reaction-feedback-use-case";
import { runCollectFeedbackWorkflow } from "src/features/feedback/presentation/run-collect-feedback-workflow";

export type RunCollectFeedbackJobInput = {
  loadAgentState(): Promise<AgentState>;
  saveAgentState(state: AgentState): Promise<void>;
  collectedAt(): string;
  reactionFeedbackReader: ReactionFeedbackReader;
  preferenceSummaryUpdater: PreferenceSummaryUpdater;
};

export async function runCollectFeedbackJob(input: RunCollectFeedbackJobInput): Promise<void> {
  const agentState = await input.loadAgentState();
  const result = await runCollectFeedbackWorkflow({
    agentState,
    collectedAt: input.collectedAt(),
    reactionFeedbackReader: input.reactionFeedbackReader,
    preferenceSummaryUpdater: input.preferenceSummaryUpdater,
  });

  await input.saveAgentState(result.agentState);
}

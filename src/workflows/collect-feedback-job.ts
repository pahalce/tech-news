import type { AgentState } from "src/modules/agent-state/infrastructure/file-agent-state";
import type {
  PreferenceSummaryUpdater,
  ReactionFeedbackReader,
} from "src/modules/preference/application/collect-reaction-feedback-use-case";
import { runCollectFeedbackWorkflow } from "src/workflows/run-collect-feedback-workflow";

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

import type { FeedbackAgentStateRepository } from "src/features/feedback/application/ports/agent-state-repository";
import type {
  PreferenceSummaryUpdater,
  ReactionFeedbackReader,
} from "src/features/feedback/application/collect-reaction-feedback-use-case";
import { runCollectFeedbackWorkflow } from "src/features/feedback/application/run-collect-feedback-workflow";

export type RunCollectFeedbackJobInput = {
  agentStateRepository: FeedbackAgentStateRepository;
  collectedAt(): string;
  reactionFeedbackReader: ReactionFeedbackReader;
  preferenceSummaryUpdater: PreferenceSummaryUpdater;
};

export async function runCollectFeedbackJob(input: RunCollectFeedbackJobInput): Promise<void> {
  const agentState = await input.agentStateRepository.load();
  const result = await runCollectFeedbackWorkflow({
    agentState,
    collectedAt: input.collectedAt(),
    reactionFeedbackReader: input.reactionFeedbackReader,
    preferenceSummaryUpdater: input.preferenceSummaryUpdater,
  });

  await input.agentStateRepository.save(result.agentState);
}

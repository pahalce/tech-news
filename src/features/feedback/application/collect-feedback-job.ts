import type { FeedbackStateRepositories } from "src/features/feedback/application/ports/agent-state-repository";
import type {
  PreferenceSummaryUpdater,
  ReactionFeedbackReader,
} from "src/features/feedback/application/collect-reaction-feedback-use-case";
import { runCollectFeedbackWorkflow } from "src/features/feedback/application/run-collect-feedback-workflow";

export type RunCollectFeedbackJobInput = {
  stateRepositories: FeedbackStateRepositories;
  collectedAt(): string;
  reactionFeedbackReader: ReactionFeedbackReader;
  preferenceSummaryUpdater: PreferenceSummaryUpdater;
};

export async function runCollectFeedbackJob(input: RunCollectFeedbackJobInput): Promise<void> {
  const [
    articleExtractionRegistry,
    publishedDigestRegistry,
    preferenceProfile,
    preferenceSummaryHistory,
  ] = await Promise.all([
    input.stateRepositories.articleExtractionRegistry.load(),
    input.stateRepositories.publishedDigestRegistry.load(),
    input.stateRepositories.preferenceProfile.load(),
    input.stateRepositories.preferenceSummaryHistory.load(),
  ]);
  const result = await runCollectFeedbackWorkflow({
    articleExtractionRegistry,
    publishedDigestRegistry,
    preferenceProfile,
    preferenceSummaryHistory,
    collectedAt: input.collectedAt(),
    reactionFeedbackReader: input.reactionFeedbackReader,
    preferenceSummaryUpdater: input.preferenceSummaryUpdater,
  });

  await Promise.all([
    input.stateRepositories.publishedDigestRegistry.save(result.publishedDigestRegistry),
    input.stateRepositories.preferenceProfile.save(result.preferenceProfile),
    input.stateRepositories.preferenceSummaryHistory.save(result.preferenceSummaryHistory),
  ]);
}

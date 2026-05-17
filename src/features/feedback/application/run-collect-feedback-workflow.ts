import {
  collectReactionFeedback,
  type PreferenceSummaryUpdater,
  type ReactionFeedbackReader,
} from "src/features/feedback/application/collect-reaction-feedback-use-case";
import type { ArticleExtractionRegistry } from "src/domains/article";
import type { PublishedDigestRegistry } from "src/domains/digest";
import type { PreferenceProfile, PreferenceSummaryHistory } from "src/domains/preference";

export type RunCollectFeedbackWorkflowInput = {
  articleExtractionRegistry: ArticleExtractionRegistry;
  publishedDigestRegistry: PublishedDigestRegistry;
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
  collectedAt: string;
  reactionFeedbackReader: ReactionFeedbackReader;
  preferenceSummaryUpdater: PreferenceSummaryUpdater;
};

export type RunCollectFeedbackWorkflowResult = {
  publishedDigestRegistry: PublishedDigestRegistry;
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
};

export async function runCollectFeedbackWorkflow(
  input: RunCollectFeedbackWorkflowInput,
): Promise<RunCollectFeedbackWorkflowResult> {
  const collected = await collectReactionFeedback({
    publicationRecords: input.publishedDigestRegistry.publicationRecords,
    featureExtractions: input.articleExtractionRegistry.extractions,
    preferenceProfile: input.preferenceProfile,
    preferenceSummaryHistory: input.preferenceSummaryHistory,
    collectedAt: input.collectedAt,
    reactionFeedbackReader: input.reactionFeedbackReader,
    preferenceSummaryUpdater: input.preferenceSummaryUpdater,
  });

  return {
    preferenceProfile: collected.preferenceProfile,
    preferenceSummaryHistory: collected.preferenceSummaryHistory,
    publishedDigestRegistry: {
      version: input.publishedDigestRegistry.version,
      publicationRecords: collected.publicationRecords,
      recommendedArticles: input.publishedDigestRegistry.recommendedArticles,
    },
  };
}

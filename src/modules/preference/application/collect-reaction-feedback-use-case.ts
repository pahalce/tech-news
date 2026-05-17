import { applyArticleFeatureFeedback } from "../../../shared/domain/article-feature-weighting";
import type { ArticleFeatures } from "../../../shared/domain/article-features";
import type { PreferenceProfile, PreferenceSummaryHistory } from "../domain/preference-state";

type ReactionFeedback = {
  emoji: string;
  userIds: string[];
  processedAt: string | null;
  ignoredReason: string | null;
};

type PublicationRecord = {
  articleId: string;
  messageId: string;
  channelId: string;
  postedAt: string;
  reactionFeedback: ReactionFeedback[];
};

type FeatureExtraction = {
  articleId: string;
  articleFeatures: ArticleFeatures | null;
};

export type ReactionSnapshot = {
  positiveUserIds: readonly string[];
  negativeUserIds: readonly string[];
};

export type ReactionFeedbackReader = {
  read(record: PublicationRecord): Promise<ReactionSnapshot>;
};

export type PreferenceSummaryUpdater = {
  update(input: {
    preferenceProfile: PreferenceProfile;
    previousSummaryHistory: PreferenceSummaryHistory;
    processedFeedbackCount: number;
    collectedAt: string;
  }): Promise<PreferenceSummaryHistory>;
};

export type CollectReactionFeedbackInput = {
  publicationRecords: readonly PublicationRecord[];
  featureExtractions: readonly FeatureExtraction[];
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
  collectedAt: string;
  reactionFeedbackReader: ReactionFeedbackReader;
  preferenceSummaryUpdater: PreferenceSummaryUpdater;
};

export type CollectReactionFeedbackResult = {
  publicationRecords: PublicationRecord[];
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
};

const feedbackWindowDays = 3;
const positiveEmoji = "👍";
const negativeEmoji = "👎";
const positiveWeight = 1;
const negativeWeight = -1;

export async function collectReactionFeedback(
  input: CollectReactionFeedbackInput,
): Promise<CollectReactionFeedbackResult> {
  const featureExtractionsByArticleId = new Map(
    input.featureExtractions.map((extraction) => [extraction.articleId, extraction]),
  );
  const preferenceProfile = clonePreferenceProfile(input.preferenceProfile);
  const publicationRecords: PublicationRecord[] = [];
  let processedFeedbackCount = 0;

  for (const record of input.publicationRecords) {
    if (!isInsideFeedbackCollectionWindow(record.postedAt, input.collectedAt)) {
      publicationRecords.push(clonePublicationRecord(record));
      continue;
    }

    const nextRecord = clonePublicationRecord(record);
    if (hasProcessedTargetFeedback(nextRecord)) {
      publicationRecords.push(nextRecord);
      continue;
    }

    const snapshot = await input.reactionFeedbackReader.read(record);
    const hasPositive = snapshot.positiveUserIds.length > 0;
    const hasNegative = snapshot.negativeUserIds.length > 0;

    if (hasPositive && hasNegative) {
      markIgnored(nextRecord, positiveEmoji, snapshot.positiveUserIds, "contradictory_feedback");
      markIgnored(nextRecord, negativeEmoji, snapshot.negativeUserIds, "contradictory_feedback");
      publicationRecords.push(nextRecord);
      continue;
    }

    const featureExtraction = featureExtractionsByArticleId.get(record.articleId);
    const articleFeatures = featureExtraction?.articleFeatures ?? null;

    if (hasPositive) {
      markProcessed(nextRecord, positiveEmoji, snapshot.positiveUserIds, input.collectedAt);
      applyFeedback(preferenceProfile, articleFeatures, positiveWeight);
      processedFeedbackCount += snapshot.positiveUserIds.length;
    }

    if (hasNegative) {
      markProcessed(nextRecord, negativeEmoji, snapshot.negativeUserIds, input.collectedAt);
      applyFeedback(preferenceProfile, articleFeatures, negativeWeight);
      processedFeedbackCount += snapshot.negativeUserIds.length;
    }

    publicationRecords.push(nextRecord);
  }

  const nextPreferenceProfile =
    processedFeedbackCount > 0
      ? {
          ...preferenceProfile,
          updated_at: input.collectedAt,
        }
      : preferenceProfile;

  const preferenceSummaryHistory = await input.preferenceSummaryUpdater.update({
    preferenceProfile: nextPreferenceProfile,
    previousSummaryHistory: input.preferenceSummaryHistory,
    processedFeedbackCount,
    collectedAt: input.collectedAt,
  });

  return {
    publicationRecords,
    preferenceProfile: nextPreferenceProfile,
    preferenceSummaryHistory,
  };
}

function hasProcessedTargetFeedback(record: PublicationRecord): boolean {
  return record.reactionFeedback.some(
    (feedback) =>
      (feedback.emoji === positiveEmoji || feedback.emoji === negativeEmoji) &&
      (feedback.processedAt !== null || feedback.ignoredReason !== null),
  );
}

function isInsideFeedbackCollectionWindow(postedAt: string, collectedAt: string): boolean {
  const elapsedMs = Date.parse(collectedAt) - Date.parse(postedAt);
  return elapsedMs >= 0 && elapsedMs <= feedbackWindowDays * 24 * 60 * 60 * 1000;
}

function markProcessed(
  record: PublicationRecord,
  emoji: string,
  userIds: readonly string[],
  processedAt: string,
): void {
  updateReactionFeedback(record, emoji, {
    userIds: [...userIds],
    processedAt,
    ignoredReason: null,
  });
}

function markIgnored(
  record: PublicationRecord,
  emoji: string,
  userIds: readonly string[],
  ignoredReason: string,
): void {
  updateReactionFeedback(record, emoji, {
    userIds: [...userIds],
    processedAt: null,
    ignoredReason,
  });
}

function updateReactionFeedback(
  record: PublicationRecord,
  emoji: string,
  feedback: Omit<ReactionFeedback, "emoji">,
): void {
  const index = record.reactionFeedback.findIndex((item) => item.emoji === emoji);
  const nextFeedback = { emoji, ...feedback };

  if (index === -1) {
    record.reactionFeedback.push(nextFeedback);
    return;
  }

  record.reactionFeedback[index] = nextFeedback;
}

function applyFeedback(
  preferenceProfile: PreferenceProfile,
  articleFeatures: ArticleFeatures | null,
  feedbackWeight: number,
): void {
  applyArticleFeatureFeedback(
    preferenceProfile.feature_weights,
    articleFeatures,
    feedbackWeight,
    preferenceProfile.weight_range,
  );
}

function clonePublicationRecord(record: PublicationRecord): PublicationRecord {
  return {
    ...record,
    reactionFeedback: record.reactionFeedback.map((feedback) => ({
      ...feedback,
      userIds: [...feedback.userIds],
    })),
  };
}

function clonePreferenceProfile(profile: PreferenceProfile): PreferenceProfile {
  return {
    ...profile,
    weight_range: { ...profile.weight_range },
    seed_weight_range: { ...profile.seed_weight_range },
    feature_weights: {
      topics: { ...profile.feature_weights.topics },
      feature_axes: Object.fromEntries(
        Object.entries(profile.feature_weights.feature_axes).map(([axis, weights]) => [
          axis,
          { ...weights },
        ]),
      ),
    },
  };
}

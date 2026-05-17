import { applyArticleFeatureFeedbackToNewWeights } from "src/domains/article";
import type { ArticleFeatures } from "src/domains/article";
import type { DeliveryReference } from "src/domains/digest";
import {
  isInsideFeedbackCollectionWindow,
  readReactionFeedbackWeight,
  shouldIgnoreContradictoryReactionFeedback,
  type PreferenceProfile,
  type PreferenceSummaryHistory,
  type ReactionFeedbackKind,
} from "src/domains/preference";

const positiveReactionEmoji = "👍";
const negativeReactionEmoji = "👎";

type ReactionFeedback = {
  emoji: string;
  userIds: readonly string[];
  processedAt: string | null;
  ignoredReason: string | null;
};

type PublicationRecord = {
  articleId: string;
  deliveryReference: DeliveryReference;
  postedAt: string;
  reactionFeedback: readonly ReactionFeedback[];
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

export async function collectReactionFeedback(
  input: CollectReactionFeedbackInput,
): Promise<CollectReactionFeedbackResult> {
  const featureExtractionsByArticleId = new Map(
    input.featureExtractions.map((extraction) => [extraction.articleId, extraction]),
  );
  let preferenceProfile = input.preferenceProfile;
  const publicationRecords: PublicationRecord[] = [];
  let processedFeedbackCount = 0;

  for (const record of input.publicationRecords) {
    if (!isInsideFeedbackCollectionWindow(record.postedAt, input.collectedAt)) {
      publicationRecords.push(clonePublicationRecord(record));
      continue;
    }

    let nextRecord = clonePublicationRecord(record);
    if (hasProcessedTargetFeedback(nextRecord)) {
      publicationRecords.push(nextRecord);
      continue;
    }

    const snapshot = await input.reactionFeedbackReader.read(record);
    const hasPositive = snapshot.positiveUserIds.length > 0;
    const hasNegative = snapshot.negativeUserIds.length > 0;

    if (
      shouldIgnoreContradictoryReactionFeedback({
        positiveCount: snapshot.positiveUserIds.length,
        negativeCount: snapshot.negativeUserIds.length,
      })
    ) {
      nextRecord = updateReactionFeedback(nextRecord, positiveReactionEmoji, {
        userIds: [...snapshot.positiveUserIds],
        processedAt: null,
        ignoredReason: "contradictory_feedback",
      });
      nextRecord = updateReactionFeedback(nextRecord, negativeReactionEmoji, {
        userIds: [...snapshot.negativeUserIds],
        processedAt: null,
        ignoredReason: "contradictory_feedback",
      });
      publicationRecords.push(nextRecord);
      continue;
    }

    const featureExtraction = featureExtractionsByArticleId.get(record.articleId);
    const articleFeatures = featureExtraction?.articleFeatures ?? null;

    if (hasPositive) {
      nextRecord = updateReactionFeedback(nextRecord, positiveReactionEmoji, {
        userIds: [...snapshot.positiveUserIds],
        processedAt: input.collectedAt,
        ignoredReason: null,
      });
      preferenceProfile = applyFeedback(preferenceProfile, articleFeatures, "positive");
      processedFeedbackCount += snapshot.positiveUserIds.length;
    }

    if (hasNegative) {
      nextRecord = updateReactionFeedback(nextRecord, negativeReactionEmoji, {
        userIds: [...snapshot.negativeUserIds],
        processedAt: input.collectedAt,
        ignoredReason: null,
      });
      preferenceProfile = applyFeedback(preferenceProfile, articleFeatures, "negative");
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
      (feedback.emoji === positiveReactionEmoji || feedback.emoji === negativeReactionEmoji) &&
      (feedback.processedAt !== null || feedback.ignoredReason !== null),
  );
}

function updateReactionFeedback(
  record: PublicationRecord,
  emoji: string,
  feedback: Omit<ReactionFeedback, "emoji">,
): PublicationRecord {
  const index = record.reactionFeedback.findIndex((item) => item.emoji === emoji);
  const nextFeedback = { emoji, ...feedback };

  if (index === -1) {
    return {
      ...record,
      reactionFeedback: [...record.reactionFeedback, nextFeedback],
    };
  }

  return {
    ...record,
    reactionFeedback: record.reactionFeedback.map((item, itemIndex) =>
      itemIndex === index ? nextFeedback : item,
    ),
  };
}

function applyFeedback(
  preferenceProfile: PreferenceProfile,
  articleFeatures: ArticleFeatures | null,
  kind: ReactionFeedbackKind,
): PreferenceProfile {
  const feedbackWeight = readReactionFeedbackWeight(kind);

  return {
    ...preferenceProfile,
    feature_weights: applyArticleFeatureFeedbackToNewWeights(
      preferenceProfile.feature_weights,
      articleFeatures,
      feedbackWeight,
      preferenceProfile.weight_range,
    ),
  };
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

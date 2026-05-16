import { describe, expect, it } from "vite-plus/test";

import { collectReactionFeedback } from "./collect-reaction-feedback-use-case";

describe("Reaction Feedback 収集 use case に関するテスト", () => {
  it("Publication Record が3日より古いとき、Reaction Feedback を読まない", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-05T23:59:59.999Z", articleIdA)];
    let readCount = 0;

    // Act
    await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => {
          readCount += 1;
          return { positiveUserIds: ["owner"], negativeUserIds: [] };
        },
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(readCount).toBe(0);
  });

  it("Publication Record が3日以内のとき、Reaction Feedback を読む", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-06T00:00:00.000Z", articleIdA)];
    let readCount = 0;

    // Act
    await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => {
          readCount += 1;
          return { positiveUserIds: [], negativeUserIds: [] };
        },
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(readCount).toBe(1);
  });

  it("正負両方の Reaction Feedback があるとき、ignoredReason が記録される", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: ["owner"] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(actual.publicationRecords[0]?.reactionFeedback).toContainEqual({
      emoji: "👍",
      userIds: ["owner"],
      processedAt: null,
      ignoredReason: "contradictory_feedback",
    });
  });

  it("正の Reaction Feedback があるとき、Feature Salience を掛けて重みが更新される", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [createFeatureExtraction(articleIdA, 0.5)],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(0.5);
  });

  it("処理済みの Reaction Feedback があるとき、Preference Profile が再更新されない", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];
    publicationRecords[0]!.reactionFeedback[0] = {
      emoji: "👍",
      userIds: ["owner"],
      processedAt: "2026-05-08T08:00:00.000Z",
      ignoredReason: null,
    };

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [createFeatureExtraction(articleIdA, 0.8)],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(0);
  });

  it("Feature Salience が閾値未満のとき、Preference Profile が更新されない", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [createFeatureExtraction(articleIdA, 0.2)],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(0);
  });

  it("Mentioned Topic の Salience が閾値未満のとき、Preference Profile が更新されない", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [createFeatureExtractionWithMentionedTopic(articleIdA, 0.6)],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(0);
  });

  it("重み更新が上限を超えるとき、3.0に丸められる", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];
    const preferenceProfile = createPreferenceProfile();
    preferenceProfile.feature_weights.topics.typescript = 2.8;

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [createFeatureExtraction(articleIdA, 0.5)],
      preferenceProfile,
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(3);
  });

  it("Reaction Feedback を処理したとき、Preference Summary History が更新される", async () => {
    // Arrange
    const publicationRecords = [createPublicationRecord("2026-05-08T00:00:00.000Z", articleIdA)];

    // Act
    const actual = await collectReactionFeedback({
      publicationRecords,
      featureExtractions: [createFeatureExtraction(articleIdA, 0.5)],
      preferenceProfile: createPreferenceProfile(),
      preferenceSummaryHistory: createPreferenceSummaryHistory(),
      collectedAt: "2026-05-09T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => ({
          ...previousSummaryHistory,
          long_term_summary: "TypeScript の実装記事を好む",
        }),
      },
    });

    // Assert
    expect(actual.preferenceSummaryHistory.long_term_summary).toBe("TypeScript の実装記事を好む");
  });
});

const articleIdA = `zenn:${"a".repeat(64)}`;

function createPublicationRecord(
  postedAt: string,
  articleId: string,
): {
  articleId: string;
  messageId: string;
  channelId: string;
  postedAt: string;
  reactionFeedback: Array<{
    emoji: string;
    userIds: string[];
    processedAt: string | null;
    ignoredReason: string | null;
  }>;
} {
  return {
    articleId,
    messageId: "message-1",
    channelId: "channel-1",
    postedAt,
    reactionFeedback: [
      { emoji: "👍", userIds: [], processedAt: null, ignoredReason: null },
      { emoji: "👎", userIds: [], processedAt: null, ignoredReason: null },
    ],
  };
}

function createFeatureExtraction(articleId: string, salience: number) {
  return {
    articleId,
    articleFeatures: {
      primaryTopics: [{ key: "typescript", salience }],
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "implementation_guide", salience }],
      },
      otherSignals: [],
    },
  };
}

function createFeatureExtractionWithMentionedTopic(articleId: string, salience: number) {
  return {
    articleId,
    articleFeatures: {
      primaryTopics: [],
      mentionedTopics: [{ key: "typescript", salience }],
      unknownTopics: [],
      featureAxes: {},
      otherSignals: [],
    },
  };
}

function createPreferenceProfile() {
  return {
    version: 1 as const,
    weight_range: { min: -3, max: 3 },
    seed_weight_range: { min: -1, max: 1 },
    feature_weights: {
      topics: { typescript: 0 },
      feature_axes: {
        content_types: {
          implementation_guide: 0,
        },
      },
    },
    updated_at: null,
  };
}

function createPreferenceSummaryHistory() {
  return {
    version: 1 as const,
    long_term_summary: null,
    recent_summary: {
      window_days: 7,
      summary: null,
      confidence: "insufficient_feedback",
    },
    history: [],
  };
}

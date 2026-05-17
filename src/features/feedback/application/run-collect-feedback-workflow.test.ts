import { describe, expect, it } from "vite-plus/test";

import { runCollectFeedbackWorkflow } from "src/features/feedback/application/run-collect-feedback-workflow";

describe("Collect Feedback Workflow に関するテスト", () => {
  it("Publication Record に正の Reaction Feedback があるとき、Preference Profile と Publication State が更新される", async () => {
    // Arrange
    const articleId = `zenn:${"a".repeat(64)}`;

    // Act
    const actual = await runCollectFeedbackWorkflow({
      articleExtractionRegistry: {
        version: 1,
        extractions: [
          {
            articleId,
            extractedAt: "2026-05-14T00:00:00.000Z",
            readability: { isReadable: true, reason: null },
            articleFeatures: {
              primaryTopics: [{ key: "typescript", salience: 0.8 }],
              mentionedTopics: [],
              unknownTopics: [],
              featureAxes: {},
              otherSignals: [],
            },
            author: null,
          },
        ],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      preferenceProfile: {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: { typescript: 0 },
          feature_axes: {},
        },
        updated_at: null,
      },
      preferenceSummaryHistory: {
        version: 1,
        long_term_summary: null,
        recent_summary: {
          window_days: 7,
          summary: null,
          confidence: "insufficient_feedback",
        },
        history: [],
      },
      publishedDigestRegistry: {
        version: 1,
        publicationRecords: [
          {
            articleId,
            deliveryReference: {
              externalSystem: "discord",
              destination: "channel-1",
              id: "message-1",
            },
            postedAt: "2026-05-14T00:00:00.000Z",
            reactionFeedback: [
              { emoji: "👍", userIds: [], processedAt: null, ignoredReason: null },
              { emoji: "👎", userIds: [], processedAt: null, ignoredReason: null },
            ],
          },
        ],
        recommendedArticles: [{ articleId, firstRecommendedAt: "2026-05-14T00:00:00.000Z" }],
      },
      collectedAt: "2026-05-15T00:00:00.000Z",
      reactionFeedbackReader: {
        read: async () => ({ positiveUserIds: ["owner"], negativeUserIds: [] }),
      },
      preferenceSummaryUpdater: {
        update: async ({ previousSummaryHistory }) => previousSummaryHistory,
      },
    });

    // Assert
    expect({
      topicWeight: actual.preferenceProfile.feature_weights.topics.typescript,
      updatedAt: actual.preferenceProfile.updated_at,
      processedAt:
        actual.publishedDigestRegistry.publicationRecords[0]?.reactionFeedback[0]?.processedAt,
    }).toEqual({
      topicWeight: 0.8,
      updatedAt: "2026-05-15T00:00:00.000Z",
      processedAt: "2026-05-15T00:00:00.000Z",
    });
  });
});

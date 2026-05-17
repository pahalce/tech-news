import { describe, expect, it } from "vite-plus/test";

import { runSuggestFeatureVocabularyWorkflow } from "src/features/article-feature-maintenance/application/run-suggest-feature-vocabulary-workflow";

describe("Suggest Feature Vocabulary Workflow に関するテスト", () => {
  it("Other Signals が候補条件を満たすとき、Vocabulary Suggestion State が更新される", async () => {
    // Arrange
    const articleIdA = `zenn:${"a".repeat(64)}`;
    const articleIdB = `zenn:${"b".repeat(64)}`;

    // Act
    const actual = await runSuggestFeatureVocabularyWorkflow({
      articleExtractionRegistry: {
        version: 1,
        extractions: [
          {
            articleId: articleIdA,
            extractedAt: "2026-05-14T00:00:00.000Z",
            readability: { isReadable: true, reason: null },
            articleFeatures: {
              primaryTopics: [],
              mentionedTopics: [],
              unknownTopics: [],
              featureAxes: {},
              otherSignals: [{ key: "hands_on_migration", salience: 0.7 }],
            },
            author: null,
          },
          {
            articleId: articleIdB,
            extractedAt: "2026-05-14T00:00:00.000Z",
            readability: { isReadable: true, reason: null },
            articleFeatures: {
              primaryTopics: [],
              mentionedTopics: [],
              unknownTopics: [],
              featureAxes: {},
              otherSignals: [{ key: "hands_on_migration", salience: 0.6 }],
            },
            author: null,
          },
        ],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      publishedDigestRegistry: {
        version: 1,
        publicationRecords: [],
        recommendedArticles: [],
      },
      articleFeatureSuggestionHistory: {
        version: 1,
        suggestionRuns: [],
      },
      featureVocabulary: {
        version: 1,
        topics: {},
        feature_axes: {},
        normalizeTopic: () => ({ kind: "unknown_topic", normalizedTopic: "unused" }),
      },
      suggestedAt: "2026-05-16T00:00:00.000Z",
      describer: {
        describe: async () => "実践的な移行手順が含まれている",
      },
      notifier: {
        notify: async () => undefined,
      },
    });

    // Assert
    expect(actual.articleFeatureSuggestionHistory.suggestionRuns[0]?.candidates[0]?.key).toBe(
      "hands_on_migration",
    );
  });
});

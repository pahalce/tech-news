import { describe, expect, it } from "vite-plus/test";

import { parseFeatureVocabularyConfig } from "src/domains/article";
import { runZennDigestUseCase } from "src/features/digest/application/run-zenn-digest-use-case";

describe("Zenn Digest Use Case に関するテスト", () => {
  it("Digest Workflow が成功したとき、更新対象の Registry と History が保存される", async () => {
    // Arrange
    let articleExtractionRegistrySaveCount = 0;
    let publishedDigestRegistrySaveCount = 0;
    let recommendationContentHistorySaveCount = 0;

    // Act
    await runZennDigestUseCase({
      stateRepositories: {
        articleExtractionRegistry: {
          load: async () => ({
            version: 1,
            extractions: [],
            bodyFetchFailures: [],
            failedExtractionAttempts: [],
          }),
          save: async () => {
            articleExtractionRegistrySaveCount += 1;
          },
        },
        preferenceProfile: {
          load: async () => ({
            version: 1,
            weight_range: { min: -3, max: 3 },
            seed_weight_range: { min: -1, max: 1 },
            feature_weights: {
              topics: { typescript: 0.6 },
              feature_axes: { content_types: { implementation_guide: 0.8 } },
            },
            updated_at: null,
          }),
          save: async () => undefined,
        },
        preferenceSummaryHistory: {
          load: async () => ({
            version: 1,
            long_term_summary: null,
            recent_summary: {
              window_days: 7,
              summary: null,
              confidence: "insufficient_feedback",
            },
            history: [],
          }),
          save: async () => undefined,
        },
        publishedDigestRegistry: {
          load: async () => ({
            version: 1,
            publicationRecords: [],
            recommendedArticles: [],
          }),
          save: async () => {
            publishedDigestRegistrySaveCount += 1;
          },
        },
        recommendationContentHistory: {
          load: async () => ({
            version: 1,
            recommendationContents: [],
          }),
          save: async () => {
            recommendationContentHistorySaveCount += 1;
          },
        },
      },
      articleFeatureVocabularyReader: {
        read: async () =>
          parseFeatureVocabularyConfig({
            version: 1,
            topics: {
              typescript: {
                display_name: "TypeScript",
                aliases: ["typescript"],
                description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
              },
            },
            feature_axes: {
              content_types: {
                description_ja: "記事の形式",
                features: {
                  implementation_guide: {
                    description_ja: "実装手順が具体的に説明されている",
                  },
                },
              },
            },
          }),
      },
      feeds: [{ id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" }],
      feedReader: async () => [
        {
          title: "TypeScript implementation",
          url: "https://zenn.dev/example/articles/typescript-implementation",
          publishedAt: null,
        },
      ],
      now: () => "2026-05-14T00:00:00.000Z",
      fetchArticleBody: async () => ({ body: "body", author: null }),
      extractArticleFeatures: async () => ({
        readability: { is_readable: true, reason: null },
        primary_topics: [{ key: "typescript", salience: 1 }],
        mentioned_topics: [],
        feature_axes: {
          content_types: [{ key: "implementation_guide", salience: 1 }],
        },
        other_signals: [],
      }),
      llmReranker: {
        rerank: async ({ topScoredCandidates }) => ({
          selectedArticleIds: topScoredCandidates.map((candidate) => candidate.articleId),
        }),
      },
      recommendationContentCreator: {
        create: async ({ candidate }) => ({
          articleId: candidate.articleId,
          summary: "summary",
          whyRecommended: "why",
          learningPoints: ["learn"],
          signalsUsed: ["typescript"],
        }),
      },
      publisher: {
        publish: async () => ({
          messageId: "message-1",
          channelId: "channel-1",
          postedAt: "2026-05-14T00:01:00.000Z",
        }),
      },
    });

    // Assert
    expect({
      articleExtractionRegistrySaveCount,
      publishedDigestRegistrySaveCount,
      recommendationContentHistorySaveCount,
    }).toEqual({
      articleExtractionRegistrySaveCount: 1,
      publishedDigestRegistrySaveCount: 1,
      recommendationContentHistorySaveCount: 1,
    });
  });
});

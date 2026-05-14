import { describe, expect, it } from "vite-plus/test";

import { parseFeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import { runZennDigestWorkflow } from "./run-zenn-digest-workflow";

describe("Zenn Digest Workflow に関するテスト", () => {
  it("Readable Article が選ばれて Discord 投稿に成功したとき、Recommended Article として保存対象になる", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
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
    });
    const agentState = {
      featureExtractionState: {
        version: 1 as const,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      preferenceProfile: {
        version: 1 as const,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: { typescript: 0.6 },
          feature_axes: { content_types: { implementation_guide: 0.8 } },
        },
        updated_at: null,
      },
      preferenceSummaryHistory: {
        version: 1 as const,
        long_term_summary: "TypeScript の実装記事を好む",
        recent_summary: {
          window_days: 7,
          summary: null,
          confidence: "insufficient_feedback",
        },
        history: [],
      },
      publicationState: {
        version: 1 as const,
        publicationRecords: [],
        recommendedArticles: [],
      },
      recommendationContentState: {
        version: 1 as const,
        recommendationContents: [],
      },
      vocabularySuggestionState: {
        version: 1 as const,
        suggestionRuns: [],
      },
    };

    // Act
    const actual = await runZennDigestWorkflow({
      agentState,
      featureVocabulary,
      feeds: [{ id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" }],
      feedReader: async () => [
        {
          title: "TypeScript の実装記事",
          url: "https://zenn.dev/example/articles/typescript-implementation",
          publishedAt: "2026-05-14T00:00:00.000Z",
        },
      ],
      now: () => "2026-05-14T00:00:00.000Z",
      fetchArticleBody: async () => ({ body: "TypeScript の実装手順を説明する本文" }),
      extractArticleFeatures: async () => ({
        readability: { is_readable: true, reason: null },
        primary_topics: [{ key: "typescript", salience: 0.9 }],
        mentioned_topics: [],
        feature_axes: {
          content_types: [{ key: "implementation_guide", salience: 0.8 }],
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
          summary: "TypeScript の実装要点",
          whyRecommended: "実装手順が具体的だから",
          learningPoints: ["型設計の進め方"],
          signalsUsed: ["typescript", "implementation_guide"],
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
      extractionCount: actual.agentState.featureExtractionState.extractions.length,
      contentCount: actual.agentState.recommendationContentState.recommendationContents.length,
      publicationCount: actual.agentState.publicationState.publicationRecords.length,
      recommendedCount: actual.agentState.publicationState.recommendedArticles.length,
    }).toEqual({
      extractionCount: 1,
      contentCount: 1,
      publicationCount: 1,
      recommendedCount: 1,
    });
  });

  it("スコア対象がないとき、LLM rerank を呼ばず Feature Extraction State を返す", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
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
    });
    let rerankCount = 0;

    // Act
    const actual = await runZennDigestWorkflow({
      agentState: {
        featureExtractionState: {
          version: 1,
          extractions: [],
          bodyFetchFailures: [],
          failedExtractionAttempts: [],
        },
        preferenceProfile: {
          version: 1,
          weight_range: { min: -3, max: 3 },
          seed_weight_range: { min: -1, max: 1 },
          feature_weights: {
            topics: { typescript: 0.6 },
            feature_axes: { content_types: { implementation_guide: 0.8 } },
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
        publicationState: {
          version: 1,
          publicationRecords: [],
          recommendedArticles: [],
        },
        recommendationContentState: {
          version: 1,
          recommendationContents: [],
        },
        vocabularySuggestionState: {
          version: 1,
          suggestionRuns: [],
        },
      },
      featureVocabulary,
      feeds: [{ id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" }],
      feedReader: async () => [
        {
          title: "Unreadable",
          url: "https://zenn.dev/example/articles/unreadable",
          publishedAt: null,
        },
      ],
      now: () => "2026-05-14T00:00:00.000Z",
      fetchArticleBody: async () => ({ body: "body" }),
      extractArticleFeatures: async () => ({
        readability: { is_readable: false, reason: "not an article" },
        primary_topics: [],
        mentioned_topics: [],
        feature_axes: {},
        other_signals: [],
      }),
      llmReranker: {
        rerank: async () => {
          rerankCount += 1;
          return { selectedArticleIds: [] };
        },
      },
      recommendationContentCreator: {
        create: async () => {
          throw new Error("should not create recommendation content");
        },
      },
      publisher: {
        publish: async () => {
          throw new Error("should not publish recommendation content");
        },
      },
    });

    // Assert
    expect(rerankCount).toBe(0);
    expect(actual.agentState.featureExtractionState.extractions).toHaveLength(1);
    expect(actual.agentState.publicationState.recommendedArticles).toHaveLength(0);
  });
});

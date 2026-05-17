import { describe, expect, it } from "vite-plus/test";

import { parseFeatureVocabularyConfig } from "src/domains/article";
import { createCurrentFeedCandidate } from "src/features/digest/application/current-feed-candidate";
import { extractCurrentFeedCandidateFeatures } from "src/features/digest/application/extract-current-feed-candidate-features-use-case";

describe("Feature Extraction use case に関するテスト", () => {
  it("Readable Article を抽出したとき、Feature Extraction が1件保存される", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
        react: {
          display_name: "React",
          aliases: ["react"],
          description_ja: "UI をコンポーネントとして構築するライブラリ",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
        evidence_signals: {
          description_ja: "記事の主張や学びを支える根拠の種類",
          features: {
            code_examples: {
              description_ja: "コード例や設定例があり、内容を具体的に確認できる",
            },
            measured_results: {
              description_ja: "性能、品質、開発効率などを測定した結果が示されている",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article readable-article",
        url: "https://zenn.dev/kazuyataira/articles/readable-article",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => ({
        body: "TypeScript の production 導入事例。コード例と計測結果を含む。",
        author: null,
      }),
      extractArticleFeatures: async () => ({
        readability: {
          is_readable: true,
          reason: null,
        },
        primary_topics: ["TypeScript"],
        mentioned_topics: ["React"],
        feature_axes: {
          content_types: [{ key: "production_case_study", salience: 0.9 }],
          evidence_signals: [
            { key: "code_examples", salience: 0.8 },
            { key: "measured_results", salience: 0.7 },
          ],
        },
        other_signals: [],
      }),
    });

    // Assert
    expect(actual.state.extractions).toHaveLength(1);
  });

  it("本文取得時に著者情報があるとき、Feature Extraction に著者を保存する", async () => {
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
          description_ja: "記事の形式や構成",
          features: {
            implementation_guide: {
              description_ja: "実装手順や設計判断を具体的に説明する記事",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article with-author",
        url: "https://zenn.dev/neet/articles/with-author",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => ({
        body: "本文",
        author: {
          username: "neet",
          displayName: "Ryō Igarashi",
          publicationName: "Gemcook Tech Blog",
        },
      }),
      extractArticleFeatures: async () => ({
        readability: {
          is_readable: true,
          reason: null,
        },
        primary_topics: [],
        mentioned_topics: [],
        feature_axes: {},
        other_signals: [],
      }),
    });

    // Assert
    expect(actual.state.extractions[0]?.author).toEqual({
      username: "neet",
      displayName: "Ryō Igarashi",
      publicationName: "Gemcook Tech Blog",
    });
  });

  it("Readable Article を抽出したとき、Body Fetch Failure は保存されない", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article readable-article",
        url: "https://zenn.dev/kazuyataira/articles/readable-article",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => ({ body: "本文", author: null }),
      extractArticleFeatures: async () => ({
        readability: {
          is_readable: true,
          reason: null,
        },
        primary_topics: ["TypeScript"],
        mentioned_topics: [],
        feature_axes: {},
        other_signals: [],
      }),
    });

    // Assert
    expect(actual.state.bodyFetchFailures).toEqual([]);
  });

  it("Readable Article を抽出したとき、Failed Extraction Attempt は保存されない", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article readable-article",
        url: "https://zenn.dev/kazuyataira/articles/readable-article",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => ({ body: "本文", author: null }),
      extractArticleFeatures: async () => ({
        readability: {
          is_readable: true,
          reason: null,
        },
        primary_topics: ["TypeScript"],
        mentioned_topics: [],
        feature_axes: {},
        other_signals: [],
      }),
    });

    // Assert
    expect(actual.state.failedExtractionAttempts).toEqual([]);
  });

  it("Unreadable Article を抽出したとき、Feature Extraction の Article Features が null として保存される", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article unreadable-article",
        url: "https://zenn.dev/kazuyataira/articles/unreadable-article",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => ({ body: "本文が短い", author: null }),
      extractArticleFeatures: async () => ({
        readability: {
          is_readable: false,
          reason: "本文が短すぎて Article Features を信頼できない",
        },
        primary_topics: [],
        mentioned_topics: [],
        feature_axes: {},
        other_signals: [],
      }),
    });

    // Assert
    expect(actual.state.extractions[0]?.articleFeatures).toBeNull();
  });

  it("Unreadable Article が既に抽出済みのとき、再抽出されない", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article unreadable-article",
        url: "https://zenn.dev/kazuyataira/articles/unreadable-article",
        publishedAt: null,
      },
    );
    let fetchCount = 0;

    // Act
    await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [
          {
            articleId: candidate.articleId,
            extractedAt: "2026-05-12T00:00:00.000Z",
            readability: {
              isReadable: false,
              reason: "本文が短すぎて Article Features を信頼できない",
            },
            articleFeatures: null,
            author: null,
          },
        ],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => {
        fetchCount += 1;
        return { body: "再取得されない本文", author: null };
      },
      extractArticleFeatures: async () => {
        throw new Error("should not extract unreadable article again");
      },
    });

    // Assert
    expect(fetchCount).toBe(0);
  });

  it("Readable Article が既に抽出済みのとき、再抽出されない", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article already-extracted",
        url: "https://zenn.dev/kazuyataira/articles/already-extracted",
        publishedAt: null,
      },
    );
    let fetchCount = 0;

    // Act
    await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [
          {
            articleId: candidate.articleId,
            extractedAt: "2026-05-12T00:00:00.000Z",
            readability: {
              isReadable: true,
              reason: null,
            },
            articleFeatures: {
              primaryTopics: [{ key: "typescript", salience: 1 }],
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
      featureVocabulary,
      now: () => "2026-05-13T00:00:00.000Z",
      fetchArticleBody: async () => {
        fetchCount += 1;
        return { body: "再取得されない本文", author: null };
      },
      extractArticleFeatures: async () => {
        throw new Error("should not extract existing article again");
      },
    });

    // Assert
    expect(fetchCount).toBe(0);
  });

  it("本文取得に失敗したとき、Body Fetch Failure が保存される", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article fetch-failure",
        url: "https://zenn.dev/kazuyataira/articles/fetch-failure",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T01:00:00.000Z",
      fetchArticleBody: async () => {
        throw new Error("article body timeout");
      },
      extractArticleFeatures: async () => {
        throw new Error("should not call LLM when body fetch fails");
      },
    });

    // Assert
    expect(actual.state.bodyFetchFailures).toEqual([
      {
        articleId: candidate.articleId,
        failedAt: "2026-05-13T01:00:00.000Z",
        message: "article body timeout",
      },
    ]);
  });

  it("本文取得が空文字で失敗したとき、検証エラーとなる", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article empty-fetch-failure",
        url: "https://zenn.dev/kazuyataira/articles/empty-fetch-failure",
        publishedAt: null,
      },
    );

    // Act
    const actual = extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T01:00:00.000Z",
      fetchArticleBody: async () => {
        throw "";
      },
      extractArticleFeatures: async () => {
        throw new Error("should not call LLM when body fetch fails");
      },
    });

    // Assert
    await expect(actual).rejects.toThrow("fetch failure message must not be empty");
  });

  it("LLM Feature Extraction が失敗したとき、Failed Extraction Attempt が保存される", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article llm-failure",
        url: "https://zenn.dev/kazuyataira/articles/llm-failure",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
      featureVocabulary,
      now: () => "2026-05-13T02:00:00.000Z",
      fetchArticleBody: async () => ({ body: "本文は取得できた", author: null }),
      extractArticleFeatures: async () => {
        throw new Error("LLM unavailable");
      },
    });

    // Assert
    expect(actual.state.failedExtractionAttempts).toEqual([
      {
        articleId: candidate.articleId,
        attemptedAt: "2026-05-13T02:00:00.000Z",
        message: "LLM unavailable",
      },
    ]);
  });

  it("LLM Feature Extraction が失敗済みのとき、次回 Current Feed Candidate で再試行される", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article llm-failure",
        url: "https://zenn.dev/kazuyataira/articles/llm-failure",
        publishedAt: null,
      },
    );

    // Act
    const actual = await extractCurrentFeedCandidateFeatures({
      candidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [
          {
            articleId: candidate.articleId,
            attemptedAt: "2026-05-13T02:00:00.000Z",
            message: "LLM unavailable",
          },
        ],
      },
      featureVocabulary,
      now: () => "2026-05-13T03:00:00.000Z",
      fetchArticleBody: async () => ({ body: "再試行する本文", author: null }),
      extractArticleFeatures: async () => ({
        readability: {
          is_readable: true,
          reason: null,
        },
        primary_topics: ["TypeScript"],
        mentioned_topics: [],
        feature_axes: {},
        other_signals: [],
      }),
    });

    // Assert
    expect(actual.state.extractions).toHaveLength(1);
  });

  it("Feature Extraction 対象内の進捗を LLM 抽出に渡す", async () => {
    // Arrange
    const featureVocabulary = parseFeatureVocabularyConfig({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript", "ts"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            production_case_study: {
              description_ja: "実際のプロダクトや本番環境での事例紹介",
            },
          },
        },
      },
    });
    const existingCandidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article already-extracted",
        url: "https://zenn.dev/kazuyataira/articles/already-extracted",
        publishedAt: null,
      },
    );
    const firstTargetCandidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article first-target",
        url: "https://zenn.dev/kazuyataira/articles/first-target",
        publishedAt: null,
      },
    );
    const secondTargetCandidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Article second-target",
        url: "https://zenn.dev/kazuyataira/articles/second-target",
        publishedAt: null,
      },
    );
    const progressValues: { index: number; total: number }[] = [];

    // Act
    await extractCurrentFeedCandidateFeatures({
      candidates: [existingCandidate, firstTargetCandidate, secondTargetCandidate],
      featureExtractionState: {
        version: 1,
        extractions: [
          {
            articleId: existingCandidate.articleId,
            extractedAt: "2026-05-13T00:00:00.000Z",
            readability: {
              isReadable: true,
              reason: null,
            },
            articleFeatures: {
              primaryTopics: [{ key: "typescript", salience: 1 }],
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
      featureVocabulary,
      now: () => "2026-05-13T03:00:00.000Z",
      fetchArticleBody: async () => ({ body: "本文", author: null }),
      extractArticleFeatures: async ({ progress }) => {
        progressValues.push(progress);
        return {
          readability: {
            is_readable: true,
            reason: null,
          },
          primary_topics: ["TypeScript"],
          mentioned_topics: [],
          feature_axes: {},
          other_signals: [],
        };
      },
    });

    // Assert
    expect(progressValues).toEqual([
      { index: 1, total: 2 },
      { index: 2, total: 2 },
    ]);
  });
});

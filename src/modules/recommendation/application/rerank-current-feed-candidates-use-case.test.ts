import { describe, expect, it } from "vite-plus/test";

import { rerankCurrentFeedCandidates } from "./rerank-current-feed-candidates-use-case";

describe("LLM Rerank use case に関するテスト", () => {
  it("品質が十分な候補だけ返されたとき、10件未満の選択結果となる", async () => {
    // Arrange
    const scoredCandidates = [
      createScoredCandidate("zenn:typescript", "TypeScript 深掘り", 0.9, ["typescript"]),
      createScoredCandidate("zenn:react", "React 実装", 0.8, ["react"]),
      createScoredCandidate("zenn:thin", "薄い記事", 0.7, ["typescript"]),
    ];
    const llmReranker = {
      rerank: async () => ({
        selectedArticleIds: ["zenn:typescript", "zenn:react"],
      }),
    };

    // Act
    const actual = await rerankCurrentFeedCandidates({
      scoredCandidates,
      longTermPreferenceSummary: "実装から学べる TypeScript 記事を好む",
      recentPreferenceSummary: "React の実務的な話題への反応が強い",
      qualityCriteria: ["薄い紹介記事を避ける", "同じ Primary Topic に偏らせない"],
      llmReranker,
    });

    // Assert
    expect(actual.selectedCandidates.map((candidate) => candidate.articleId)).toEqual([
      "zenn:typescript",
      "zenn:react",
    ]);
  });

  it("重複 Topic 回避の品質基準を渡したとき、候補の Primary Topic とともに Rerank 入力へ渡される", async () => {
    // Arrange
    const scoredCandidates = [
      createScoredCandidate("zenn:typescript-a", "TypeScript A", 0.9, ["typescript"]),
      createScoredCandidate("zenn:typescript-b", "TypeScript B", 0.8, ["typescript"]),
    ];
    const receivedInputs: unknown[] = [];
    const llmReranker = {
      rerank: async (input: unknown) => {
        receivedInputs.push(input);
        return { selectedArticleIds: ["zenn:typescript-a"] };
      },
    };

    // Act
    await rerankCurrentFeedCandidates({
      scoredCandidates,
      longTermPreferenceSummary: null,
      recentPreferenceSummary: null,
      qualityCriteria: ["同じ Primary Topic の記事を必要以上に重複させない"],
      llmReranker,
    });

    // Assert
    expect(receivedInputs).toEqual([
      {
        topScoredCandidates: [
          {
            articleId: "zenn:typescript-a",
            title: "TypeScript A",
            canonicalUrl: "https://zenn.dev/example/articles/zenn-typescript-a",
            ruleScore: 0.9,
            primaryTopics: ["typescript"],
          },
          {
            articleId: "zenn:typescript-b",
            title: "TypeScript B",
            canonicalUrl: "https://zenn.dev/example/articles/zenn-typescript-b",
            ruleScore: 0.8,
            primaryTopics: ["typescript"],
          },
        ],
        longTermPreferenceSummary: null,
        recentPreferenceSummary: null,
        qualityCriteria: ["同じ Primary Topic の記事を必要以上に重複させない"],
        maxRecommendations: 10,
      },
    ]);
  });
});

function createScoredCandidate(
  articleId: string,
  title: string,
  ruleScore: number,
  primaryTopics: string[],
) {
  return {
    articleId,
    source: "zenn",
    canonicalUrl: `https://zenn.dev/example/articles/${articleId.replace(":", "-")}`,
    title,
    feedIds: ["zenn-trend"],
    firstSeenInCurrentFeedsAt: null,
    ruleScore,
    articleFeatures: {
      primaryTopics: primaryTopics.map((key) => ({ key, salience: 0.9 })),
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {},
      otherSignals: [],
    },
  };
}

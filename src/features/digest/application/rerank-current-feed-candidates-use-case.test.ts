import { describe, expect, it } from "vite-plus/test";

import { rerankCurrentFeedCandidates } from "src/features/digest/application/rerank-current-feed-candidates-use-case";

describe("LLM Rerank use case に関するテスト", () => {
  it("品質が十分な候補だけ返されたとき、3件未満の選択結果となる", async () => {
    // Arrange
    const scoredCandidates = [
      createScoredCandidate("6".repeat(64), "TypeScript 深掘り", 0.9, ["typescript"]),
      createScoredCandidate("7".repeat(64), "React 実装", 0.8, ["react"]),
      createScoredCandidate("8".repeat(64), "薄い記事", 0.7, ["typescript"]),
    ];
    const llmReranker = {
      rerank: async () => ({
        selectedArticleIds: ["6".repeat(64), "7".repeat(64)],
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
      "6".repeat(64),
      "7".repeat(64),
    ]);
  });

  it("重複 Topic 回避の品質基準を渡したとき、候補の Primary Topic とともに Rerank 入力へ渡される", async () => {
    // Arrange
    const scoredCandidates = [
      createScoredCandidate("4".repeat(64), "TypeScript A", 0.9, ["typescript"]),
      createScoredCandidate("5".repeat(64), "TypeScript B", 0.8, ["typescript"]),
    ];
    const receivedInputs: unknown[] = [];
    const llmReranker = {
      rerank: async (input: unknown) => {
        receivedInputs.push(input);
        return { selectedArticleIds: ["4".repeat(64)] };
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
            articleId: "4".repeat(64),
            title: "TypeScript A",
            canonicalUrl:
              "https://zenn.dev/example/articles/4444444444444444444444444444444444444444444444444444444444444444",
            ruleScore: 0.9,
            primaryTopics: ["typescript"],
          },
          {
            articleId: "5".repeat(64),
            title: "TypeScript B",
            canonicalUrl:
              "https://zenn.dev/example/articles/5555555555555555555555555555555555555555555555555555555555555555",
            ruleScore: 0.8,
            primaryTopics: ["typescript"],
          },
        ],
        longTermPreferenceSummary: null,
        recentPreferenceSummary: null,
        qualityCriteria: ["同じ Primary Topic の記事を必要以上に重複させない"],
        maxRecommendations: 3,
      },
    ]);
  });

  it("LLM が4件以上返しても、最終的な選択結果は最大3件に制限する", async () => {
    // Arrange
    const scoredCandidates = [
      createScoredCandidate("6".repeat(64), "TypeScript 深掘り", 0.9, ["typescript"]),
      createScoredCandidate("7".repeat(64), "React 実装", 0.8, ["react"]),
      createScoredCandidate("9".repeat(64), "Next.js 実装", 0.7, ["nextjs"]),
      createScoredCandidate("0".repeat(64), "Backend 実装", 0.6, ["backend"]),
    ];
    const llmReranker = {
      rerank: async () => ({
        selectedArticleIds: ["6".repeat(64), "7".repeat(64), "9".repeat(64), "0".repeat(64)],
      }),
    };

    // Act
    const actual = await rerankCurrentFeedCandidates({
      scoredCandidates,
      longTermPreferenceSummary: null,
      recentPreferenceSummary: null,
      qualityCriteria: [],
      llmReranker,
    });

    // Assert
    expect(actual.selectedCandidates.map((candidate) => candidate.articleId)).toEqual([
      "6".repeat(64),
      "7".repeat(64),
      "9".repeat(64),
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

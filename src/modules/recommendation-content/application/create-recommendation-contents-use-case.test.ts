import { describe, expect, it } from "vite-plus/test";

import { createRecommendationContents } from "./create-recommendation-contents-use-case";

describe("Recommendation Content 作成 use case に関するテスト", () => {
  it("選択済み候補を渡したとき、選択済み候補だけ Recommendation Content が作成される", async () => {
    // Arrange
    const selectedCandidates = [
      createSelectedCandidate(articleIdA, "選択 A"),
      createSelectedCandidate(articleIdB, "選択 B"),
    ];
    const createdArticleIds: string[] = [];
    const recommendationContentCreator = {
      create: async ({ candidate }: { candidate: { articleId: string; title: string } }) => {
        createdArticleIds.push(candidate.articleId);
        return {
          articleId: candidate.articleId,
          summary: `${candidate.title} の要約`,
          whyRecommended: "Owner の嗜好に合うため",
          learningPoints: ["実装判断を学べる"],
          signalsUsed: ["typescript"],
        };
      },
    };

    // Act
    const actual = await createRecommendationContents({
      selectedCandidates,
      recommendationContentCreator,
    });

    // Assert
    expect(actual.recommendationContents.map((content) => content.articleId)).toEqual([
      articleIdA,
      articleIdB,
    ]);
  });

  it("Feature Extraction を渡したとき、Recommendation Content は別の出力として作成される", async () => {
    // Arrange
    const selectedCandidates = [createSelectedCandidate(articleIdA, "選択記事")];
    const featureExtraction = {
      articleId: articleIdA,
      extractedAt: "2026-05-13T00:00:00.000Z",
      readability: {
        isReadable: true,
        reason: null,
      },
      articleFeatures: selectedCandidates[0]?.articleFeatures ?? null,
    };
    const recommendationContentCreator = {
      create: async () => ({
        articleId: articleIdA,
        summary: "本文の要約",
        whyRecommended: "長期嗜好に合うため",
        learningPoints: ["設計の勘所"],
        signalsUsed: ["typescript", "implementation_guide"],
      }),
    };

    // Act
    const actual = await createRecommendationContents({
      selectedCandidates,
      featureExtractions: [featureExtraction],
      recommendationContentCreator,
    });

    // Assert
    expect(actual).toEqual({
      recommendationContents: [
        {
          articleId: articleIdA,
          summary: "本文の要約",
          whyRecommended: "長期嗜好に合うため",
          learningPoints: ["設計の勘所"],
          signalsUsed: ["typescript", "implementation_guide"],
        },
      ],
      featureExtractions: [featureExtraction],
    });
  });

  it("Recommendation Content の Article ID が候補と異なるとき、整合性エラーとなる", async () => {
    // Arrange
    const selectedCandidates = [createSelectedCandidate(articleIdA, "選択記事")];
    const recommendationContentCreator = {
      create: async () => ({
        articleId: articleIdB,
        summary: "本文の要約",
        whyRecommended: "長期嗜好に合うため",
        learningPoints: ["設計の勘所"],
        signalsUsed: ["typescript"],
      }),
    };

    // Act
    const actual = createRecommendationContents({
      selectedCandidates,
      recommendationContentCreator,
    });

    // Assert
    await expect(actual).rejects.toThrow(
      "Recommendation Content Article ID must match selected candidate Article ID.",
    );
  });
});

const articleIdA = `zenn:${"a".repeat(64)}`;
const articleIdB = `zenn:${"b".repeat(64)}`;

function createSelectedCandidate(articleId: string, title: string) {
  return {
    articleId,
    source: "zenn",
    canonicalUrl: `https://zenn.dev/example/articles/${articleId.replace(":", "-")}`,
    title,
    feedIds: ["zenn-trend"],
    firstSeenInCurrentFeedsAt: null,
    ruleScore: 0.9,
    articleFeatures: {
      primaryTopics: [{ key: "typescript", salience: 0.9 }],
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "implementation_guide", salience: 0.8 }],
      },
      otherSignals: [],
    },
  };
}

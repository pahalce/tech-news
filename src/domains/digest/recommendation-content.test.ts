import { describe, expect, it } from "vite-plus/test";

import { parseRecommendationContent } from "src/domains/digest";

describe("Recommendation Content に関するテスト", () => {
  it("不正な Article ID を渡したとき、バリデーションエラーとなる", () => {
    // Arrange
    const input = {
      articleId: "zenn:invalid",
      summary: "本文の要約",
      whyRecommended: "Owner の嗜好に合うため",
      learningPoints: ["実装判断を学べる"],
      signalsUsed: ["typescript"],
    };

    // Act
    const actual = () => parseRecommendationContent(input);

    // Assert
    expect(actual).toThrow("Article ID must be a Canonical URL hash.");
  });
});

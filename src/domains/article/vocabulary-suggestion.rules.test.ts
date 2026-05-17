import { describe, expect, it } from "vite-plus/test";

import {
  isInsideArticleFeatureSuggestionLookbackWindow,
  meetsArticleFeaturePromotionThreshold,
} from "src/domains/article";

describe("Article Feature Suggestion Rules に関するテスト", () => {
  it("抽出日時が提案日時から7日以内のとき、提案対象期間内となる", () => {
    // Arrange
    const extractedAt = "2026-05-10T00:00:00.000Z";

    // Act
    const actual = isInsideArticleFeatureSuggestionLookbackWindow(
      extractedAt,
      "2026-05-17T00:00:00.000Z",
    );

    // Assert
    expect(actual).toBe(true);
  });

  it("Other Signal の出現回数が2回のとき、昇格候補となる", () => {
    // Arrange
    const occurrence = { count: 2, maxSalience: 0.1 };

    // Act
    const actual = meetsArticleFeaturePromotionThreshold(occurrence, "other_signal");

    // Assert
    expect(actual).toBe(true);
  });
});

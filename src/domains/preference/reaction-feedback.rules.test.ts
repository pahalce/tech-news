import { describe, expect, it } from "vite-plus/test";

import {
  isInsideFeedbackCollectionWindow,
  readReactionFeedbackWeight,
  shouldIgnoreContradictoryReactionFeedback,
} from "src/domains/preference";

describe("Reaction Feedback Rules に関するテスト", () => {
  it("投稿日から3日以内に収集したとき、Feedback Collection Window 内となる", () => {
    // Arrange
    const postedAt = "2026-05-14T00:00:00.000Z";

    // Act
    const actual = isInsideFeedbackCollectionWindow(postedAt, "2026-05-17T00:00:00.000Z");

    // Assert
    expect(actual).toBe(true);
  });

  it("正負両方の Reaction があるとき、矛盾 Feedback として無視対象となる", () => {
    // Arrange
    const snapshot = { positiveCount: 1, negativeCount: 1 };

    // Act
    const actual = shouldIgnoreContradictoryReactionFeedback(snapshot);

    // Assert
    expect(actual).toBe(true);
  });

  it("正の Reaction Feedback kind を渡したとき、正の重みとなる", () => {
    // Arrange
    const kind = "positive";

    // Act
    const actual = readReactionFeedbackWeight(kind);

    // Assert
    expect(actual).toBe(1);
  });
});

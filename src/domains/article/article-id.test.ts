import { describe, expect, it } from "vite-plus/test";

import { parseArticleId } from "src/domains/article";

describe("Article ID に関するテスト", () => {
  it("Canonical URL hash だけからなる Article ID を受け付ける", () => {
    // Arrange
    const articleId = "a".repeat(64);

    // Act
    const actual = parseArticleId(articleId);

    // Assert
    expect(actual).toBe(articleId);
  });

  it("source prefix 付き Article ID を渡したとき、検証エラーとなる", () => {
    // Arrange
    const articleId = `zenn:${"a".repeat(64)}`;

    // Act
    const actual = () => parseArticleId(articleId);

    // Assert
    expect(actual).toThrow("Article ID must be a Canonical URL hash.");
  });

  it("Article ID の形式が不正なとき、検証エラーとなる", () => {
    // Arrange
    const articleId = "zenn:not-a-hash";

    // Act
    const actual = () => parseArticleId(articleId);

    // Assert
    expect(actual).toThrow("Article ID must be a Canonical URL hash.");
  });
});

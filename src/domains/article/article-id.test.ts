import { describe, expect, it } from "vite-plus/test";

import { parseArticleId } from "src/domains/article";

describe("Article ID に関するテスト", () => {
  it("source と Canonical URL hash からなる Article ID を受け付ける", () => {
    // Act
    const actual = parseArticleId(`zenn:${"a".repeat(64)}`);

    // Assert
    expect(actual).toBe(`zenn:${"a".repeat(64)}`);
  });

  it("Article ID の形式が不正なとき、検証エラーとなる", () => {
    // Act
    const actual = () => parseArticleId("zenn:not-a-hash");

    // Assert
    expect(actual).toThrow("Article ID must be source plus Canonical URL hash.");
  });
});

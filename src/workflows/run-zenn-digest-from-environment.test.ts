import { describe, expect, it } from "vite-plus/test";

import {
  formatDiscordMessage,
  type DiscordRecommendationContent,
} from "./run-zenn-digest-from-environment";

function createDiscordRecommendationContent(
  overrides: Partial<DiscordRecommendationContent> = {},
): DiscordRecommendationContent {
  return {
    articleId: `zenn:${"a".repeat(64)}`,
    canonicalUrl: "https://zenn.dev/example/articles/sample",
    title: "Claude Code派だった僕がCodexに移る前に知りたかったこと",
    summary: "Claude CodeからCodexへの移行体験記。ツール比較と設定の勘所を解説。",
    whyRecommended:
      "AIエージェントを比較検討している方に、実体験ベースの設定の注意点が参考になる。",
    learningPoints: [
      "Codexはサンドボックス実行がデフォルトで、Claude Codeは都度承認後にシェル実行する。",
      "移行時はスラッシュコマンドの対応表を用意しないと日常操作が止まる。",
    ],
    signalsUsed: ["comparison_evaluation", "configuration_best_practices"],
    ...overrides,
  };
}

describe("formatDiscordMessage に関するテスト", () => {
  it("記事タイトルを先頭の太字リンクにする", () => {
    // Arrange
    const content = createDiscordRecommendationContent();

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual.startsWith("**[Claude Code派だった僕がCodexに移る前に知りたかったこと]")).toBe(
      true,
    );
  });

  it("要約を太字見出しの直下に置く", () => {
    // Arrange
    const content = createDiscordRecommendationContent();

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual).toContain("**要約**\nClaude CodeからCodexへの移行体験記。");
  });

  it("推薦理由と学びのセクション見出しを太字にする", () => {
    // Arrange
    const content = createDiscordRecommendationContent();

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual).toContain("**推薦理由**");
    expect(actual).toContain("**この記事から得られる学び**");
  });

  it("学びの箇条書きを中黒で出力する", () => {
    // Arrange
    const content = createDiscordRecommendationContent();

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual).toContain("• Codexはサンドボックス実行がデフォルトで、");
  });

  it("Signals を斜体ラベルで末尾寄せにする", () => {
    // Arrange
    const content = createDiscordRecommendationContent();

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual).toContain("_Signals:_ comparison_evaluation, configuration_best_practices");
  });
});

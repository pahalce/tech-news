import { describe, expect, it } from "vite-plus/test";

import {
  formatDiscordMessage,
  type DiscordRecommendationContent,
} from "src/features/digest/presentation/run-zenn-digest";

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

  it("末尾にプレビュー用の素の URL を載せる", () => {
    // Arrange
    const content = createDiscordRecommendationContent();

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual.endsWith("https://zenn.dev/example/articles/sample")).toBe(true);
  });

  it("著者情報があるとき、URL の直前に控えめな著者行を載せる", () => {
    // Arrange
    const content = createDiscordRecommendationContent({
      canonicalUrl: "https://zenn.dev/neet/articles/031d5499e68685",
      author: {
        username: "neet",
        displayName: "Ryō Igarashi",
        publicationName: "Gemcook Tech Blog",
      },
    });

    // Act
    const actual = formatDiscordMessage(content);

    // Assert
    expect(actual).toContain("_著者:_ Ryō Igarashi · Gemcook Tech Blog (@neet)\n");
    expect(actual.endsWith("https://zenn.dev/neet/articles/031d5499e68685")).toBe(true);
  });
});

import { describe, expect, it } from "vite-plus/test";

import type { VocabularyPromotionCandidate } from "src/modules/vocabulary-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import {
  DISCORD_MESSAGE_CONTENT_MAX_LENGTH,
  formatDiscordVocabularySuggestionMessages,
  formatDiscordVocabularyThreadName,
  formatDiscordVocabularyThreadStarterContent,
} from "src/workflows/run-suggest-feature-vocabulary";

function createCandidate(
  overrides: Partial<VocabularyPromotionCandidate> = {},
): VocabularyPromotionCandidate {
  return {
    key: "example-signal",
    descriptionJa: "例の昇格候補",
    occurrenceCount: 2,
    representativeArticleIds: ["zenn:" + "a".repeat(64)],
    relatedFeedbackCount: 0,
    recommendedAction: "Feature Axis への追加を検討",
    ...overrides,
  };
}

describe("Discord vocabulary suggestion thread に関するテスト", () => {
  it("suggestedAt からスレッド名を作る", () => {
    // Arrange
    const suggestedAt = "2026-05-16T08:30:00.000Z";

    // Act
    const actual = formatDiscordVocabularyThreadName(suggestedAt);

    // Assert
    expect(actual).toBe("昇格候補 2026-05-16");
  });

  it("候補がないとき、親チャンネル用の短い案内文を返す", () => {
    // Arrange
    const candidates: VocabularyPromotionCandidate[] = [];

    // Act
    const actual = formatDiscordVocabularyThreadStarterContent(candidates);

    // Assert
    expect(actual).toContain("候補はありません");
    expect(actual).toContain("スレッド");
  });

  it("候補があるとき、件数付きの案内文を返す", () => {
    // Arrange
    const candidates = [createCandidate(), createCandidate({ key: "other-signal" })];

    // Act
    const actual = formatDiscordVocabularyThreadStarterContent(candidates);

    // Assert
    expect(actual).toContain("2 件");
    expect(actual).toContain("スレッド");
  });
});

describe("Discord vocabulary suggestion messages に関するテスト", () => {
  it("候補がないとき、候補なしメッセージを 1 件返す", () => {
    // Arrange
    const candidates: VocabularyPromotionCandidate[] = [];

    // Act
    const actual = formatDiscordVocabularySuggestionMessages(candidates);

    // Assert
    expect(actual).toEqual(["今週の Feature Vocabulary 昇格候補はありません。"]);
  });

  it("候補が少ないとき、1 件のメッセージにまとめる", () => {
    // Arrange
    const candidates = [createCandidate()];

    // Act
    const actual = formatDiscordVocabularySuggestionMessages(candidates);

    // Assert
    expect(actual).toHaveLength(1);
    expect(actual[0]).toContain("example-signal");
  });

  it("候補が多いとき、Discord の文字数上限以内で複数メッセージに分割する", () => {
    // Arrange
    const candidates = Array.from({ length: 80 }, (_, index) =>
      createCandidate({
        key: `signal-${index}`,
        descriptionJa: "長めの説明文".repeat(20),
        representativeArticleIds: [
          `zenn:${String(index).padStart(64, "0")}`,
          `zenn:${String(index + 1).padStart(64, "1")}`,
          `zenn:${String(index + 2).padStart(64, "2")}`,
        ],
      }),
    );

    // Act
    const actual = formatDiscordVocabularySuggestionMessages(candidates);

    // Assert
    expect(actual.length).toBeGreaterThan(1);
    expect(actual.every((message) => message.length <= DISCORD_MESSAGE_CONTENT_MAX_LENGTH)).toBe(
      true,
    );
  });

  it("1 件の候補だけが上限を超えるとき、切り詰めた 1 件のメッセージを返す", () => {
    // Arrange
    const candidates = [
      createCandidate({
        descriptionJa: "長".repeat(DISCORD_MESSAGE_CONTENT_MAX_LENGTH),
      }),
    ];

    // Act
    const actual = formatDiscordVocabularySuggestionMessages(candidates);

    // Assert
    expect(actual).toHaveLength(1);
    expect(actual[0]!.length).toBeLessThanOrEqual(DISCORD_MESSAGE_CONTENT_MAX_LENGTH);
    expect(actual[0]).toContain("…");
  });
});

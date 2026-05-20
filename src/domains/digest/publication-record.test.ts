import { describe, expect, it } from "vite-plus/test";

import { parsePublishedDigestRegistry, recordPublishedDigestItem } from "src/domains/digest";

describe("Published Digest Registry に関するテスト", () => {
  it("Published Digest Item を記録すると Publication Record と Recommended Article が作成される", () => {
    // Arrange
    const registry = createRegistry();

    // Act
    const actual = recordPublishedDigestItem(registry, {
      articleId,
      deliveryReference,
      publishedAt: "2026-05-14T00:00:00.000Z",
    });

    // Assert
    expect(actual.publicationRecords).toHaveLength(1);
    expect(actual.publicationRecords[0]?.deliveryReference).toEqual(deliveryReference);
    expect(actual.recommendedArticles).toEqual([
      { articleId, firstRecommendedAt: "2026-05-14T00:00:00.000Z" },
    ]);
  });

  it("同じ Article Identity と Delivery Reference の Published Digest Item は重複記録しない", () => {
    // Arrange
    const registry = recordPublishedDigestItem(createRegistry(), {
      articleId,
      deliveryReference,
      publishedAt: "2026-05-14T00:00:00.000Z",
    });

    // Act
    const actual = recordPublishedDigestItem(registry, {
      articleId,
      deliveryReference,
      publishedAt: "2026-05-14T01:00:00.000Z",
    });

    // Assert
    expect(actual.publicationRecords).toHaveLength(1);
    expect(actual.recommendedArticles).toEqual([
      { articleId, firstRecommendedAt: "2026-05-14T00:00:00.000Z" },
    ]);
  });

  it("旧保存形式の Discord message identity を Delivery Reference として復元する", () => {
    // Act
    const actual = parsePublishedDigestRegistry({
      version: 1,
      publicationRecords: [
        {
          articleId,
          messageId: "message-1",
          channelId: "channel-1",
          postedAt: "2026-05-14T00:00:00.000Z",
          reactionFeedback: [],
        },
      ],
      recommendedArticles: [],
    });

    // Assert
    expect(actual.publicationRecords[0]?.deliveryReference).toEqual(deliveryReference);
  });
});

const articleId = "a".repeat(64);
const deliveryReference = {
  externalSystem: "discord",
  destination: "channel-1",
  id: "message-1",
} as const;

function createRegistry() {
  return {
    version: 1 as const,
    publicationRecords: [],
    recommendedArticles: [],
  };
}

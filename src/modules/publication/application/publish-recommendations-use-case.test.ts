import { describe, expect, it } from "vite-plus/test";

import { publishRecommendations } from "src/modules/publication/application/publish-recommendations-use-case";

describe("Recommendation Publication use case に関するテスト", () => {
  it("選択記事をすべて publish できたとき、Publication Record と Recommended Article が作成される", async () => {
    // Arrange
    const recommendationContents = [createRecommendationContent(articleIdA)];
    const publisher = {
      publish: async () => ({
        messageId: "message-1",
        channelId: "channel-1",
        postedAt: "2026-05-13T00:00:00.000Z",
      }),
    };

    // Act
    const actual = await publishRecommendations({ recommendationContents, publisher });

    // Assert
    expect(actual.publicationRecords[0]).toEqual({
      articleId: articleIdA,
      messageId: "message-1",
      channelId: "channel-1",
      postedAt: "2026-05-13T00:00:00.000Z",
      reactionFeedback: [
        { emoji: "👍", userIds: [], processedAt: null, ignoredReason: null },
        { emoji: "👎", userIds: [], processedAt: null, ignoredReason: null },
      ],
    });
  });

  it("選択記事をすべて publish できたとき、firstRecommendedAt が postedAt となる", async () => {
    // Arrange
    const recommendationContents = [createRecommendationContent(articleIdA)];
    const publisher = {
      publish: async () => ({
        messageId: "message-1",
        channelId: "channel-1",
        postedAt: "2026-05-13T00:00:00.000Z",
      }),
    };

    // Act
    const actual = await publishRecommendations({ recommendationContents, publisher });

    // Assert
    expect(actual.recommendedArticles[0]).toEqual({
      articleId: articleIdA,
      firstRecommendedAt: "2026-05-13T00:00:00.000Z",
    });
  });

  it("一部の publish が失敗したとき、成功した記事だけ Publication Record が作成される", async () => {
    // Arrange
    const recommendationContents = [
      createRecommendationContent(articleIdA),
      createRecommendationContent(articleIdB),
    ];
    const publisher = {
      publish: async ({
        recommendationContent,
      }: {
        recommendationContent: { articleId: string };
      }) => {
        if (recommendationContent.articleId === articleIdB) {
          throw new Error("Discord API error");
        }

        return {
          messageId: "message-1",
          channelId: "channel-1",
          postedAt: "2026-05-13T00:00:00.000Z",
        };
      },
    };

    // Act
    const actual = await publishRecommendations({ recommendationContents, publisher });

    // Assert
    expect(actual.publicationRecords.map((record) => record.articleId)).toEqual([articleIdA]);
  });

  it("publish が失敗したとき、失敗理由を通知する", async () => {
    // Arrange
    const failures: Array<{ articleId: string; message: string }> = [];
    const recommendationContents = [createRecommendationContent(articleIdA)];
    const publisher = {
      publish: async () => {
        throw new Error("Discord publish failed: 403 Forbidden");
      },
    };

    // Act
    await publishRecommendations({
      recommendationContents,
      publisher,
      onPublishFailure: (failure) => failures.push(failure),
    });

    // Assert
    expect(failures).toEqual([
      { articleId: articleIdA, message: "Discord publish failed: 403 Forbidden" },
    ]);
  });

  it("publish が Error 以外で失敗したとき、失敗理由を文字列化して通知する", async () => {
    // Arrange
    const failures: Array<{ articleId: string; message: string }> = [];
    const recommendationContents = [createRecommendationContent(articleIdA)];
    const publisher = {
      publish: async () => {
        throw "discord unavailable";
      },
    };

    // Act
    await publishRecommendations({
      recommendationContents,
      publisher,
      onPublishFailure: (failure) => failures.push(failure),
    });

    // Assert
    expect(failures).toEqual([{ articleId: articleIdA, message: "discord unavailable" }]);
  });

  it("すべての publish が失敗したとき、Recommended Article が作成されない", async () => {
    // Arrange
    const recommendationContents = [createRecommendationContent(articleIdA)];
    const publisher = {
      publish: async () => {
        throw new Error("Discord API error");
      },
    };

    // Act
    const actual = await publishRecommendations({ recommendationContents, publisher });

    // Assert
    expect(actual.recommendedArticles).toEqual([]);
  });
});

const articleIdA = `zenn:${"a".repeat(64)}`;
const articleIdB = `zenn:${"b".repeat(64)}`;

function createRecommendationContent(articleId: string) {
  return {
    articleId,
    canonicalUrl: `https://zenn.dev/example/articles/${articleId.replace(":", "-")}`,
    title: "TypeScript の実装記事",
    summary: "本文の要約",
    whyRecommended: "Owner の嗜好に合うため",
    learningPoints: ["実装判断を学べる"],
    signalsUsed: ["typescript"],
  };
}

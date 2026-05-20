import { describe, expect, it } from "vite-plus/test";

import { createCompositeArticleFeedReader } from "src/features/digest/infrastructure/composite-article-feed-reader";

describe("Composite Article Feed Reader に関するテスト", () => {
  it("feed reader 種別を渡したとき、対応する source-specific reader に委譲する", async () => {
    // Arrange
    const feed = {
      id: "hatena-blog-topic-technology",
      source: "hatena_blog",
      reader: "hatena_blog_topic",
      url: "https://blog.hatena.ne.jp/-/topics/technology",
    } as const;
    const reader = createCompositeArticleFeedReader({
      zennRss: async () => [],
      hatenaBlogTopic: async () => [
        {
          title: "Hatena Blog article",
          url: "https://staff.hatenablog.com/entry/testing",
          publishedAt: null,
        },
      ],
      hatenaBookmarkRss: async () => [],
    });

    // Act
    const actual = await reader(feed);

    // Assert
    expect(actual[0]?.title).toBe("Hatena Blog article");
  });
});

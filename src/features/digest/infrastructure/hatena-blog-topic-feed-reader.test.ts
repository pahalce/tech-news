import { describe, expect, it } from "vite-plus/test";

import { readHatenaBlogTopicFeed } from "src/features/digest/infrastructure/hatena-blog-topic-feed-reader";

describe("Hatena Blog topic page parser に関するテスト", () => {
  it("topic page HTML に記事リンクと日時があるとき、Article Feed Entry に変換する", async () => {
    // Arrange
    const feed = {
      id: "hatena-blog-topic-technology",
      source: "hatena_blog",
      reader: "hatena_blog_topic",
      url: "https://blog.hatena.ne.jp/-/topics/technology",
    } as const;
    const html = `
      <article class="entry">
        <a class="entry-title" href="https://engineering.example.com/testing">Testing practice</a>
        <time datetime="2026-05-18T10:00:00+09:00">2026-05-18</time>
      </article>
    `;

    // Act
    const actual = await readHatenaBlogTopicFeed(feed, async () => html);

    // Assert
    expect(actual).toEqual([
      {
        title: "Testing practice",
        url: "https://engineering.example.com/testing",
        publishedAt: "2026-05-18T01:00:00.000Z",
      },
    ]);
  });

  it("topic page HTML に日時がないとき、publishedAt は null になる", async () => {
    // Arrange
    const feed = {
      id: "hatena-blog-topic-technology",
      source: "hatena_blog",
      reader: "hatena_blog_topic",
      url: "https://blog.hatena.ne.jp/-/topics/technology",
    } as const;
    const html = `<a class="entry-title" href="https://staff.hatenablog.com/entry">No date</a>`;

    // Act
    const actual = await readHatenaBlogTopicFeed(feed, async () => html);

    // Assert
    expect(actual[0]?.publishedAt).toBeNull();
  });
});

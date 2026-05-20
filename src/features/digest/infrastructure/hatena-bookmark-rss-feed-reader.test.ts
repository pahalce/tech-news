import { describe, expect, it } from "vite-plus/test";

import { readHatenaBookmarkRssFeed } from "src/features/digest/infrastructure/hatena-bookmark-rss-feed-reader";

describe("Hatena Bookmark RSS parser に関するテスト", () => {
  it("RSS item があるとき、Article Feed Entry に変換する", async () => {
    // Arrange
    const feed = {
      id: "hatena-bookmark-technology-hotentry",
      source: "other",
      reader: "hatena_bookmark_rss",
      url: "https://b.hatena.ne.jp/hotentry/it.rss",
    } as const;
    const rss = `
      <rss><channel>
        <item>
          <title>Useful engineering article</title>
          <link>https://engineering.example.com/useful?utm_source=hatena</link>
          <pubDate>Mon, 18 May 2026 10:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;

    // Act
    const actual = await readHatenaBookmarkRssFeed(feed, async () => rss);

    // Assert
    expect(actual).toEqual([
      {
        title: "Useful engineering article",
        url: "https://engineering.example.com/useful?utm_source=hatena",
        publishedAt: "2026-05-18T10:00:00.000Z",
      },
    ]);
  });
});

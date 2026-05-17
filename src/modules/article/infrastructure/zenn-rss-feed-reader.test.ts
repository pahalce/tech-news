import { describe, expect, it } from "vite-plus/test";

import { readZennRssFeed } from "src/modules/article/infrastructure/zenn-rss-feed-reader";

describe("Zenn RSS Feed Reader に関するテスト", () => {
  it("Zenn RSS XML を Article Feed Entry に変換する", async () => {
    const feed = { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" } as const;

    const actual = await readZennRssFeed(
      feed,
      async () => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[RSS から記事を読む]]></title>
      <link>https://zenn.dev/kazuyataira/articles/rss-entry?utm_source=feed</link>
      <pubDate>Tue, 12 May 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
    );

    expect(actual).toEqual([
      {
        title: "RSS から記事を読む",
        url: "https://zenn.dev/kazuyataira/articles/rss-entry?utm_source=feed",
        publishedAt: "2026-05-12T00:00:00.000Z",
      },
    ]);
  });

  it("複数 item をそれぞれ Article Feed Entry に変換する", async () => {
    const feed = { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" } as const;

    const actual = await readZennRssFeed(
      feed,
      async () => `<rss version="2.0">
  <channel>
    <item>
      <title>First</title>
      <link>https://zenn.dev/kazuyataira/articles/first</link>
    </item>
    <item>
      <title>Second</title>
      <link>https://zenn.dev/kazuyataira/articles/second</link>
      <pubDate>Tue, 12 May 2026 00:01:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
    );

    expect(actual).toEqual([
      {
        title: "First",
        url: "https://zenn.dev/kazuyataira/articles/first",
        publishedAt: null,
      },
      {
        title: "Second",
        url: "https://zenn.dev/kazuyataira/articles/second",
        publishedAt: "2026-05-12T00:01:00.000Z",
      },
    ]);
  });

  it("Zenn RSS XML の形でないレスポンスは feed 失敗として扱えるように例外を投げる", async () => {
    const feed = { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" } as const;

    const actual = readZennRssFeed(feed, async () => "<html>temporarily unavailable</html>");

    await expect(actual).rejects.toThrow("Invalid Zenn RSS feed");
  });
});

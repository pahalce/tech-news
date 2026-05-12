import { describe, expect, it } from "vite-plus/test";

import { collectCurrentFeedCandidates } from "./application/collect-current-feed-candidates-use-case";
import { createArticleFeedEntry } from "./domain/article-feed";
import { parseArticleIdentity } from "./domain/article-identity";
import { parseCurrentFeedCandidate } from "./domain/current-feed-candidate";
import { defaultZennArticleFeeds } from "./infrastructure/zenn-article-feeds";
import { readZennRssFeed } from "./infrastructure/zenn-rss-feed-reader";

describe("Current Feed Candidate 収集に関するテスト", () => {
  it("既定の Zenn trend feed と関心 topic feeds を収集対象にする", async () => {
    // Arrange
    const collectedFeedIds: string[] = [];

    // Act
    await collectCurrentFeedCandidates({
      feeds: defaultZennArticleFeeds,
      feedReader: async (feed) => {
        collectedFeedIds.push(feed.id);

        return [];
      },
    });

    // Assert
    expect(collectedFeedIds).toEqual([
      "zenn-trend",
      "zenn-topic-typescript",
      "zenn-topic-react",
      "zenn-topic-nextjs",
      "zenn-topic-frontend",
      "zenn-topic-backend",
    ]);
  });

  it("同じ記事が複数 feed に出たとき、Article ID で1件にまとめて feed 情報を残す", async () => {
    // Arrange
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        id: "zenn-topic-typescript",
        source: "zenn",
        url: "https://zenn.dev/topics/typescript/feed",
      },
    ] as const;

    // Act
    const actual = await collectCurrentFeedCandidates({
      feeds,
      feedReader: async (feed) => [
        {
          title: `Article from ${feed.id}`,
          url: "https://zenn.dev/kazuyataira/articles/testing-flue?utm_source=feed#comments",
          publishedAt: "2026-05-12T00:00:00.000Z",
        },
      ],
    });

    // Assert
    expect(actual.candidates).toEqual([
      {
        articleId: "zenn:da3d8034d616ae652906cc0d8570382bc2b1d91309a1b3364bae8a6233867763",
        source: "zenn",
        canonicalUrl: "https://zenn.dev/kazuyataira/articles/testing-flue",
        title: "Article from zenn-trend",
        feedIds: ["zenn-trend", "zenn-topic-typescript"],
        firstSeenInCurrentFeedsAt: "2026-05-12T00:00:00.000Z",
      },
    ]);
    expect(actual.failures).toEqual([]);
  });

  it("URL 表記揺れ、fragment、tracking query が違っても同じ Article ID にまとめる", async () => {
    // Arrange
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      { id: "zenn-topic-react", source: "zenn", url: "https://zenn.dev/topics/react/feed" },
    ] as const;

    // Act
    const actual = await collectCurrentFeedCandidates({
      feeds,
      feedReader: async (feed) =>
        feed.id === "zenn-trend"
          ? [
              {
                title: "Stable URL",
                url: "http://zenn.dev/kazuyataira/articles/testing-flue/?utm_medium=rss&keep=1#read",
                publishedAt: "2026-05-12T00:00:00.000Z",
              },
            ]
          : [
              {
                title: "URL Variant",
                url: "https://zenn.dev/kazuyataira/articles/testing-flue?keep=1&utm_source=topic",
                publishedAt: "2026-05-12T00:01:00.000Z",
              },
            ],
    });

    // Assert
    expect(actual.candidates).toHaveLength(1);
    expect(actual.candidates[0]).toMatchObject({
      canonicalUrl: "https://zenn.dev/kazuyataira/articles/testing-flue?keep=1",
      feedIds: ["zenn-trend", "zenn-topic-react"],
    });
  });

  it("一部 feed が失敗しても、成功した feed の Current Feed Candidate と失敗情報を返す", async () => {
    // Arrange
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      { id: "zenn-topic-nextjs", source: "zenn", url: "https://zenn.dev/topics/nextjs/feed" },
    ] as const;

    // Act
    const actual = await collectCurrentFeedCandidates({
      feeds,
      feedReader: async (feed) => {
        if (feed.id === "zenn-topic-nextjs") {
          throw new Error("feed timeout");
        }

        return [
          {
            title: "Successful feed article",
            url: "https://zenn.dev/kazuyataira/articles/feed-success",
            publishedAt: null,
          },
        ];
      },
    });

    // Assert
    expect(actual.candidates).toHaveLength(1);
    expect(actual.failures).toEqual([{ feedId: "zenn-topic-nextjs", message: "feed timeout" }]);
  });

  it("全 feed が失敗したとき、job failed として扱えるように例外を投げる", async () => {
    // Arrange
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      { id: "zenn-topic-frontend", source: "zenn", url: "https://zenn.dev/topics/frontend/feed" },
    ] as const;

    // Act
    const actual = collectCurrentFeedCandidates({
      feeds,
      feedReader: async () => {
        throw new Error("network unavailable");
      },
    });

    // Assert
    await expect(actual).rejects.toThrow("All article feeds failed");
  });

  it("全 feed の entry 処理が失敗したとき、job failed として扱えるように例外を投げる", async () => {
    // Arrange
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        id: "zenn-topic-typescript",
        source: "zenn",
        url: "https://zenn.dev/topics/typescript/feed",
      },
    ] as const;

    // Act
    const actual = collectCurrentFeedCandidates({
      feeds,
      feedReader: async () => [
        {
          title: "Malformed URL",
          url: "not a url",
          publishedAt: null,
        },
      ],
    });

    // Assert
    await expect(actual).rejects.toThrow("All article feeds failed");
  });

  it("Zenn RSS XML を Current Feed Candidate 用の feed entry に変換する", async () => {
    // Arrange
    const feed = { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" } as const;

    // Act
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

    // Assert
    expect(actual).toEqual([
      {
        title: "RSS から記事を読む",
        url: "https://zenn.dev/kazuyataira/articles/rss-entry?utm_source=feed",
        publishedAt: "2026-05-12T00:00:00.000Z",
      },
    ]);
  });

  it("Zenn RSS XML の形でないレスポンスは feed 失敗として扱えるように例外を投げる", async () => {
    // Arrange
    const feed = { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" } as const;

    // Act
    const actual = readZennRssFeed(feed, async () => "<html>temporarily unavailable</html>");

    // Assert
    await expect(actual).rejects.toThrow("Invalid Zenn RSS feed");
  });

  it("Article Feed Entry の title が空のとき、domain validation エラーとなる", () => {
    // Arrange
    const entry = {
      title: "",
      url: "https://zenn.dev/kazuyataira/articles/rss-entry",
      publishedAt: null,
    };

    // Act
    const actual = () => createArticleFeedEntry(entry);

    // Assert
    expect(actual).toThrow("Article Feed Entry title must not be empty");
  });

  it("Article Identity の Article ID が Canonical URL と一致しないとき、domain validation エラーとなる", () => {
    // Arrange
    const identity = {
      articleId: "zenn:0000000000000000000000000000000000000000000000000000000000000000",
      source: "zenn",
      canonicalUrl: "https://zenn.dev/kazuyataira/articles/rss-entry",
    };

    // Act
    const actual = () => parseArticleIdentity(identity);

    // Assert
    expect(actual).toThrow("Article ID must match source and Canonical URL");
  });

  it("Current Feed Candidate の feedIds が空のとき、domain validation エラーとなる", () => {
    // Arrange
    const candidate = {
      articleId: "zenn:488e4f9f9007621f5a60d198e3953705eb8ffcae9c31c0b3d69502c626b87d76",
      source: "zenn",
      canonicalUrl: "https://zenn.dev/kazuyataira/articles/rss-entry",
      title: "RSS entry",
      feedIds: [],
      firstSeenInCurrentFeedsAt: null,
    };

    // Act
    const actual = () => parseCurrentFeedCandidate(candidate);

    // Assert
    expect(actual).toThrow("Current Feed Candidate feedIds must not be empty");
  });
});

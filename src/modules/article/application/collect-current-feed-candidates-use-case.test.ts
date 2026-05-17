import { describe, expect, it } from "vite-plus/test";

import { collectCurrentFeedCandidates } from "./collect-current-feed-candidates-use-case";

describe("Current Feed Candidate 収集 use case に関するテスト", () => {
  it("同じ記事が複数 feed に出たとき、Article ID で1件にまとめて feed 情報を残す", async () => {
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        id: "zenn-topic-typescript",
        source: "zenn",
        url: "https://zenn.dev/topics/typescript/feed",
      },
    ] as const;

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
    expect(actual.stats).toEqual({
      fetchedEntryCount: 2,
      duplicateEntryCount: 1,
      duplicateEntries: [
        {
          articleId: "zenn:da3d8034d616ae652906cc0d8570382bc2b1d91309a1b3364bae8a6233867763",
          canonicalUrl: "https://zenn.dev/kazuyataira/articles/testing-flue",
          title: "Article from zenn-topic-typescript",
          feedId: "zenn-topic-typescript",
          keptTitle: "Article from zenn-trend",
        },
      ],
    });
  });

  it("一部 feed が失敗しても、成功した feed の Current Feed Candidate と失敗情報を返す", async () => {
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      { id: "zenn-topic-nextjs", source: "zenn", url: "https://zenn.dev/topics/nextjs/feed" },
    ] as const;

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

    expect(actual.candidates).toHaveLength(1);
    expect(actual.failures).toEqual([{ feedId: "zenn-topic-nextjs", message: "feed timeout" }]);
  });

  it("全 feed が失敗したとき、job failed として扱えるように例外を投げる", async () => {
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      { id: "zenn-topic-frontend", source: "zenn", url: "https://zenn.dev/topics/frontend/feed" },
    ] as const;

    const actual = collectCurrentFeedCandidates({
      feeds,
      feedReader: async () => {
        throw new Error("network unavailable");
      },
    });

    await expect(actual).rejects.toThrow("All article feeds failed");
  });

  it("全 feed の entry 処理が失敗したとき、job failed として扱えるように例外を投げる", async () => {
    const feeds = [
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        id: "zenn-topic-typescript",
        source: "zenn",
        url: "https://zenn.dev/topics/typescript/feed",
      },
    ] as const;

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

    await expect(actual).rejects.toThrow("All article feeds failed");
  });

  it("feed が成功して候補が0件のとき、失敗扱いにしない", async () => {
    const feeds = [{ id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" }] as const;

    const actual = await collectCurrentFeedCandidates({
      feeds,
      feedReader: async () => [],
    });

    expect(actual).toEqual({
      candidates: [],
      failures: [],
      stats: {
        fetchedEntryCount: 0,
        duplicateEntryCount: 0,
        duplicateEntries: [],
      },
    });
  });
});

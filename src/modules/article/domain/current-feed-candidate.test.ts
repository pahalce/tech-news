import { describe, expect, it } from "vite-plus/test";

import { createArticleFeedEntry } from "./article-feed";
import { parseArticleIdentity } from "./article-identity";
import { normalizeCanonicalUrl } from "./canonical-url";
import {
  createCurrentFeedCandidate,
  parseCurrentFeedCandidate,
  recordFeedAppearance,
} from "./current-feed-candidate";

describe("Article domain model に関するテスト", () => {
  it("URL 表記揺れ、fragment、tracking query が違っても同じ Canonical URL になる", () => {
    const actual = normalizeCanonicalUrl(
      "http://zenn.dev/kazuyataira/articles/testing-flue/?utm_medium=rss&keep=1#read",
    );

    expect(actual).toBe("https://zenn.dev/kazuyataira/articles/testing-flue?keep=1");
  });

  it("Article Feed Entry の title が空のとき、domain validation エラーとなる", () => {
    const actual = () =>
      createArticleFeedEntry({
        title: "",
        url: "https://zenn.dev/kazuyataira/articles/rss-entry",
        publishedAt: null,
      });

    expect(actual).toThrow("Article Feed Entry title must not be empty");
  });

  it("Article Identity の Article ID が Canonical URL と一致しないとき、domain validation エラーとなる", () => {
    const actual = () =>
      parseArticleIdentity({
        articleId: "zenn:0000000000000000000000000000000000000000000000000000000000000000",
        source: "zenn",
        canonicalUrl: "https://zenn.dev/kazuyataira/articles/rss-entry",
      });

    expect(actual).toThrow("Article ID must match source and Canonical URL");
  });

  it("Current Feed Candidate の feedIds が空のとき、domain validation エラーとなる", () => {
    const actual = () =>
      parseCurrentFeedCandidate({
        articleId: "zenn:488e4f9f9007621f5a60d198e3953705eb8ffcae9c31c0b3d69502c626b87d76",
        source: "zenn",
        canonicalUrl: "https://zenn.dev/kazuyataira/articles/rss-entry",
        title: "RSS entry",
        feedIds: [],
        firstSeenInCurrentFeedsAt: null,
      });

    expect(actual).toThrow("Current Feed Candidate feedIds must not be empty");
  });

  it("同じ feed appearance を記録しても feedIds は重複しない", () => {
    const feed = { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" } as const;
    const candidate = createCurrentFeedCandidate(feed, {
      title: "RSS entry",
      url: "https://zenn.dev/kazuyataira/articles/rss-entry",
      publishedAt: null,
    });

    const actual = recordFeedAppearance(candidate, feed);

    expect(actual.feedIds).toEqual(["zenn-trend"]);
  });
});

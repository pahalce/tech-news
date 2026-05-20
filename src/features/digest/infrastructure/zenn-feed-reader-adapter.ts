import type { CollectCurrentFeedCandidatesInput } from "src/features/digest/application/collect-current-feed-candidates-use-case";
import { fetchTextWithTimeout } from "src/features/digest/infrastructure/http-client";
import { readZennRssFeed } from "src/features/digest/infrastructure/zenn-rss-feed-reader";
import { createCompositeArticleFeedReader } from "src/features/digest/infrastructure/composite-article-feed-reader";
import { readHatenaBlogTopicFeed } from "src/features/digest/infrastructure/hatena-blog-topic-feed-reader";
import { readHatenaBookmarkRssFeed } from "src/features/digest/infrastructure/hatena-bookmark-rss-feed-reader";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

export const maxFeedEntriesPerFeed = 3;

export function createZennFeedReader(input: {
  timeoutMs: number;
  logger: WorkflowLogger;
}): CollectCurrentFeedCandidatesInput["feedReader"] {
  return async (feed) => {
    const startedAt = performance.now();
    input.logger.info("RSS feed fetch started", { feedId: feed.id, url: feed.url });
    const entries = await readZennRssFeed(feed, (url) =>
      fetchTextWithTimeout({
        url,
        timeoutMs: input.timeoutMs,
        failurePrefix: "RSS feed fetch failed",
      }),
    );
    const selectedEntries = entries.slice(0, maxFeedEntriesPerFeed);
    input.logger.info("RSS feed fetch finished", {
      feedId: feed.id,
      elapsedMs: elapsedMs(startedAt),
      entryCount: entries.length,
      selectedEntryCount: selectedEntries.length,
      maxFeedEntriesPerFeed,
    });
    return selectedEntries;
  };
}

export function createArticleFeedReader(input: {
  timeoutMs: number;
  logger: WorkflowLogger;
}): CollectCurrentFeedCandidatesInput["feedReader"] {
  const fetchText = (url: string) =>
    fetchTextWithTimeout({
      url,
      timeoutMs: input.timeoutMs,
      failurePrefix: "article feed fetch failed",
    });

  return createCompositeArticleFeedReader({
    zennRss: createZennFeedReader(input),
    hatenaBlogTopic: async (feed) => readHatenaBlogTopicFeed(feed, fetchText),
    hatenaBookmarkRss: async (feed) => readHatenaBookmarkRssFeed(feed, fetchText),
  });
}

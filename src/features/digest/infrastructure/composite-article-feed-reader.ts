import type { ArticleFeed, ArticleFeedEntry } from "src/domains/article";
import type { CollectCurrentFeedCandidatesInput } from "src/features/digest/application/collect-current-feed-candidates-use-case";

type SourceSpecificFeedReader = (feed: ArticleFeed) => Promise<readonly ArticleFeedEntry[]>;

export function createCompositeArticleFeedReader(input: {
  zennRss: SourceSpecificFeedReader;
  hatenaBlogTopic: SourceSpecificFeedReader;
  hatenaBookmarkRss: SourceSpecificFeedReader;
}): CollectCurrentFeedCandidatesInput["feedReader"] {
  return async (feed) => {
    switch (feed.reader ?? "zenn_rss") {
      case "hatena_blog_topic":
        return input.hatenaBlogTopic(feed);
      case "hatena_bookmark_rss":
        return input.hatenaBookmarkRss(feed);
      case "zenn_rss":
        return input.zennRss(feed);
    }
  };
}

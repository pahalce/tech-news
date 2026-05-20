import { createArticleFeed, type ArticleFeed } from "src/domains/article";

const zennInterestTopics = ["typescript", "react", "frontend", "backend", "nextjs"] as const;

export const defaultZennArticleFeeds: readonly ArticleFeed[] = [
  createArticleFeed({ id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" }),
  ...zennInterestTopics.map((topic) => ({
    ...createArticleFeed({
      id: `zenn-topic-${topic}`,
      source: "zenn",
      url: `https://zenn.dev/topics/${topic}/feed`,
    }),
  })),
];

export const defaultMultiSourceArticleFeeds: readonly ArticleFeed[] = [
  ...defaultZennArticleFeeds,
  createArticleFeed({
    id: "hatena-blog-topic-technology",
    source: "hatena_blog",
    reader: "hatena_blog_topic",
    url: "https://blog.hatena.ne.jp/-/topics/technology",
  }),
  createArticleFeed({
    id: "hatena-bookmark-technology-hotentry",
    source: "other",
    reader: "hatena_bookmark_rss",
    url: "https://b.hatena.ne.jp/hotentry/it.rss",
  }),
  createArticleFeed({
    id: "hatena-bookmark-technology-entrylist",
    source: "other",
    reader: "hatena_bookmark_rss",
    url: "https://b.hatena.ne.jp/entrylist/it.rss",
  }),
];

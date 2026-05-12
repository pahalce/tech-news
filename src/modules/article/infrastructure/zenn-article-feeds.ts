import { createArticleFeed } from "../domain/article";
import type { ArticleFeed } from "../domain/article";

const zennInterestTopics = ["typescript", "react", "nextjs", "frontend", "backend"] as const;

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

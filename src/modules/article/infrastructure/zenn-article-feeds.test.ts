import { describe, expect, it } from "vite-plus/test";

import { defaultZennArticleFeeds } from "src/modules/article/infrastructure/zenn-article-feeds";

describe("Zenn Article Feed 設定に関するテスト", () => {
  it("既定の Zenn trend feed と関心 topic feeds を収集対象にする", () => {
    expect(defaultZennArticleFeeds.map((feed) => feed.id)).toEqual([
      "zenn-trend",
      "zenn-topic-typescript",
      "zenn-topic-react",
      "zenn-topic-frontend",
      "zenn-topic-backend",
      "zenn-topic-nextjs",
    ]);
  });
});

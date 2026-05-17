import * as v from "valibot";

import { ArticleSourceSchema } from "src/domains/article/article-source";
import { normalizeCanonicalUrl, UrlStringSchema } from "src/domains/article/canonical-url";

const PublishedAtSchema = v.nullable(
  v.pipe(
    v.string(),
    v.nonEmpty("publishedAt must not be empty when present."),
    v.check((value) => !Number.isNaN(Date.parse(value)), "publishedAt must be a date string."),
  ),
);

const ArticleFeedSchema = v.object({
  id: v.pipe(v.string(), v.nonEmpty("Article Feed id must not be empty.")),
  source: ArticleSourceSchema,
  url: UrlStringSchema,
});

const ArticleFeedEntrySchema = v.object({
  title: v.pipe(v.string(), v.nonEmpty("Article Feed Entry title must not be empty.")),
  url: UrlStringSchema,
  publishedAt: PublishedAtSchema,
});

export type ArticleFeed = v.InferOutput<typeof ArticleFeedSchema>;

export type ArticleFeedEntry = v.InferOutput<typeof ArticleFeedEntrySchema>;

export function createArticleFeed(input: unknown): ArticleFeed {
  const feed = v.parse(ArticleFeedSchema, input);
  normalizeCanonicalUrl(feed.url);

  return feed;
}

export function createArticleFeedEntry(input: unknown): ArticleFeedEntry {
  const entry = v.parse(ArticleFeedEntrySchema, input);
  normalizeCanonicalUrl(entry.url);

  return entry;
}

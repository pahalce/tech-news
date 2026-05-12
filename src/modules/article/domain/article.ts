import { createHash } from "node:crypto";

import * as v from "valibot";

const ArticleSourceSchema = v.literal("zenn");

const UrlStringSchema = v.pipe(
  v.string(),
  v.nonEmpty("url must not be empty."),
  v.check((url) => URL.canParse(url), "url must be a valid URL."),
);

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

export type ArticleSource = v.InferOutput<typeof ArticleSourceSchema>;

export type ArticleFeed = v.InferOutput<typeof ArticleFeedSchema>;

export type ArticleFeedEntry = v.InferOutput<typeof ArticleFeedEntrySchema>;

export type CurrentFeedCandidate = {
  articleId: string;
  source: ArticleSource;
  canonicalUrl: string;
  title: string;
  feedIds: string[];
  firstSeenInCurrentFeedsAt: string | null;
};

export type ArticleIdentity = {
  articleId: string;
  canonicalUrl: string;
  source: ArticleSource;
};

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

export function createArticleIdentity(source: ArticleSource, url: string): ArticleIdentity {
  const parsedSource = v.parse(ArticleSourceSchema, source);
  const canonicalUrl = normalizeCanonicalUrl(url);
  const canonicalUrlHash = createHash("sha256").update(canonicalUrl).digest("hex");

  return {
    articleId: `${parsedSource}:${canonicalUrlHash}`,
    canonicalUrl,
    source: parsedSource,
  };
}

export function createCurrentFeedCandidate(
  feedInput: ArticleFeed,
  entryInput: ArticleFeedEntry,
): CurrentFeedCandidate {
  const feed = createArticleFeed(feedInput);
  const entry = createArticleFeedEntry(entryInput);
  const identity = createArticleIdentity(feed.source, entry.url);

  return {
    articleId: identity.articleId,
    source: identity.source,
    canonicalUrl: identity.canonicalUrl,
    title: entry.title,
    feedIds: [feed.id],
    firstSeenInCurrentFeedsAt: entry.publishedAt,
  };
}

export function recordFeedAppearance(
  candidate: CurrentFeedCandidate,
  feedInput: ArticleFeed,
): CurrentFeedCandidate {
  const feed = createArticleFeed(feedInput);

  if (candidate.feedIds.includes(feed.id)) {
    return { ...candidate, feedIds: [...candidate.feedIds] };
  }

  return {
    ...candidate,
    feedIds: [...candidate.feedIds, feed.id],
  };
}

export function normalizeCanonicalUrl(url: string): string {
  const canonicalUrl = new URL(url);
  canonicalUrl.protocol = "https:";
  canonicalUrl.hash = "";

  for (const key of Array.from(canonicalUrl.searchParams.keys())) {
    if (isTrackingQueryParameter(key)) {
      canonicalUrl.searchParams.delete(key);
    }
  }

  canonicalUrl.searchParams.sort();

  if (canonicalUrl.pathname !== "/" && canonicalUrl.pathname.endsWith("/")) {
    canonicalUrl.pathname = canonicalUrl.pathname.slice(0, -1);
  }

  return canonicalUrl.toString();
}

function isTrackingQueryParameter(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey === "fbclid" ||
    normalizedKey === "gclid" ||
    normalizedKey === "yclid" ||
    normalizedKey.startsWith("utm_")
  );
}

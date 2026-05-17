import * as v from "valibot";

import { ArticleIdSchema } from "src/domains/article/article-id";
import { ArticleSourceSchema } from "src/domains/article/article-source";
import {
  createArticleFeed,
  createArticleFeedEntry,
  type ArticleFeed,
  type ArticleFeedEntry,
} from "src/domains/article/article-feed";
import { createArticleIdentity } from "src/domains/article/article-identity";
import { UrlStringSchema } from "src/domains/article/canonical-url";

const CurrentFeedCandidateSchema = v.pipe(
  v.object({
    articleId: ArticleIdSchema,
    source: ArticleSourceSchema,
    canonicalUrl: UrlStringSchema,
    title: v.pipe(v.string(), v.nonEmpty("Current Feed Candidate title must not be empty.")),
    feedIds: v.pipe(
      v.array(v.pipe(v.string(), v.nonEmpty("Current Feed Candidate feed id must not be empty."))),
      v.minLength(1, "Current Feed Candidate feedIds must not be empty."),
    ),
    firstSeenInCurrentFeedsAt: v.nullable(
      v.pipe(
        v.string(),
        v.nonEmpty("firstSeenInCurrentFeedsAt must not be empty when present."),
        v.check(
          (value) => !Number.isNaN(Date.parse(value)),
          "firstSeenInCurrentFeedsAt must be a date string.",
        ),
      ),
    ),
  }),
  v.check(
    (candidate) =>
      candidate.articleId ===
      createArticleIdentity(candidate.source, candidate.canonicalUrl).articleId,
    "Current Feed Candidate Article ID must match source and Canonical URL.",
  ),
);

export type CurrentFeedCandidate = v.InferOutput<typeof CurrentFeedCandidateSchema>;

export function createCurrentFeedCandidate(
  feedInput: ArticleFeed,
  entryInput: ArticleFeedEntry,
): CurrentFeedCandidate {
  const feed = createArticleFeed(feedInput);
  const entry = createArticleFeedEntry(entryInput);
  const identity = createArticleIdentity(feed.source, entry.url);

  return parseCurrentFeedCandidate({
    articleId: identity.articleId,
    source: identity.source,
    canonicalUrl: identity.canonicalUrl,
    title: entry.title,
    feedIds: [feed.id],
    firstSeenInCurrentFeedsAt: entry.publishedAt,
  });
}

export function parseCurrentFeedCandidate(input: unknown): CurrentFeedCandidate {
  return v.parse(CurrentFeedCandidateSchema, input);
}

export function recordFeedAppearance(
  candidateInput: CurrentFeedCandidate,
  feedInput: ArticleFeed,
): CurrentFeedCandidate {
  const candidate = parseCurrentFeedCandidate(candidateInput);
  const feed = createArticleFeed(feedInput);

  if (candidate.feedIds.includes(feed.id)) {
    return parseCurrentFeedCandidate({ ...candidate, feedIds: [...candidate.feedIds] });
  }

  return parseCurrentFeedCandidate({
    ...candidate,
    feedIds: [...candidate.feedIds, feed.id],
  });
}

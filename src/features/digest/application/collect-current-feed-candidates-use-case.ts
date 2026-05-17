import {
  createCurrentFeedCandidate,
  recordFeedAppearance,
  type CurrentFeedCandidate,
} from "src/domains/article";
import { type ArticleFeed, type ArticleFeedEntry } from "src/domains/article";

export type FeedCollectionFailure = {
  feedId: string;
  message: string;
};

export type DuplicateFeedEntry = {
  articleId: string;
  canonicalUrl: string;
  title: string;
  feedId: string;
  keptTitle: string;
};

export type CollectCurrentFeedCandidatesInput = {
  feeds: readonly ArticleFeed[];
  feedReader(feed: ArticleFeed): Promise<readonly ArticleFeedEntry[]>;
};

export type CollectCurrentFeedCandidatesResult = {
  candidates: CurrentFeedCandidate[];
  failures: FeedCollectionFailure[];
  stats: {
    fetchedEntryCount: number;
    duplicateEntryCount: number;
    duplicateEntries: DuplicateFeedEntry[];
  };
};

export async function collectCurrentFeedCandidates(
  input: CollectCurrentFeedCandidatesInput,
): Promise<CollectCurrentFeedCandidatesResult> {
  const candidatesByArticleId = new Map<string, CurrentFeedCandidate>();
  const failures: FeedCollectionFailure[] = [];
  let successfulFeedCount = 0;
  let fetchedEntryCount = 0;
  let duplicateEntryCount = 0;
  const duplicateEntries: DuplicateFeedEntry[] = [];

  for (const feed of input.feeds) {
    try {
      const entries = await input.feedReader(feed);
      fetchedEntryCount += entries.length;

      for (const entry of entries) {
        const candidate = createCurrentFeedCandidate(feed, entry);
        const existingCandidate = candidatesByArticleId.get(candidate.articleId);

        if (existingCandidate) {
          duplicateEntryCount += 1;
          duplicateEntries.push({
            articleId: candidate.articleId,
            canonicalUrl: candidate.canonicalUrl,
            title: candidate.title,
            feedId: feed.id,
            keptTitle: existingCandidate.title,
          });
          candidatesByArticleId.set(
            candidate.articleId,
            recordFeedAppearance(existingCandidate, feed),
          );
          continue;
        }

        candidatesByArticleId.set(candidate.articleId, candidate);
      }

      successfulFeedCount += 1;
    } catch (error) {
      failures.push({
        feedId: feed.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (input.feeds.length > 0 && successfulFeedCount === 0) {
    throw new Error("All article feeds failed.");
  }

  return {
    candidates: [...candidatesByArticleId.values()],
    failures,
    stats: {
      fetchedEntryCount,
      duplicateEntryCount,
      duplicateEntries,
    },
  };
}

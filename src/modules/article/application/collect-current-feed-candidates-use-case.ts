import {
  createCurrentFeedCandidate,
  recordFeedAppearance,
  type ArticleFeed,
  type ArticleFeedEntry,
  type CurrentFeedCandidate,
} from "../domain/article";

export type FeedCollectionFailure = {
  feedId: string;
  message: string;
};

export type CollectCurrentFeedCandidatesInput = {
  feeds: readonly ArticleFeed[];
  feedReader(feed: ArticleFeed): Promise<readonly ArticleFeedEntry[]>;
};

export type CollectCurrentFeedCandidatesResult = {
  candidates: CurrentFeedCandidate[];
  failures: FeedCollectionFailure[];
};

export async function collectCurrentFeedCandidates(
  input: CollectCurrentFeedCandidatesInput,
): Promise<CollectCurrentFeedCandidatesResult> {
  const candidatesByArticleId = new Map<string, CurrentFeedCandidate>();
  const failures: FeedCollectionFailure[] = [];
  let successfulFeedCount = 0;

  for (const feed of input.feeds) {
    try {
      const entries = await input.feedReader(feed);

      for (const entry of entries) {
        const candidate = createCurrentFeedCandidate(feed, entry);
        const existingCandidate = candidatesByArticleId.get(candidate.articleId);

        if (existingCandidate) {
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
  };
}

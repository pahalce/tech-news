import type { ArticleFeatures } from "src/domains/article";
import {
  createRecommendationCandidate,
  selectDigestItems,
  type DigestSelectionPreferenceProfile,
  type RecommendationCandidate,
} from "src/domains/digest";

type CurrentFeedCandidate = {
  articleId: string;
  source: string;
  canonicalUrl: string;
  title: string;
  feedIds: readonly string[];
  firstSeenInCurrentFeedsAt: string | null;
};

type CurrentFeedCandidateFeatures = {
  candidate: CurrentFeedCandidate;
  articleFeatures: ArticleFeatures;
};

export type ScoreCurrentFeedCandidatesInput = {
  currentFeedCandidateFeatures: readonly CurrentFeedCandidateFeatures[];
  preferenceProfile: DigestSelectionPreferenceProfile;
  recommendedArticleIds: readonly string[];
};

export type ScoredCurrentFeedCandidate = CurrentFeedCandidate & {
  ruleScore: number;
};

export type ScoreCurrentFeedCandidatesResult = {
  scoredCandidates: ScoredCurrentFeedCandidate[];
};

export function scoreCurrentFeedCandidates(
  input: ScoreCurrentFeedCandidatesInput,
): ScoreCurrentFeedCandidatesResult {
  const recommendedArticleIds = new Set(input.recommendedArticleIds);
  const scoredCandidates: ScoredCurrentFeedCandidate[] = [];
  const recommendationCandidates: RecommendationCandidate[] = [];

  for (const { candidate, articleFeatures } of input.currentFeedCandidateFeatures) {
    if (recommendedArticleIds.has(candidate.articleId)) {
      continue;
    }

    const recommendationCandidate = createRecommendationCandidate({
      articleId: candidate.articleId,
      articleFeatures,
      preferenceProfile: input.preferenceProfile,
    });
    recommendationCandidates.push(recommendationCandidate);

    scoredCandidates.push({
      ...candidate,
      feedIds: [...candidate.feedIds],
      ruleScore: recommendationCandidate.ruleScore,
    });
  }

  const digestItems = selectDigestItems({
    candidates: recommendationCandidates,
    maxItems: Math.max(scoredCandidates.length, 1),
  });
  const itemOrder = new Map(digestItems.map((item, index) => [item.articleId, index]));

  return {
    scoredCandidates: scoredCandidates.sort(
      (left, right) => (itemOrder.get(left.articleId) ?? 0) - (itemOrder.get(right.articleId) ?? 0),
    ),
  };
}

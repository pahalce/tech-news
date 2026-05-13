import {
  calculateRuleScore,
  type RuleScoreArticleFeatures,
  type RuleScorePreferenceProfile,
} from "../domain/rule-score";

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
  articleFeatures: RuleScoreArticleFeatures;
};

export type ScoreCurrentFeedCandidatesInput = {
  currentFeedCandidateFeatures: readonly CurrentFeedCandidateFeatures[];
  preferenceProfile: RuleScorePreferenceProfile;
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

  for (const { candidate, articleFeatures } of input.currentFeedCandidateFeatures) {
    if (recommendedArticleIds.has(candidate.articleId)) {
      continue;
    }

    scoredCandidates.push({
      ...candidate,
      feedIds: [...candidate.feedIds],
      ruleScore: calculateRuleScore(articleFeatures, input.preferenceProfile),
    });
  }

  return {
    scoredCandidates: scoredCandidates.sort((left, right) => right.ruleScore - left.ruleScore),
  };
}

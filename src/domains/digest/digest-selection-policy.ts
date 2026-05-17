import { calculateArticleFeatureWeight, type ArticleFeatureWeights } from "src/domains/article";
import type { ArticleFeatures } from "src/domains/article";

export type DigestSelectionPreferenceProfile = {
  feature_weights: ArticleFeatureWeights;
};

export type RecommendationCandidate = Readonly<{
  articleId: string;
  articleFeatures: ArticleFeatures;
  ruleScore: number;
}>;

export type DigestItem = Readonly<{
  articleId: string;
  score: number;
}>;

export function createRecommendationCandidate(input: {
  articleId: string;
  articleFeatures: ArticleFeatures;
  preferenceProfile: DigestSelectionPreferenceProfile;
}): RecommendationCandidate {
  return {
    articleId: input.articleId,
    articleFeatures: input.articleFeatures,
    ruleScore: calculateArticleFeatureWeight(
      input.articleFeatures,
      input.preferenceProfile.feature_weights,
    ),
  };
}

export function selectDigestItems(input: {
  candidates: readonly RecommendationCandidate[];
  maxItems: number;
}): DigestItem[] {
  if (!Number.isInteger(input.maxItems) || input.maxItems < 1) {
    throw new Error("Digest Selection Policy maxItems must be a positive integer.");
  }

  const seenArticleIds = new Set<string>();
  const digestItems: DigestItem[] = [];

  for (const candidate of [...input.candidates].sort(
    (left, right) => right.ruleScore - left.ruleScore,
  )) {
    if (seenArticleIds.has(candidate.articleId)) {
      continue;
    }

    seenArticleIds.add(candidate.articleId);
    digestItems.push({
      articleId: candidate.articleId,
      score: candidate.ruleScore,
    });

    if (digestItems.length >= input.maxItems) {
      break;
    }
  }

  return digestItems;
}

import {
  calculateArticleFeatureWeight,
  type ArticleFeatureWeights,
} from "src/domains/article/article-feature-weighting";
import type { ArticleFeatures } from "src/domains/article/article-features";

export type RuleScorePreferenceProfile = {
  feature_weights: ArticleFeatureWeights;
};

export function calculateRuleScore(
  articleFeatures: ArticleFeatures,
  preferenceProfile: RuleScorePreferenceProfile,
): number {
  return calculateArticleFeatureWeight(articleFeatures, preferenceProfile.feature_weights);
}

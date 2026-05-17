import {
  calculateArticleFeatureWeight,
  type ArticleFeatureWeights,
} from "../../../shared/domain/article-feature-weighting";
import type { ArticleFeatures } from "../../../shared/domain/article-features";

export type RuleScorePreferenceProfile = {
  feature_weights: ArticleFeatureWeights;
};

export type RuleScoreArticleFeatures = ArticleFeatures;

export function calculateRuleScore(
  articleFeatures: RuleScoreArticleFeatures,
  preferenceProfile: RuleScorePreferenceProfile,
): number {
  return calculateArticleFeatureWeight(articleFeatures, preferenceProfile.feature_weights);
}

import {
  calculateArticleFeatureWeight,
  type ArticleFeatureWeights,
} from "../../feature-extraction/domain/article-feature-weighting";
import type { ArticleFeatures } from "../../feature-extraction/domain/article-features";

export type RuleScorePreferenceProfile = {
  feature_weights: ArticleFeatureWeights;
};

export function calculateRuleScore(
  articleFeatures: ArticleFeatures,
  preferenceProfile: RuleScorePreferenceProfile,
): number {
  return calculateArticleFeatureWeight(articleFeatures, preferenceProfile.feature_weights);
}

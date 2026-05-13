export type RuleScoreArticleFeatures = {
  primaryTopics: FeatureSignal[];
  mentionedTopics: FeatureSignal[];
  unknownTopics: string[];
  featureAxes: Record<string, FeatureSignal[]>;
  otherSignals: FeatureSignal[];
};

export type RuleScorePreferenceProfile = {
  feature_weights: {
    topics: Record<string, number>;
    feature_axes: Record<string, Record<string, number>>;
  };
};

type FeatureSignal = {
  key: string;
  salience: number;
};

const salienceThreshold = 0.3;
const mentionedTopicSalienceThreshold = 0.7;
const mentionedTopicFactor = 0.3;

export function calculateRuleScore(
  articleFeatures: RuleScoreArticleFeatures,
  preferenceProfile: RuleScorePreferenceProfile,
): number {
  let score = 0;

  for (const topic of articleFeatures.primaryTopics) {
    score += scoreFeature(topic, preferenceProfile.feature_weights.topics);
  }

  for (const topic of articleFeatures.mentionedTopics) {
    if (topic.salience < mentionedTopicSalienceThreshold) {
      continue;
    }

    score += scoreFeature(topic, preferenceProfile.feature_weights.topics) * mentionedTopicFactor;
  }

  for (const [axis, features] of Object.entries(articleFeatures.featureAxes)) {
    const axisWeights = preferenceProfile.feature_weights.feature_axes[axis] ?? {};

    for (const feature of features) {
      score += scoreFeature(feature, axisWeights);
    }
  }

  return score;
}

function scoreFeature(feature: FeatureSignal, weights: Record<string, number>): number {
  if (feature.salience < salienceThreshold) {
    return 0;
  }

  return (weights[feature.key] ?? 0) * feature.salience;
}

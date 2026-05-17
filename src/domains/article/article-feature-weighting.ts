import type { ArticleFeatures, FeatureSignal } from "src/domains/article/article-features";

export type ArticleFeatureWeights = {
  topics: Record<string, number>;
  feature_axes: Record<string, Record<string, number>>;
};

export type WeightRange = {
  min: number;
  max: number;
};

const salienceThreshold = 0.3;
const mentionedTopicSalienceThreshold = 0.7;
const mentionedTopicFactor = 0.3;

export function calculateArticleFeatureWeight(
  articleFeatures: ArticleFeatures,
  featureWeights: ArticleFeatureWeights,
): number {
  let score = 0;

  for (const topic of articleFeatures.primaryTopics) {
    score += calculateSignalWeight(topic, featureWeights.topics);
  }

  for (const topic of articleFeatures.mentionedTopics) {
    if (topic.salience < mentionedTopicSalienceThreshold) {
      continue;
    }

    score += calculateSignalWeight(topic, featureWeights.topics) * mentionedTopicFactor;
  }

  for (const [axis, features] of Object.entries(articleFeatures.featureAxes)) {
    const axisWeights = featureWeights.feature_axes[axis] ?? {};

    for (const feature of features) {
      score += calculateSignalWeight(feature, axisWeights);
    }
  }

  return score;
}

export function applyArticleFeatureFeedback(
  featureWeights: ArticleFeatureWeights,
  articleFeatures: ArticleFeatures | null,
  feedbackWeight: number,
  weightRange: WeightRange,
): void {
  if (!articleFeatures) {
    return;
  }

  for (const topic of articleFeatures.primaryTopics) {
    applySignalFeedback(featureWeights.topics, topic, feedbackWeight, weightRange);
  }

  for (const topic of articleFeatures.mentionedTopics) {
    if (topic.salience < mentionedTopicSalienceThreshold) {
      continue;
    }

    applySignalFeedback(
      featureWeights.topics,
      topic,
      feedbackWeight * mentionedTopicFactor,
      weightRange,
    );
  }

  for (const [axis, features] of Object.entries(articleFeatures.featureAxes)) {
    const axisWeights = featureWeights.feature_axes[axis];
    if (!axisWeights) {
      continue;
    }

    for (const feature of features) {
      applySignalFeedback(axisWeights, feature, feedbackWeight, weightRange);
    }
  }
}

export function applyArticleFeatureFeedbackToNewWeights(
  featureWeights: ArticleFeatureWeights,
  articleFeatures: ArticleFeatures | null,
  feedbackWeight: number,
  weightRange: WeightRange,
): ArticleFeatureWeights {
  const nextWeights = cloneArticleFeatureWeights(featureWeights);
  applyArticleFeatureFeedback(nextWeights, articleFeatures, feedbackWeight, weightRange);
  return nextWeights;
}

function calculateSignalWeight(feature: FeatureSignal, weights: Record<string, number>): number {
  if (feature.salience < salienceThreshold) {
    return 0;
  }

  return (weights[feature.key] ?? 0) * feature.salience;
}

function applySignalFeedback(
  weights: Record<string, number>,
  feature: FeatureSignal,
  feedbackWeight: number,
  weightRange: WeightRange,
): void {
  if (feature.salience < salienceThreshold) {
    return;
  }

  if (!Object.hasOwn(weights, feature.key)) {
    return;
  }

  const currentWeight = weights[feature.key];
  if (currentWeight === undefined) {
    return;
  }

  weights[feature.key] = clamp(
    currentWeight + feedbackWeight * feature.salience,
    weightRange.min,
    weightRange.max,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneArticleFeatureWeights(featureWeights: ArticleFeatureWeights): ArticleFeatureWeights {
  return {
    topics: { ...featureWeights.topics },
    feature_axes: Object.fromEntries(
      Object.entries(featureWeights.feature_axes).map(([axis, weights]) => [axis, { ...weights }]),
    ),
  };
}

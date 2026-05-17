import { describe, expect, it } from "vite-plus/test";

import {
  applyArticleFeatureFeedback,
  calculateArticleFeatureWeight,
  type ArticleFeatures,
  type ArticleFeatureWeights,
} from "src/domains/article";

describe("Article Feature Weighting に関するテスト", () => {
  it("Article Features を渡したとき、Feature Salience を掛けた重みの合計になる", () => {
    // Arrange
    const articleFeatures: ArticleFeatures = {
      primaryTopics: [{ key: "typescript", salience: 0.8 }],
      mentionedTopics: [{ key: "react", salience: 0.7 }],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "implementation_guide", salience: 0.5 }],
      },
      otherSignals: [],
    };
    const featureWeights: ArticleFeatureWeights = {
      topics: { typescript: 0.6, react: 0.4 },
      feature_axes: {
        content_types: { implementation_guide: 0.8 },
      },
    };

    // Act
    const actual = calculateArticleFeatureWeight(articleFeatures, featureWeights);

    // Assert
    expect(actual).toBeCloseTo(0.964);
  });

  it("Reaction Feedback を適用したとき、Article Features の salience に応じて weight が更新される", () => {
    // Arrange
    const featureWeights: ArticleFeatureWeights = {
      topics: { typescript: 0, react: 0 },
      feature_axes: {
        content_types: { implementation_guide: 0 },
      },
    };
    const articleFeatures: ArticleFeatures = {
      primaryTopics: [{ key: "typescript", salience: 0.8 }],
      mentionedTopics: [{ key: "react", salience: 0.7 }],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "implementation_guide", salience: 0.5 }],
      },
      otherSignals: [],
    };

    // Act
    applyArticleFeatureFeedback(featureWeights, articleFeatures, 1, { min: -3, max: 3 });

    // Assert
    expect(featureWeights.topics.typescript).toBeCloseTo(0.8);
    expect(featureWeights.topics.react).toBeCloseTo(0.21);
    expect(featureWeights.feature_axes.content_types?.implementation_guide).toBeCloseTo(0.5);
  });

  it("Feature Salience が閾値未満のとき、weight は使われない", () => {
    // Arrange
    const articleFeatures: ArticleFeatures = {
      primaryTopics: [{ key: "typescript", salience: 0.29 }],
      mentionedTopics: [{ key: "react", salience: 0.69 }],
      unknownTopics: [],
      featureAxes: {},
      otherSignals: [],
    };

    // Act
    const actual = calculateArticleFeatureWeight(articleFeatures, {
      topics: { typescript: 1, react: 1 },
      feature_axes: {},
    });

    // Assert
    expect(actual).toBe(0);
  });
});

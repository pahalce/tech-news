import { describe, expect, it } from "vite-plus/test";

import { createRecommendationCandidate, selectDigestItems } from "src/domains/digest";

describe("Digest Selection Policy に関するテスト", () => {
  it("Feature Axis の Article Feature を渡したとき、weight と salience の積の合計となる", () => {
    // Arrange
    const articleFeatures = {
      primaryTopics: [],
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "implementation_guide", salience: 0.8 }],
        evidence_signals: [{ key: "code_examples", salience: 0.5 }],
      },
      otherSignals: [],
    };
    const preferenceProfile = {
      feature_weights: {
        topics: {},
        feature_axes: {
          content_types: { implementation_guide: 0.8 },
          evidence_signals: { code_examples: 0.6 },
        },
      },
    };

    // Act
    const actual = createRecommendationCandidate({
      articleId,
      articleFeatures,
      preferenceProfile,
    }).ruleScore;

    // Assert
    expect(actual).toBeCloseTo(0.94);
  });

  it("Preference Profile に weight がない Article Feature を渡したとき、score に加算されない", () => {
    // Arrange
    const articleFeatures = {
      primaryTopics: [],
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "release_news", salience: 0.9 }],
      },
      otherSignals: [],
    };
    const preferenceProfile = {
      feature_weights: {
        topics: {},
        feature_axes: {
          content_types: {},
        },
      },
    };

    // Act
    const actual = createRecommendationCandidate({
      articleId,
      articleFeatures,
      preferenceProfile,
    }).ruleScore;

    // Assert
    expect(actual).toBe(0);
  });

  it("salience が 0.3 未満の Article Feature を渡したとき、score に加算されない", () => {
    // Arrange
    const articleFeatures = {
      primaryTopics: [],
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {
        content_types: [{ key: "implementation_guide", salience: 0.29 }],
      },
      otherSignals: [],
    };
    const preferenceProfile = {
      feature_weights: {
        topics: {},
        feature_axes: {
          content_types: { implementation_guide: 0.8 },
        },
      },
    };

    // Act
    const actual = createRecommendationCandidate({
      articleId,
      articleFeatures,
      preferenceProfile,
    }).ruleScore;

    // Assert
    expect(actual).toBe(0);
  });

  it("Primary Topic を渡したとき、topic weight と salience の積が加算される", () => {
    // Arrange
    const articleFeatures = {
      primaryTopics: [{ key: "typescript", salience: 0.8 }],
      mentionedTopics: [],
      unknownTopics: [],
      featureAxes: {},
      otherSignals: [],
    };
    const preferenceProfile = {
      feature_weights: {
        topics: { typescript: 0.6 },
        feature_axes: {},
      },
    };

    // Act
    const actual = createRecommendationCandidate({
      articleId,
      articleFeatures,
      preferenceProfile,
    }).ruleScore;

    // Assert
    expect(actual).toBeCloseTo(0.48);
  });

  it("salience が 0.7 以上の Mentioned Topic を渡したとき、Mentioned Topic Factor を掛けて加算される", () => {
    // Arrange
    const articleFeatures = {
      primaryTopics: [],
      mentionedTopics: [{ key: "react", salience: 0.7 }],
      unknownTopics: [],
      featureAxes: {},
      otherSignals: [],
    };
    const preferenceProfile = {
      feature_weights: {
        topics: { react: 0.6 },
        feature_axes: {},
      },
    };

    // Act
    const actual = createRecommendationCandidate({
      articleId,
      articleFeatures,
      preferenceProfile,
    }).ruleScore;

    // Assert
    expect(actual).toBeCloseTo(0.126);
  });

  it("salience が 0.7 未満の Mentioned Topic を渡したとき、score に加算されない", () => {
    // Arrange
    const articleFeatures = {
      primaryTopics: [],
      mentionedTopics: [{ key: "react", salience: 0.69 }],
      unknownTopics: [],
      featureAxes: {},
      otherSignals: [],
    };
    const preferenceProfile = {
      feature_weights: {
        topics: { react: 0.6 },
        feature_axes: {},
      },
    };

    // Act
    const actual = createRecommendationCandidate({
      articleId,
      articleFeatures,
      preferenceProfile,
    }).ruleScore;

    // Assert
    expect(actual).toBe(0);
  });

  it("Recommendation Candidate から score 降順で Digest Item を選ぶ", () => {
    // Arrange
    const candidates = [
      createRecommendationCandidate({
        articleId: articleIdA,
        articleFeatures: createArticleFeatures("typescript", 0.5),
        preferenceProfile: createPreferenceProfile(1),
      }),
      createRecommendationCandidate({
        articleId: articleIdB,
        articleFeatures: createArticleFeatures("typescript", 0.9),
        preferenceProfile: createPreferenceProfile(1),
      }),
    ];

    // Act
    const actual = selectDigestItems({ candidates, maxItems: 1 });

    // Assert
    expect(actual).toEqual([{ articleId: articleIdB, score: 0.9 }]);
  });

  it("同じ Article Identity の Recommendation Candidate は最初の Digest Item だけ選ぶ", () => {
    // Arrange
    const candidates = [
      createRecommendationCandidate({
        articleId: articleIdA,
        articleFeatures: createArticleFeatures("typescript", 0.9),
        preferenceProfile: createPreferenceProfile(1),
      }),
      createRecommendationCandidate({
        articleId: articleIdA,
        articleFeatures: createArticleFeatures("typescript", 0.5),
        preferenceProfile: createPreferenceProfile(1),
      }),
    ];

    // Act
    const actual = selectDigestItems({ candidates, maxItems: 10 });

    // Assert
    expect(actual).toEqual([{ articleId: articleIdA, score: 0.9 }]);
  });
});

const articleId = "0".repeat(64);
const articleIdA = "a".repeat(64);
const articleIdB = "b".repeat(64);

function createArticleFeatures(topic: string, salience: number) {
  return {
    primaryTopics: [{ key: topic, salience }],
    mentionedTopics: [],
    unknownTopics: [],
    featureAxes: {},
    otherSignals: [],
  };
}

function createPreferenceProfile(weight: number) {
  return {
    feature_weights: {
      topics: { typescript: weight },
      feature_axes: {},
    },
  };
}

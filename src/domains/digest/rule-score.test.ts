import { describe, expect, it } from "vite-plus/test";

import { calculateRuleScore } from "src/domains/digest";

describe("Rule Score に関するテスト", () => {
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
    const actual = calculateRuleScore(articleFeatures, preferenceProfile);

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
    const actual = calculateRuleScore(articleFeatures, preferenceProfile);

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
    const actual = calculateRuleScore(articleFeatures, preferenceProfile);

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
    const actual = calculateRuleScore(articleFeatures, preferenceProfile);

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
    const actual = calculateRuleScore(articleFeatures, preferenceProfile);

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
    const actual = calculateRuleScore(articleFeatures, preferenceProfile);

    // Assert
    expect(actual).toBe(0);
  });
});

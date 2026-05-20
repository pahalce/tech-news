import { describe, expect, it } from "vite-plus/test";

import { scoreCurrentFeedCandidates } from "src/features/digest/application/score-current-feed-candidates-use-case";

describe("Rule Score use case に関するテスト", () => {
  it("Readable Current Feed Candidate を渡したとき、Rule Score 順の候補となる", () => {
    // Arrange
    const currentFeedCandidateFeatures = [
      {
        candidate: {
          articleId: "1".repeat(64),
          source: "zenn",
          canonicalUrl: "https://zenn.dev/example/articles/low",
          title: "Low score",
          feedIds: ["zenn-trend"],
          firstSeenInCurrentFeedsAt: null,
        },
        articleFeatures: {
          primaryTopics: [],
          mentionedTopics: [],
          unknownTopics: [],
          featureAxes: {
            content_types: [{ key: "implementation_guide", salience: 0.5 }],
          },
          otherSignals: [],
        },
      },
      {
        candidate: {
          articleId: "2".repeat(64),
          source: "zenn",
          canonicalUrl: "https://zenn.dev/example/articles/high",
          title: "High score",
          feedIds: ["zenn-trend"],
          firstSeenInCurrentFeedsAt: null,
        },
        articleFeatures: {
          primaryTopics: [],
          mentionedTopics: [],
          unknownTopics: [],
          featureAxes: {
            content_types: [{ key: "implementation_guide", salience: 0.9 }],
          },
          otherSignals: [],
        },
      },
    ];
    const preferenceProfile = {
      feature_weights: {
        topics: {},
        feature_axes: {
          content_types: { implementation_guide: 1 },
        },
      },
    };

    // Act
    const actual = scoreCurrentFeedCandidates({
      currentFeedCandidateFeatures,
      preferenceProfile,
      recommendedArticleIds: [],
    });

    // Assert
    expect(actual.scoredCandidates.map((candidate) => candidate.articleId)).toEqual([
      "2".repeat(64),
      "1".repeat(64),
    ]);
  });

  it("Recommended Article を渡したとき、候補から除外される", () => {
    // Arrange
    const currentFeedCandidateFeatures = [
      {
        candidate: {
          articleId: "3".repeat(64),
          source: "zenn",
          canonicalUrl: "https://zenn.dev/example/articles/recommended",
          title: "Recommended",
          feedIds: ["zenn-trend"],
          firstSeenInCurrentFeedsAt: null,
        },
        articleFeatures: {
          primaryTopics: [{ key: "typescript", salience: 0.9 }],
          mentionedTopics: [],
          unknownTopics: [],
          featureAxes: {},
          otherSignals: [],
        },
      },
    ];
    const preferenceProfile = {
      feature_weights: {
        topics: { typescript: 1 },
        feature_axes: {},
      },
    };

    // Act
    const actual = scoreCurrentFeedCandidates({
      currentFeedCandidateFeatures,
      preferenceProfile,
      recommendedArticleIds: ["3".repeat(64)],
    });

    // Assert
    expect(actual.scoredCandidates).toEqual([]);
  });
});

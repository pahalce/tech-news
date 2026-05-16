import { describe, expect, it } from "vite-plus/test";

import { suggestFeatureVocabularyCandidates } from "./suggest-feature-vocabulary-candidates-use-case";

describe("Feature Vocabulary maintenance suggestion use case に関するテスト", () => {
  it("Other Signals が繰り返し出現したとき、Vocabulary Promotion Candidate になる", async () => {
    // Arrange
    const featureExtractions = [
      createFeatureExtraction(articleIdA, {
        otherSignals: [{ key: "edge_runtime", salience: 0.7 }],
      }),
      createFeatureExtraction(articleIdB, {
        otherSignals: [{ key: "edge_runtime", salience: 0.6 }],
      }),
    ];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(createInput({ featureExtractions }));

    // Assert
    expect(actual.candidates[0]?.key).toBe("edge_runtime");
  });

  it("Other Signal が既存 Feature Vocabulary と重複するとき、候補にならない", async () => {
    // Arrange
    const featureExtractions = [
      createFeatureExtraction(articleIdA, {
        otherSignals: [{ key: "implementation_guide", salience: 0.9 }],
      }),
      createFeatureExtraction(articleIdB, {
        otherSignals: [{ key: "implementation_guide", salience: 0.9 }],
      }),
    ];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(createInput({ featureExtractions }));

    // Assert
    expect(actual.candidates).toEqual([]);
  });

  it("Unknown Topic が 1 記事だけのとき、候補にならない", async () => {
    // Arrange
    const featureExtractions = [createFeatureExtraction(articleIdA, { unknownTopics: ["bun"] })];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(createInput({ featureExtractions }));

    // Assert
    expect(actual.candidates).toEqual([]);
  });

  it("Unknown Topic が繰り返し出現したとき、topic normalization action の候補になる", async () => {
    // Arrange
    const featureExtractions = [
      createFeatureExtraction(articleIdA, { unknownTopics: ["bun"] }),
      createFeatureExtraction(articleIdB, { unknownTopics: ["bun"] }),
    ];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(createInput({ featureExtractions }));

    // Assert
    expect(actual.candidates[0]?.recommendedAction).toBe(
      "Topic Normalization Dictionary への追加を検討",
    );
  });

  it("Vocabulary Promotion Candidate を作成したとき、Agent State に履歴が保存される", async () => {
    // Arrange
    const featureExtractions = [
      createFeatureExtraction(articleIdA, {
        otherSignals: [{ key: "edge_runtime", salience: 0.7 }],
      }),
      createFeatureExtraction(articleIdB, {
        otherSignals: [{ key: "edge_runtime", salience: 0.6 }],
      }),
    ];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(createInput({ featureExtractions }));

    // Assert
    expect(actual.vocabularySuggestionState.suggestionRuns).toHaveLength(1);
  });

  it("抽出が suggestion lookback より古いとき、候補に含めない", async () => {
    // Arrange
    const featureExtractions = [
      createFeatureExtraction(articleIdA, {
        extractedAt: "2026-05-01T00:00:00.000Z",
        otherSignals: [{ key: "edge_runtime", salience: 0.7 }],
      }),
      createFeatureExtraction(articleIdB, {
        extractedAt: "2026-05-02T00:00:00.000Z",
        otherSignals: [{ key: "edge_runtime", salience: 0.6 }],
      }),
    ];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(
      createInput({
        featureExtractions,
        suggestedAt: "2026-05-16T23:30:00.000Z",
      }),
    );

    // Assert
    expect(actual.candidates).toEqual([]);
  });

  it("Vocabulary Promotion Candidate を作成したとき、Feature Vocabulary は自動更新されない", async () => {
    // Arrange
    const featureExtractions = [
      createFeatureExtraction(articleIdA, { unknownTopics: ["bun"] }),
      createFeatureExtraction(articleIdB, { unknownTopics: ["bun"] }),
    ];

    // Act
    const actual = await suggestFeatureVocabularyCandidates(createInput({ featureExtractions }));

    // Assert
    expect(Object.hasOwn(actual.featureVocabulary.topics, "bun")).toBe(false);
  });
});

const articleIdA = `zenn:${"a".repeat(64)}`;
const articleIdB = `zenn:${"b".repeat(64)}`;

function createInput(input: {
  featureExtractions: ReturnType<typeof createFeatureExtraction>[];
  suggestedAt?: string;
}) {
  return {
    featureExtractions: input.featureExtractions,
    featureVocabulary: {
      topics: {
        typescript: {},
      },
      feature_axes: {
        content_types: {
          features: {
            implementation_guide: {},
          },
        },
      },
    },
    publicationRecords: [],
    vocabularySuggestionState: {
      version: 1 as const,
      suggestionRuns: [],
    },
    suggestedAt: input.suggestedAt ?? "2026-05-16T23:30:00.000Z",
    describer: {
      describe: async ({ key }: { key: string }) => `${key} に関する候補`,
    },
    notifier: {
      notify: async () => {},
    },
  };
}

function createFeatureExtraction(
  articleId: string,
  articleFeatures: {
    extractedAt?: string;
    otherSignals?: Array<{ key: string; salience: number }>;
    unknownTopics?: string[];
  },
) {
  return {
    articleId,
    extractedAt: articleFeatures.extractedAt ?? "2026-05-16T00:00:00.000Z",
    readability: {
      isReadable: true,
      reason: null,
    },
    articleFeatures: {
      primaryTopics: [],
      mentionedTopics: [],
      unknownTopics: articleFeatures.unknownTopics ?? [],
      featureAxes: {},
      otherSignals: articleFeatures.otherSignals ?? [],
    },
    author: null,
  };
}

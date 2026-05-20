import { describe, expect, it } from "vite-plus/test";

import {
  createBodyFetchFailure,
  createFailedExtractionAttempt,
  createFeatureExtraction,
} from "src/domains/article";

const articleId = "a".repeat(64);

describe("Feature Extraction domain model に関するテスト", () => {
  it("Readable Article を抽出したとき、Primary Topic が正規化されて保存される", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return topic.toLowerCase() === "typescript"
          ? { kind: "known_topic" as const, topicKey: "typescript", displayName: "TypeScript" }
          : { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        analysis: {
          readability: {
            isReadable: true,
            reason: null,
          },
          primaryTopics: [{ key: "TypeScript", salience: 0.9 }],
          mentionedTopics: [],
          featureAxes: {},
          otherSignals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.primaryTopics).toEqual([{ key: "typescript", salience: 0.9 }]);
  });

  it("著者情報が渡されたとき、Feature Extraction に保存される", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        author: {
          username: "neet",
          displayName: "Ryō Igarashi",
          publicationName: null,
        },
        analysis: {
          readability: {
            isReadable: true,
            reason: null,
          },
          primaryTopics: [],
          mentionedTopics: [],
          featureAxes: {},
          otherSignals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.author).toEqual({
      username: "neet",
      displayName: "Ryō Igarashi",
      publicationName: null,
    });
  });

  it("同じ Primary Topic の alias が複数抽出されたとき、最大 salience で保存される", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return ["typescript", "ts"].includes(topic.toLowerCase())
          ? { kind: "known_topic" as const, topicKey: "typescript", displayName: "TypeScript" }
          : { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        analysis: {
          readability: {
            isReadable: true,
            reason: null,
          },
          primaryTopics: [
            { key: "TypeScript", salience: 0.4 },
            { key: "ts", salience: 0.9 },
          ],
          mentionedTopics: [],
          featureAxes: {},
          otherSignals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.primaryTopics).toEqual([{ key: "typescript", salience: 0.9 }]);
  });

  it("同じ Topic が Primary Topic と Mentioned Topic に抽出されたとき、Primary Topic だけに保存される", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return ["typescript", "ts"].includes(topic.toLowerCase())
          ? { kind: "known_topic" as const, topicKey: "typescript", displayName: "TypeScript" }
          : { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        analysis: {
          readability: {
            isReadable: true,
            reason: null,
          },
          primaryTopics: [{ key: "TypeScript", salience: 0.8 }],
          mentionedTopics: [{ key: "ts", salience: 1 }],
          featureAxes: {},
          otherSignals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.mentionedTopics).toEqual([]);
  });

  it("Unknown Topic が抽出されたとき、unknownTopics に保存される", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return topic.toLowerCase() === "typescript"
          ? { kind: "known_topic" as const, topicKey: "typescript", displayName: "TypeScript" }
          : { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        analysis: {
          readability: {
            isReadable: true,
            reason: null,
          },
          primaryTopics: ["TypeScript"],
          mentionedTopics: ["Rust"],
          featureAxes: {},
          otherSignals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.unknownTopics).toEqual(["rust"]);
  });

  it("Other Signal が抽出されたとき、otherSignals に保存される", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        analysis: {
          readability: {
            isReadable: true,
            reason: null,
          },
          primaryTopics: [],
          mentionedTopics: [],
          featureAxes: {},
          otherSignals: [{ key: "ownership_model", salience: 0.7 }],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.otherSignals).toEqual([
      { key: "ownership_model", salience: 0.7 },
    ]);
  });

  it("Article Feature Analysis が summary を返したとき、検証エラーとなる", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = () =>
      createFeatureExtraction(
        {
          articleId: articleId,
          extractedAt: "2026-05-13T00:00:00.000Z",
          analysis: {
            readability: {
              isReadable: true,
              reason: null,
            },
            primaryTopics: [],
            mentionedTopics: [],
            featureAxes: {},
            otherSignals: [],
            summary: "digest text must not be produced here",
          },
        },
        featureVocabulary,
      );

    // Assert
    expect(actual).toThrow("Invalid key");
  });

  it("Unreadable Article に未定義 Feature Axis が含まれるとき、Article Features は保存されない", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        analysis: {
          readability: {
            isReadable: false,
            reason: "本文が短すぎて Article Features を信頼できない",
          },
          primaryTopics: ["HallucinatedTopic"],
          mentionedTopics: [],
          featureAxes: {
            hallucinated_axis: [{ key: "not_in_vocabulary", salience: 0.9 }],
          },
          otherSignals: [{ key: "ignored_signal", salience: 0.9 }],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures).toBeNull();
  });

  it("Feature Extraction の日時が不正なとき、検証エラーとなる", () => {
    // Arrange
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = () =>
      createFeatureExtraction(
        {
          articleId: articleId,
          extractedAt: "not a date",
          analysis: {
            readability: {
              isReadable: false,
              reason: "本文が短い",
            },
            primaryTopics: [],
            mentionedTopics: [],
            featureAxes: {},
            otherSignals: [],
          },
        },
        featureVocabulary,
      );

    // Assert
    expect(actual).toThrow("value must be a date string");
  });

  it("Body Fetch Failure の message が空のとき、検証エラーとなる", () => {
    // Arrange

    // Act
    const actual = () =>
      createBodyFetchFailure({
        articleId: articleId,
        failedAt: "2026-05-13T00:00:00.000Z",
        message: "",
      });

    // Assert
    expect(actual).toThrow("fetch failure message must not be empty");
  });

  it("Failed Extraction Attempt の message が空のとき、検証エラーとなる", () => {
    // Arrange

    // Act
    const actual = () =>
      createFailedExtractionAttempt({
        articleId: articleId,
        attemptedAt: "2026-05-13T00:00:00.000Z",
        message: "",
      });

    // Assert
    expect(actual).toThrow("failed extraction message must not be empty");
  });
});

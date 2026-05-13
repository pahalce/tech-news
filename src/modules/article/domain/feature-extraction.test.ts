import { describe, expect, it } from "vite-plus/test";

import { createArticleIdentity } from "./article-identity";
import {
  createBodyFetchFailure,
  createFailedExtractionAttempt,
  createFeatureExtraction,
} from "./feature-extraction";

describe("Feature Extraction domain model に関するテスト", () => {
  it("Readable Article を抽出したとき、Primary Topic が正規化されて保存される", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/readable-article",
    );
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
        articleId: identity.articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        llmOutput: {
          readability: {
            is_readable: true,
            reason: null,
          },
          primary_topics: [{ key: "TypeScript", salience: 0.9 }],
          mentioned_topics: [],
          feature_axes: {},
          other_signals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.primaryTopics).toEqual([{ key: "typescript", salience: 0.9 }]);
  });

  it("同じ Primary Topic の alias が複数抽出されたとき、最大 salience で保存される", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/primary-topic-aliases",
    );
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
        articleId: identity.articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        llmOutput: {
          readability: {
            is_readable: true,
            reason: null,
          },
          primary_topics: [
            { key: "TypeScript", salience: 0.4 },
            { key: "ts", salience: 0.9 },
          ],
          mentioned_topics: [],
          feature_axes: {},
          other_signals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.primaryTopics).toEqual([{ key: "typescript", salience: 0.9 }]);
  });

  it("同じ Topic が Primary Topic と Mentioned Topic に抽出されたとき、Primary Topic だけに保存される", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/primary-mentioned-overlap",
    );
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
        articleId: identity.articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        llmOutput: {
          readability: {
            is_readable: true,
            reason: null,
          },
          primary_topics: [{ key: "TypeScript", salience: 0.8 }],
          mentioned_topics: [{ key: "ts", salience: 1 }],
          feature_axes: {},
          other_signals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.mentionedTopics).toEqual([]);
  });

  it("Unknown Topic が抽出されたとき、unknownTopics に保存される", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/unknown-topic",
    );
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
        articleId: identity.articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        llmOutput: {
          readability: {
            is_readable: true,
            reason: null,
          },
          primary_topics: ["TypeScript"],
          mentioned_topics: ["Rust"],
          feature_axes: {},
          other_signals: [],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.unknownTopics).toEqual(["rust"]);
  });

  it("Other Signal が抽出されたとき、otherSignals に保存される", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/other-signal",
    );
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: identity.articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        llmOutput: {
          readability: {
            is_readable: true,
            reason: null,
          },
          primary_topics: [],
          mentioned_topics: [],
          feature_axes: {},
          other_signals: [{ key: "ownership_model", salience: 0.7 }],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures?.otherSignals).toEqual([
      { key: "ownership_model", salience: 0.7 },
    ]);
  });

  it("LLM が summary を返したとき、検証エラーとなる", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/digest-text",
    );
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
          articleId: identity.articleId,
          extractedAt: "2026-05-13T00:00:00.000Z",
          llmOutput: {
            readability: {
              is_readable: true,
              reason: null,
            },
            primary_topics: [],
            mentioned_topics: [],
            feature_axes: {},
            other_signals: [],
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
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/unreadable-article",
    );
    const featureVocabulary = {
      feature_axes: {},
      normalizeTopic(topic: string) {
        return { kind: "unknown_topic" as const, normalizedTopic: topic.toLowerCase() };
      },
    };

    // Act
    const actual = createFeatureExtraction(
      {
        articleId: identity.articleId,
        extractedAt: "2026-05-13T00:00:00.000Z",
        llmOutput: {
          readability: {
            is_readable: false,
            reason: "本文が短すぎて Article Features を信頼できない",
          },
          primary_topics: ["HallucinatedTopic"],
          mentioned_topics: [],
          feature_axes: {
            hallucinated_axis: [{ key: "not_in_vocabulary", salience: 0.9 }],
          },
          other_signals: [{ key: "ignored_signal", salience: 0.9 }],
        },
      },
      featureVocabulary,
    );

    // Assert
    expect(actual.articleFeatures).toBeNull();
  });

  it("Feature Extraction の日時が不正なとき、検証エラーとなる", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/invalid-date",
    );
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
          articleId: identity.articleId,
          extractedAt: "not a date",
          llmOutput: {
            readability: {
              is_readable: false,
              reason: "本文が短い",
            },
            primary_topics: [],
            mentioned_topics: [],
            feature_axes: {},
            other_signals: [],
          },
        },
        featureVocabulary,
      );

    // Assert
    expect(actual).toThrow("value must be a date string");
  });

  it("Body Fetch Failure の message が空のとき、検証エラーとなる", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/fetch-failure",
    );

    // Act
    const actual = () =>
      createBodyFetchFailure({
        articleId: identity.articleId,
        failedAt: "2026-05-13T00:00:00.000Z",
        message: "",
      });

    // Assert
    expect(actual).toThrow("fetch failure message must not be empty");
  });

  it("Failed Extraction Attempt の message が空のとき、検証エラーとなる", () => {
    // Arrange
    const identity = createArticleIdentity(
      "zenn",
      "https://zenn.dev/kazuyataira/articles/extraction-failure",
    );

    // Act
    const actual = () =>
      createFailedExtractionAttempt({
        articleId: identity.articleId,
        attemptedAt: "2026-05-13T00:00:00.000Z",
        message: "",
      });

    // Assert
    expect(actual).toThrow("failed extraction message must not be empty");
  });
});

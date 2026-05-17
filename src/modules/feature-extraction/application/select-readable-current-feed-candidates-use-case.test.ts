import { describe, expect, it } from "vite-plus/test";

import { createCurrentFeedCandidate } from "src/modules/article/application/current-feed-candidate";
import { selectReadableCurrentFeedCandidates } from "src/modules/feature-extraction/application/select-readable-current-feed-candidates-use-case";

describe("Readable Current Feed Candidate selection use case に関するテスト", () => {
  it("Current Feed Candidate に Readable Feature Extraction があるとき、Readable Current Feed Candidate となる", () => {
    // Arrange
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Readable current article",
        url: "https://zenn.dev/example/articles/readable-current",
        publishedAt: null,
      },
    );

    // Act
    const actual = selectReadableCurrentFeedCandidates({
      currentFeedCandidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [
          {
            articleId: candidate.articleId,
            extractedAt: "2026-05-13T00:00:00.000Z",
            readability: { isReadable: true, reason: null },
            articleFeatures: {
              primaryTopics: [{ key: "typescript", salience: 0.8 }],
              mentionedTopics: [],
              unknownTopics: [],
              featureAxes: {},
              otherSignals: [],
            },
            author: null,
          },
        ],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
    });

    // Assert
    expect(actual.readableCandidates.map((readable) => readable.candidate.articleId)).toEqual([
      candidate.articleId,
    ]);
  });

  it("Current Feed Candidate に Feature Extraction がないとき、Readable Current Feed Candidate から除外される", () => {
    // Arrange
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Missing extraction article",
        url: "https://zenn.dev/example/articles/missing-extraction",
        publishedAt: null,
      },
    );

    // Act
    const actual = selectReadableCurrentFeedCandidates({
      currentFeedCandidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
    });

    // Assert
    expect(actual.readableCandidates).toEqual([]);
  });

  it("Current Feed Candidate に unreadable Feature Extraction があるとき、Readable Current Feed Candidate から除外される", () => {
    // Arrange
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Unreadable current article",
        url: "https://zenn.dev/example/articles/unreadable-current",
        publishedAt: null,
      },
    );

    // Act
    const actual = selectReadableCurrentFeedCandidates({
      currentFeedCandidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [
          {
            articleId: candidate.articleId,
            extractedAt: "2026-05-13T00:00:00.000Z",
            readability: { isReadable: false, reason: "本文が短い" },
            articleFeatures: null,
            author: null,
          },
        ],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
    });

    // Assert
    expect(actual.readableCandidates).toEqual([]);
  });

  it("Feature Extraction 済みの記事が Current Feed Candidate にないとき、Readable Current Feed Candidate から除外される", () => {
    // Arrange
    const candidate = createCurrentFeedCandidate(
      { id: "zenn-trend", source: "zenn", url: "https://zenn.dev/feed" },
      {
        title: "Current article",
        url: "https://zenn.dev/example/articles/current",
        publishedAt: null,
      },
    );

    // Act
    const actual = selectReadableCurrentFeedCandidates({
      currentFeedCandidates: [candidate],
      featureExtractionState: {
        version: 1,
        extractions: [
          {
            articleId: candidate.articleId,
            extractedAt: "2026-05-13T00:00:00.000Z",
            readability: { isReadable: true, reason: null },
            articleFeatures: {
              primaryTopics: [{ key: "typescript", salience: 0.8 }],
              mentionedTopics: [],
              unknownTopics: [],
              featureAxes: {},
              otherSignals: [],
            },
            author: null,
          },
          {
            articleId: "zenn:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            extractedAt: "2026-05-12T00:00:00.000Z",
            readability: { isReadable: true, reason: null },
            articleFeatures: {
              primaryTopics: [{ key: "typescript", salience: 1 }],
              mentionedTopics: [],
              unknownTopics: [],
              featureAxes: {},
              otherSignals: [],
            },
            author: null,
          },
        ],
        bodyFetchFailures: [],
        failedExtractionAttempts: [],
      },
    });

    // Assert
    expect(actual.readableCandidates.map((readable) => readable.candidate.articleId)).toEqual([
      candidate.articleId,
    ]);
  });
});

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { createFileDigestStateRepositories } from "src/features/digest/infrastructure/file-digest-state-repositories";

describe("State Repositories 読み込みに関するテスト", () => {
  describe("有効データの読み込みに関するテスト", () => {
    it("既定データを読み込んだとき、Preference Profile の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.preferenceProfile.version).toBe(1);
    });

    it("既定データを読み込んだとき、Article Extraction Registry の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.articleExtractionRegistry.version).toBe(1);
    });

    it("既定データを読み込んだとき、topics.typescript の重みが 0.6 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(0.6);
    });

    it("既定データを読み込んだとき、Preference Summary History の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.preferenceSummaryHistory.version).toBe(1);
    });

    it("既定データを読み込んだとき、recent_summary.confidence が low となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.preferenceSummaryHistory.recent_summary.confidence).toBe("low");
    });

    it("既定データを読み込んだとき、Recommendation Content History の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.recommendationContentHistory.version).toBe(1);
    });

    it("既定データを読み込んだとき、Published Digest Registry の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.publishedDigestRegistry.version).toBe(1);
    });
  });

  describe("重みバリデーションに関するテスト", () => {
    it("topics の重みが範囲外のとき、範囲エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {
            typescript: 4,
          },
          feature_axes: {},
        },
        updated_at: null,
      });

      // Act
      const actual = loadStateForTest(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "feature_weights.topics.typescript must be between -3 and 3",
      );
    });

    it("feature_axes の重みが範囲外のとき、範囲エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {
            typescript: 0.6,
          },
          feature_axes: {
            depth_signals: {
              thin_content: -4,
            },
          },
        },
        updated_at: null,
      });

      // Act
      const actual = loadStateForTest(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "feature_weights.feature_axes.depth_signals.thin_content must be between -3 and 3",
      );
    });

    it("Feature Vocabulary にある Topic Key の重みが欠けているとき、整合性エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {},
          feature_axes: {
            depth_signals: {
              thin_content: -0.9,
            },
          },
        },
        updated_at: null,
      });

      // Act
      const actual = loadStateForTest(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "Preference Profile feature_weights.topics.typescript is required by Feature Vocabulary",
      );
    });

    it("初期 Preference Profile の seed weight が seed range を超えるとき、範囲エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {
            typescript: 1.2,
          },
          feature_axes: {
            depth_signals: {
              thin_content: -0.9,
            },
          },
        },
        updated_at: null,
      });

      // Act
      const actual = loadStateForTest(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "Preference Profile seed feature_weights.topics.typescript must be between -1 and 1",
      );
    });

    it("更新済み Preference Profile の重みが seed range を超えても weight range 内なら読み込める", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {
            typescript: 1.2,
          },
          feature_axes: {
            depth_signals: {
              thin_content: -0.9,
            },
          },
        },
        updated_at: "2026-05-16T05:16:04.404Z",
      });

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(1.2);
    });

    it("Preference Profile に Feature Vocabulary 未定義の Feature Axis があるとき、整合性エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {
            typescript: 0.6,
          },
          feature_axes: {
            depth_signals: {
              thin_content: -0.9,
            },
            quality_signals: {
              deep_article: 0.8,
            },
          },
        },
        updated_at: null,
      });

      // Act
      const actual = loadStateForTest(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "Preference Profile feature_weights.feature_axes.quality_signals is not defined in Feature Vocabulary",
      );
    });
  });

  describe("保存に関するテスト", () => {
    it("State Repositories を保存したとき、保存後の JSON を再読み込みできる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeStateFiles(repositoryRoot, {
        version: 1,
        weight_range: { min: -3, max: 3 },
        seed_weight_range: { min: -1, max: 1 },
        feature_weights: {
          topics: {
            typescript: 0.6,
          },
          feature_axes: {
            depth_signals: {
              thin_content: -0.9,
            },
          },
        },
        updated_at: null,
      });
      const state = await loadStateForTest(repositoryRoot);

      // Act
      await saveStateForTest(repositoryRoot, {
        ...state.preferenceProfile,
        feature_weights: {
          ...state.preferenceProfile.feature_weights,
          topics: {
            ...state.preferenceProfile.feature_weights.topics,
            typescript: 0.8,
          },
        },
      });
      const actual = JSON.parse(
        await readFile(join(repositoryRoot, "data", "preference-profile.json"), "utf8"),
      ) as { feature_weights: { topics: { typescript: number } } };

      // Assert
      expect(actual.feature_weights.topics.typescript).toBe(0.8);
    });
  });

  describe("Article ID normalization に関するテスト", () => {
    it("legacy source-prefixed Article ID を読み込んだとき、URL hash-only Article ID に正規化する", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      const legacyArticleId = `zenn:${"a".repeat(64)}`;
      await writeStateFiles(
        repositoryRoot,
        {
          version: 1,
          weight_range: { min: -3, max: 3 },
          seed_weight_range: { min: -1, max: 1 },
          feature_weights: {
            topics: {
              typescript: 0.6,
            },
            feature_axes: {
              depth_signals: {
                thin_content: -0.9,
              },
            },
          },
          updated_at: null,
        },
        legacyArticleId,
      );

      // Act
      const actual = await loadStateForTest(repositoryRoot);

      // Assert
      expect(actual.articleExtractionRegistry.extractions[0]?.articleId).toBe("a".repeat(64));
    });

    it("正規化後に保存したとき、URL hash-only Article ID を JSON に保存する", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      const legacyArticleId = `zenn:${"b".repeat(64)}`;
      await writeStateFiles(
        repositoryRoot,
        {
          version: 1,
          weight_range: { min: -3, max: 3 },
          seed_weight_range: { min: -1, max: 1 },
          feature_weights: {
            topics: {
              typescript: 0.6,
            },
            feature_axes: {
              depth_signals: {
                thin_content: -0.9,
              },
            },
          },
          updated_at: null,
        },
        legacyArticleId,
      );
      const repositories = createFileDigestStateRepositories(repositoryRoot);
      const registry = await repositories.publishedDigestRegistry.load();

      // Act
      await repositories.publishedDigestRegistry.save(registry);
      const actual = JSON.parse(
        await readFile(join(repositoryRoot, "data", "publication-state.json"), "utf8"),
      ) as { publicationRecords: Array<{ articleId: string }> };

      // Assert
      expect(actual.publicationRecords[0]?.articleId).toBe("b".repeat(64));
    });
  });
});

async function writeStateFiles(
  repositoryRoot: string,
  preferenceProfile: unknown,
  articleId = "a".repeat(64),
) {
  await mkdir(join(repositoryRoot, "config"), { recursive: true });
  await mkdir(join(repositoryRoot, "data"), { recursive: true });
  await writeJson(join(repositoryRoot, "config", "feature-vocabulary.json"), {
    version: 1,
    topics: {
      typescript: {
        display_name: "TypeScript",
        aliases: ["typescript"],
        description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
      },
    },
    feature_axes: {
      depth_signals: {
        description_ja: "記事の掘り下げの深さや表層性",
        features: {
          thin_content: {
            description_ja: "情報量が少なく、再利用できる具体的な知見が乏しい",
          },
        },
      },
    },
  });
  await writeJson(join(repositoryRoot, "data", "preference-profile.json"), preferenceProfile);
  await writeJson(join(repositoryRoot, "data", "feature-extraction-state.json"), {
    version: 1,
    extractions: [
      {
        articleId,
        extractedAt: "2026-05-18T00:00:00.000Z",
        readability: { isReadable: false, reason: "fixture" },
        articleFeatures: null,
      },
    ],
    bodyFetchFailures: [{ articleId, failedAt: "2026-05-18T00:00:00.000Z", message: "fixture" }],
    failedExtractionAttempts: [
      { articleId, attemptedAt: "2026-05-18T00:00:00.000Z", message: "fixture" },
    ],
  });
  await writeJson(join(repositoryRoot, "data", "preference-summary-history.json"), {
    version: 1,
    long_term_summary: null,
    recent_summary: {
      window_days: 7,
      summary: null,
      confidence: "insufficient_feedback",
    },
    history: [],
  });
  await writeJson(join(repositoryRoot, "data", "recommendation-content-state.json"), {
    version: 1,
    recommendationContents: [
      {
        articleId,
        summary: "summary",
        whyRecommended: "why",
        learningPoints: ["learn"],
        signalsUsed: ["signal"],
      },
    ],
  });
  await writeJson(join(repositoryRoot, "data", "publication-state.json"), {
    version: 1,
    publicationRecords: [
      {
        articleId,
        deliveryReference: {
          externalSystem: "discord",
          destination: "channel",
          id: "message",
        },
        postedAt: "2026-05-18T00:00:00.000Z",
        reactionFeedback: [],
      },
    ],
    recommendedArticles: [{ articleId, firstRecommendedAt: "2026-05-18T00:00:00.000Z" }],
  });
  await writeJson(join(repositoryRoot, "data", "vocabulary-suggestion-state.json"), {
    version: 1,
    suggestionRuns: [],
  });
}

async function loadStateForTest(repositoryRoot?: string) {
  const repositories = createFileDigestStateRepositories(repositoryRoot);

  const [
    articleExtractionRegistry,
    preferenceProfile,
    preferenceSummaryHistory,
    publishedDigestRegistry,
    recommendationContentHistory,
  ] = await Promise.all([
    repositories.articleExtractionRegistry.load(),
    repositories.preferenceProfile.load(),
    repositories.preferenceSummaryHistory.load(),
    repositories.publishedDigestRegistry.load(),
    repositories.recommendationContentHistory.load(),
  ]);

  return {
    articleExtractionRegistry,
    preferenceProfile,
    preferenceSummaryHistory,
    publishedDigestRegistry,
    recommendationContentHistory,
  };
}

async function saveStateForTest(
  repositoryRoot: string,
  preferenceProfile: Awaited<ReturnType<typeof loadStateForTest>>["preferenceProfile"],
) {
  await createFileDigestStateRepositories(repositoryRoot).preferenceProfile.save(preferenceProfile);
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

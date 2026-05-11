import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { loadRepositoryState } from "./repository-state";

describe("Repository State 読み込みに関するテスト", () => {
  describe("有効データの読み込みに関するテスト", () => {
    it("既定データを読み込んだとき、Preference Profile の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadRepositoryState(repositoryRoot);

      // Assert
      expect(actual.preferenceProfile.version).toBe(1);
    });

    it("既定データを読み込んだとき、topics.typescript の重みが 0.6 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadRepositoryState(repositoryRoot);

      // Assert
      expect(actual.preferenceProfile.feature_weights.topics.typescript).toBe(0.6);
    });

    it("既定データを読み込んだとき、Preference Summary History の version が 1 となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadRepositoryState(repositoryRoot);

      // Assert
      expect(actual.preferenceSummaryHistory.version).toBe(1);
    });

    it("既定データを読み込んだとき、recent_summary.confidence が insufficient_feedback となる", async () => {
      // Arrange
      const repositoryRoot = undefined;

      // Act
      const actual = await loadRepositoryState(repositoryRoot);

      // Assert
      expect(actual.preferenceSummaryHistory.recent_summary.confidence).toBe(
        "insufficient_feedback",
      );
    });
  });

  describe("重みバリデーションに関するテスト", () => {
    it("topics の重みが範囲外のとき、範囲エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeRepositoryState(repositoryRoot, {
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
      const actual = loadRepositoryState(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "feature_weights.topics.typescript must be between -3 and 3",
      );
    });

    it("feature_axes の重みが範囲外のとき、範囲エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeRepositoryState(repositoryRoot, {
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
      const actual = loadRepositoryState(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "feature_weights.feature_axes.depth_signals.thin_content must be between -3 and 3",
      );
    });

    it("Feature Vocabulary にある Topic Key の重みが欠けているとき、整合性エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeRepositoryState(repositoryRoot, {
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
      const actual = loadRepositoryState(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "Preference Profile feature_weights.topics.typescript is required by Feature Vocabulary",
      );
    });

    it("初期 Preference Profile の seed weight が seed range を超えるとき、範囲エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeRepositoryState(repositoryRoot, {
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
      const actual = loadRepositoryState(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "Preference Profile seed feature_weights.topics.typescript must be between -1 and 1",
      );
    });

    it("Preference Profile に Feature Vocabulary 未定義の Feature Axis があるとき、整合性エラーとなる", async () => {
      // Arrange
      const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-state-"));
      await writeRepositoryState(repositoryRoot, {
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
      const actual = loadRepositoryState(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "Preference Profile feature_weights.feature_axes.quality_signals is not defined in Feature Vocabulary",
      );
    });
  });
});

async function writeRepositoryState(repositoryRoot: string, preferenceProfile: unknown) {
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
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

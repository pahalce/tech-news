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
      await mkdir(join(repositoryRoot, "data"));
      await writeJson(join(repositoryRoot, "data", "preference-profile.json"), {
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
      await mkdir(join(repositoryRoot, "data"));
      await writeJson(join(repositoryRoot, "data", "preference-profile.json"), {
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

      // Act
      const actual = loadRepositoryState(repositoryRoot);

      // Assert
      await expect(actual).rejects.toThrow(
        "feature_weights.feature_axes.depth_signals.thin_content must be between -3 and 3",
      );
    });
  });
});

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

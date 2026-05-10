import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { loadRepositoryState } from "./repository-state";

describe("Repository State loading", () => {
  it("loads the initial Preference Profile and Preference Summary History from data files", async () => {
    const state = await loadRepositoryState();

    expect(state.preferenceProfile.version).toBe(1);
    expect(state.preferenceProfile.feature_weights.topics.typescript).toBe(0.6);
    expect(state.preferenceSummaryHistory.version).toBe(1);
    expect(state.preferenceSummaryHistory.recent_summary.confidence).toBe("insufficient_feedback");
  });

  it("rejects invalid Repository State JSON before returning it", async () => {
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

    await expect(loadRepositoryState(repositoryRoot)).rejects.toThrow(
      "feature_weights.topics.typescript must be between -3 and 3",
    );
  });
});

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

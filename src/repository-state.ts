import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as v from "valibot";

const FiniteNumberSchema = v.pipe(v.number(), v.finite());

const WeightRangeSchema = v.pipe(
  v.object({
    min: FiniteNumberSchema,
    max: FiniteNumberSchema,
  }),
  v.check((range) => range.min <= range.max, "min must be less than or equal to max."),
);

const NumberRecordSchema = v.record(v.string(), FiniteNumberSchema);

const PreferenceProfileSchema = v.object({
  version: v.literal(1),
  weight_range: WeightRangeSchema,
  seed_weight_range: WeightRangeSchema,
  feature_weights: v.object({
    topics: NumberRecordSchema,
    feature_axes: v.record(v.string(), NumberRecordSchema),
  }),
  updated_at: v.nullable(v.string()),
});

const PreferenceSummaryHistorySchema = v.object({
  version: v.literal(1),
  long_term_summary: v.nullable(v.string()),
  recent_summary: v.object({
    window_days: FiniteNumberSchema,
    summary: v.nullable(v.string()),
    confidence: v.string(),
  }),
  history: v.array(v.unknown()),
});

export type PreferenceProfile = v.InferOutput<typeof PreferenceProfileSchema>;

export type PreferenceSummaryHistory = v.InferOutput<typeof PreferenceSummaryHistorySchema>;

export type RepositoryState = {
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
};

type WeightRange = {
  min: number;
  max: number;
};

const defaultRepositoryRoot = join(import.meta.dirname, "..");

export async function loadRepositoryState(
  repositoryRoot = defaultRepositoryRoot,
): Promise<RepositoryState> {
  const [preferenceProfileJson, preferenceSummaryHistoryJson] = await Promise.all([
    readJson(join(repositoryRoot, "data", "preference-profile.json")),
    readJson(join(repositoryRoot, "data", "preference-summary-history.json")),
  ]);

  return {
    preferenceProfile: parsePreferenceProfile(preferenceProfileJson),
    preferenceSummaryHistory: parsePreferenceSummaryHistory(preferenceSummaryHistoryJson),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function parsePreferenceProfile(value: unknown): PreferenceProfile {
  const profile = v.parse(PreferenceProfileSchema, value);
  assertWeightsInRange(
    profile.feature_weights.topics,
    "Preference Profile feature_weights.topics",
    profile.weight_range,
  );

  for (const [axis, weights] of Object.entries(profile.feature_weights.feature_axes)) {
    assertWeightsInRange(
      weights,
      `Preference Profile feature_weights.feature_axes.${axis}`,
      profile.weight_range,
    );
  }

  return profile;
}

function parsePreferenceSummaryHistory(value: unknown): PreferenceSummaryHistory {
  return v.parse(PreferenceSummaryHistorySchema, value);
}

function assertWeightsInRange(
  weights: Record<string, number>,
  label: string,
  weightRange: WeightRange,
): void {
  for (const [key, weight] of Object.entries(weights)) {
    if (weight < weightRange.min || weight > weightRange.max) {
      throw new Error(`${label}.${key} must be between ${weightRange.min} and ${weightRange.max}.`);
    }
  }
}

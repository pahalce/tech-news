import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as v from "valibot";

import { loadFeatureVocabularyConfig, type FeatureVocabularyConfig } from "../../feature";

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

export type AgentState = {
  featureVocabulary: FeatureVocabularyConfig;
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
};

type WeightRange = {
  min: number;
  max: number;
};

const defaultRepositoryRoot = join(import.meta.dirname, "../../../..");

export async function loadAgentState(repositoryRoot = defaultRepositoryRoot): Promise<AgentState> {
  const [featureVocabulary, preferenceProfileJson, preferenceSummaryHistoryJson] =
    await Promise.all([
      loadFeatureVocabularyConfig(repositoryRoot),
      readJson(join(repositoryRoot, "data", "preference-profile.json")),
      readJson(join(repositoryRoot, "data", "preference-summary-history.json")),
    ]);
  const preferenceProfile = parsePreferenceProfile(preferenceProfileJson, featureVocabulary);

  return {
    featureVocabulary,
    preferenceProfile,
    preferenceSummaryHistory: parsePreferenceSummaryHistory(preferenceSummaryHistoryJson),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function parsePreferenceProfile(
  value: unknown,
  featureVocabulary: FeatureVocabularyConfig,
): PreferenceProfile {
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
  assertPreferenceProfileMatchesFeatureVocabulary(profile, featureVocabulary);

  if (profile.updated_at === null) {
    assertWeightsInRange(
      profile.feature_weights.topics,
      "Preference Profile seed feature_weights.topics",
      profile.seed_weight_range,
    );

    for (const [axis, weights] of Object.entries(profile.feature_weights.feature_axes)) {
      assertWeightsInRange(
        weights,
        `Preference Profile seed feature_weights.feature_axes.${axis}`,
        profile.seed_weight_range,
      );
    }
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

function assertPreferenceProfileMatchesFeatureVocabulary(
  profile: PreferenceProfile,
  featureVocabulary: FeatureVocabularyConfig,
): void {
  assertKnownKeys(
    profile.feature_weights.topics,
    featureVocabulary.topics,
    "Preference Profile feature_weights.topics",
    "Feature Vocabulary",
  );

  for (const [axis, vocabularyAxis] of Object.entries(featureVocabulary.feature_axes)) {
    const profileAxis = profile.feature_weights.feature_axes[axis];
    if (!profileAxis) {
      throw new Error(
        `Preference Profile feature_weights.feature_axes.${axis} is required by Feature Vocabulary.`,
      );
    }

    assertKnownKeys(
      profileAxis,
      vocabularyAxis.features,
      `Preference Profile feature_weights.feature_axes.${axis}`,
      "Feature Vocabulary",
    );
  }

  for (const axis of Object.keys(profile.feature_weights.feature_axes)) {
    if (!Object.hasOwn(featureVocabulary.feature_axes, axis)) {
      throw new Error(
        `Preference Profile feature_weights.feature_axes.${axis} is not defined in Feature Vocabulary.`,
      );
    }
  }
}

function assertKnownKeys(
  profileWeights: Record<string, number>,
  vocabularyEntries: Record<string, unknown>,
  profilePath: string,
  vocabularyLabel: string,
): void {
  for (const key of Object.keys(vocabularyEntries)) {
    if (!Object.hasOwn(profileWeights, key)) {
      throw new Error(`${profilePath}.${key} is required by ${vocabularyLabel}.`);
    }
  }

  for (const key of Object.keys(profileWeights)) {
    if (!Object.hasOwn(vocabularyEntries, key)) {
      throw new Error(`${profilePath}.${key} is not defined in ${vocabularyLabel}.`);
    }
  }
}

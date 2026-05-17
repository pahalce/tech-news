import * as v from "valibot";

import type { ArticleFeatureVocabularyKeys } from "src/domains/article";
import type { ReadonlyDeep } from "src/shared/domain/readonly-deep";

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

export type PreferenceProfile = ReadonlyDeep<v.InferOutput<typeof PreferenceProfileSchema>>;

export type PreferenceSummaryHistory = ReadonlyDeep<
  v.InferOutput<typeof PreferenceSummaryHistorySchema>
>;

type WeightRange = {
  min: number;
  max: number;
};

export function parsePreferenceProfile(
  value: unknown,
  featureVocabulary: ArticleFeatureVocabularyKeys,
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

export function parsePreferenceSummaryHistory(value: unknown): PreferenceSummaryHistory {
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
  featureVocabulary: ArticleFeatureVocabularyKeys,
): void {
  assertKnownKeys(
    profile.feature_weights.topics,
    featureVocabulary.topicKeys,
    "Preference Profile feature_weights.topics",
    "Feature Vocabulary",
  );

  for (const [axis, featureKeys] of Object.entries(featureVocabulary.featureAxisKeys)) {
    const profileAxis = profile.feature_weights.feature_axes[axis];
    if (!profileAxis) {
      throw new Error(
        `Preference Profile feature_weights.feature_axes.${axis} is required by Feature Vocabulary.`,
      );
    }

    assertKnownKeys(
      profileAxis,
      featureKeys,
      `Preference Profile feature_weights.feature_axes.${axis}`,
      "Feature Vocabulary",
    );
  }

  for (const axis of Object.keys(profile.feature_weights.feature_axes)) {
    if (!Object.hasOwn(featureVocabulary.featureAxisKeys, axis)) {
      throw new Error(
        `Preference Profile feature_weights.feature_axes.${axis} is not defined in Feature Vocabulary.`,
      );
    }
  }
}

function assertKnownKeys(
  profileWeights: Record<string, number>,
  vocabularyKeys: readonly string[],
  profilePath: string,
  vocabularyLabel: string,
): void {
  const vocabularyKeySet = new Set(vocabularyKeys);

  for (const key of vocabularyKeys) {
    if (!Object.hasOwn(profileWeights, key)) {
      throw new Error(`${profilePath}.${key} is required by ${vocabularyLabel}.`);
    }
  }

  for (const key of Object.keys(profileWeights)) {
    if (!vocabularyKeySet.has(key)) {
      throw new Error(`${profilePath}.${key} is not defined in ${vocabularyLabel}.`);
    }
  }
}

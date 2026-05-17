import * as v from "valibot";

import type { ExtractedArticleFeatureAnalysis } from "src/domains/article";

const SalienceSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(0, "Feature Salience must be at least 0."),
  v.maxValue(1, "Feature Salience must be at most 1."),
);

const LlmFeatureSchema = v.strictObject({
  key: v.pipe(v.string(), v.nonEmpty("Article Feature key must not be empty.")),
  salience: SalienceSchema,
});

const LlmTopicSchema = v.union([
  v.pipe(v.string(), v.nonEmpty("Article Topic key must not be empty.")),
  LlmFeatureSchema,
]);

const LlmOtherSignalSchema = v.strictObject({
  key: v.pipe(v.string(), v.nonEmpty("Other Signal key must not be empty.")),
  salience: SalienceSchema,
});

const LlmFeatureExtractionSchema = v.strictObject({
  readability: v.strictObject({
    is_readable: v.boolean(),
    reason: v.nullable(v.string()),
  }),
  primary_topics: v.array(LlmTopicSchema),
  mentioned_topics: v.array(LlmTopicSchema),
  feature_axes: v.record(v.string(), v.array(LlmFeatureSchema)),
  other_signals: v.array(LlmOtherSignalSchema),
});

export function parseLlmFeatureExtractionOutput(value: unknown): ExtractedArticleFeatureAnalysis {
  const output = v.parse(LlmFeatureExtractionSchema, value);

  return {
    readability: {
      isReadable: output.readability.is_readable,
      reason: output.readability.reason,
    },
    primaryTopics: output.primary_topics,
    mentionedTopics: output.mentioned_topics,
    featureAxes: output.feature_axes,
    otherSignals: output.other_signals,
  };
}

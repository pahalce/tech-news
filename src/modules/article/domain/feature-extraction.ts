import * as v from "valibot";

const SalienceSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(0, "Feature Salience must be at least 0."),
  v.maxValue(1, "Feature Salience must be at most 1."),
);

const LlmFeatureSchema = v.object({
  key: v.pipe(v.string(), v.nonEmpty("Article Feature key must not be empty.")),
  salience: SalienceSchema,
});

const LlmTopicSchema = v.union([
  v.pipe(v.string(), v.nonEmpty("Article Topic key must not be empty.")),
  LlmFeatureSchema,
]);

const LlmOtherSignalSchema = v.object({
  key: v.pipe(v.string(), v.nonEmpty("Other Signal key must not be empty.")),
  salience: SalienceSchema,
});

const ArticleIdSchema = v.pipe(
  v.string(),
  v.regex(/^zenn:[\da-f]{64}$/u, "Article ID must be source plus Canonical URL hash."),
);

const DateStringSchema = v.pipe(
  v.string(),
  v.nonEmpty("date string must not be empty."),
  v.check((value) => !Number.isNaN(Date.parse(value)), "value must be a date string."),
);

const ReadabilitySchema = v.strictObject({
  isReadable: v.boolean(),
  reason: v.nullable(v.string()),
});

const FeatureSignalSchema = v.strictObject({
  key: v.pipe(v.string(), v.nonEmpty("Article Feature key must not be empty.")),
  salience: SalienceSchema,
});

const OtherSignalSchema = v.strictObject({
  key: v.pipe(v.string(), v.nonEmpty("Other Signal key must not be empty.")),
  salience: SalienceSchema,
});

const ArticleFeaturesSchema = v.strictObject({
  primaryTopics: v.array(FeatureSignalSchema),
  mentionedTopics: v.array(FeatureSignalSchema),
  unknownTopics: v.array(v.string()),
  featureAxes: v.record(v.string(), v.array(FeatureSignalSchema)),
  otherSignals: v.array(OtherSignalSchema),
});

const FeatureExtractionSchema = v.pipe(
  v.strictObject({
    articleId: ArticleIdSchema,
    extractedAt: DateStringSchema,
    readability: ReadabilitySchema,
    articleFeatures: v.nullable(ArticleFeaturesSchema),
  }),
  v.check(
    (extraction) => extraction.readability.isReadable === (extraction.articleFeatures !== null),
    "Readable Feature Extraction must include Article Features; unreadable Feature Extraction must not.",
  ),
);

const BodyFetchFailureSchema = v.strictObject({
  articleId: ArticleIdSchema,
  failedAt: DateStringSchema,
  message: v.pipe(v.string(), v.nonEmpty("fetch failure message must not be empty.")),
});

const FailedExtractionAttemptSchema = v.strictObject({
  articleId: ArticleIdSchema,
  attemptedAt: DateStringSchema,
  message: v.pipe(v.string(), v.nonEmpty("failed extraction message must not be empty.")),
});

const FeatureExtractionStateSchema = v.strictObject({
  version: v.literal(1),
  extractions: v.array(FeatureExtractionSchema),
  bodyFetchFailures: v.array(BodyFetchFailureSchema),
  failedExtractionAttempts: v.array(FailedExtractionAttemptSchema),
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

const LlmFeatureExtractionEnvelopeSchema = v.strictObject({
  readability: v.strictObject({
    is_readable: v.boolean(),
    reason: v.nullable(v.string()),
  }),
  primary_topics: v.array(v.unknown()),
  mentioned_topics: v.array(v.unknown()),
  feature_axes: v.record(v.string(), v.array(v.unknown())),
  other_signals: v.array(v.unknown()),
});

export type FeatureExtractionState = {
  version: 1;
  extractions: FeatureExtraction[];
  bodyFetchFailures: BodyFetchFailure[];
  failedExtractionAttempts: FailedExtractionAttempt[];
};

export type FeatureExtraction = {
  articleId: string;
  extractedAt: string;
  readability: {
    isReadable: boolean;
    reason: string | null;
  };
  articleFeatures: ArticleFeatures | null;
};

export type ArticleFeatures = {
  primaryTopics: FeatureSignal[];
  mentionedTopics: FeatureSignal[];
  unknownTopics: string[];
  featureAxes: Record<string, FeatureSignal[]>;
  otherSignals: OtherSignal[];
};

export type FeatureSignal = {
  key: string;
  salience: number;
};

export type OtherSignal = {
  key: string;
  salience: number;
};

export type BodyFetchFailure = {
  articleId: string;
  failedAt: string;
  message: string;
};

export type FailedExtractionAttempt = {
  articleId: string;
  attemptedAt: string;
  message: string;
};

type FeatureExtractionVocabulary = {
  feature_axes: Record<string, { features: Record<string, unknown> }>;
  normalizeTopic(topic: string):
    | {
        kind: "known_topic";
        topicKey: string;
        displayName: string;
      }
    | {
        kind: "unknown_topic";
        normalizedTopic: string;
      };
};

export function createFeatureExtraction(
  input: {
    articleId: string;
    extractedAt: string;
    llmOutput: unknown;
  },
  featureVocabulary: FeatureExtractionVocabulary,
): FeatureExtraction {
  const envelope = v.parse(LlmFeatureExtractionEnvelopeSchema, input.llmOutput);

  if (!envelope.readability.is_readable) {
    return v.parse(FeatureExtractionSchema, {
      articleId: input.articleId,
      extractedAt: input.extractedAt,
      readability: {
        isReadable: false,
        reason: envelope.readability.reason,
      },
      articleFeatures: null,
    });
  }

  const llmOutput = v.parse(LlmFeatureExtractionSchema, input.llmOutput);
  const topics = normalizeTopics(
    llmOutput.primary_topics,
    llmOutput.mentioned_topics,
    featureVocabulary,
  );
  const featureAxes = normalizeFeatureAxes(llmOutput.feature_axes, featureVocabulary);

  return v.parse(FeatureExtractionSchema, {
    articleId: input.articleId,
    extractedAt: input.extractedAt,
    readability: {
      isReadable: llmOutput.readability.is_readable,
      reason: llmOutput.readability.reason,
    },
    articleFeatures: {
      primaryTopics: topics.primaryTopics,
      mentionedTopics: topics.mentionedTopics,
      unknownTopics: topics.unknownTopics,
      featureAxes,
      otherSignals: llmOutput.other_signals,
    },
  });
}

export function createBodyFetchFailure(input: BodyFetchFailure): BodyFetchFailure {
  return v.parse(BodyFetchFailureSchema, input);
}

export function createFailedExtractionAttempt(
  input: FailedExtractionAttempt,
): FailedExtractionAttempt {
  return v.parse(FailedExtractionAttemptSchema, input);
}

export function parseFeatureExtractionState(input: unknown): FeatureExtractionState {
  const state = v.parse(FeatureExtractionStateSchema, input);

  return {
    version: state.version,
    extractions: [...state.extractions],
    bodyFetchFailures: [...state.bodyFetchFailures],
    failedExtractionAttempts: [...state.failedExtractionAttempts],
  };
}

function normalizeTopics(
  primaryTopicsInput: Array<string | FeatureSignal>,
  mentionedTopicsInput: Array<string | FeatureSignal>,
  featureVocabulary: FeatureExtractionVocabulary,
) {
  const primaryTopics: FeatureSignal[] = [];
  const mentionedTopics: FeatureSignal[] = [];
  const unknownTopics: string[] = [];

  for (const topic of primaryTopicsInput) {
    const topicSignal = normalizeTopicInput(topic);
    const normalized = featureVocabulary.normalizeTopic(topicSignal.key);
    if (normalized.kind === "known_topic") {
      primaryTopics.push({ key: normalized.topicKey, salience: topicSignal.salience });
    } else {
      unknownTopics.push(normalized.normalizedTopic);
    }
  }

  for (const topic of mentionedTopicsInput) {
    const topicSignal = normalizeTopicInput(topic);
    const normalized = featureVocabulary.normalizeTopic(topicSignal.key);
    if (normalized.kind === "known_topic") {
      mentionedTopics.push({ key: normalized.topicKey, salience: topicSignal.salience });
    } else {
      unknownTopics.push(normalized.normalizedTopic);
    }
  }

  return {
    primaryTopics: mergeFeatureSignalsByMaxSalience(primaryTopics),
    mentionedTopics: removePrimaryTopics(
      mergeFeatureSignalsByMaxSalience(mentionedTopics),
      primaryTopics,
    ),
    unknownTopics: unique(unknownTopics),
  };
}

function normalizeTopicInput(topic: string | FeatureSignal): FeatureSignal {
  if (typeof topic === "string") {
    return { key: topic, salience: 1 };
  }

  return topic;
}

function normalizeFeatureAxes(
  featureAxesInput: Record<string, FeatureSignal[]>,
  featureVocabulary: FeatureExtractionVocabulary,
) {
  const featureAxes: Record<string, FeatureSignal[]> = {};

  for (const [axis, features] of Object.entries(featureAxesInput)) {
    const vocabularyAxis = featureVocabulary.feature_axes[axis];
    if (!vocabularyAxis) {
      throw new Error(`${axis} is not defined in Feature Vocabulary.`);
    }

    featureAxes[axis] = features.map((feature) => {
      if (!Object.hasOwn(vocabularyAxis.features, feature.key)) {
        throw new Error(`${axis}.${feature.key} is not defined in Feature Vocabulary.`);
      }

      return feature;
    });
  }

  return featureAxes;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mergeFeatureSignalsByMaxSalience(values: FeatureSignal[]): FeatureSignal[] {
  const mergedByKey = new Map<string, FeatureSignal>();

  for (const value of values) {
    const existing = mergedByKey.get(value.key);

    if (!existing || value.salience > existing.salience) {
      mergedByKey.set(value.key, value);
    }
  }

  return [...mergedByKey.values()];
}

function removePrimaryTopics(
  mentionedTopics: FeatureSignal[],
  primaryTopics: FeatureSignal[],
): FeatureSignal[] {
  const primaryTopicKeys = new Set(primaryTopics.map((topic) => topic.key));

  return mentionedTopics.filter((topic) => !primaryTopicKeys.has(topic.key));
}

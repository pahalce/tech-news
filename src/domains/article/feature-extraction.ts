import * as v from "valibot";

import { ArticleAuthorSchema, type ArticleAuthor } from "src/domains/article/article-author";
import type {
  ArticleFeatures,
  FeatureSignal,
  OtherSignal,
} from "src/domains/article/article-features";
import { ArticleIdSchema, normalizeLegacyArticleId } from "src/domains/article/article-id";

const SalienceSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(0, "Feature Salience must be at least 0."),
  v.maxValue(1, "Feature Salience must be at most 1."),
);

const FeatureExtractionSignalSchema = v.object({
  key: v.pipe(v.string(), v.nonEmpty("Article Feature key must not be empty.")),
  salience: SalienceSchema,
});

const FeatureExtractionTopicSchema = v.union([
  v.pipe(v.string(), v.nonEmpty("Article Topic key must not be empty.")),
  FeatureExtractionSignalSchema,
]);

const FeatureExtractionOtherSignalSchema = v.object({
  key: v.pipe(v.string(), v.nonEmpty("Other Signal key must not be empty.")),
  salience: SalienceSchema,
});

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
    author: v.optional(v.nullable(ArticleAuthorSchema), null),
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

const ArticleExtractionRegistrySchema = v.strictObject({
  version: v.literal(1),
  extractions: v.array(FeatureExtractionSchema),
  bodyFetchFailures: v.array(BodyFetchFailureSchema),
  failedExtractionAttempts: v.array(FailedExtractionAttemptSchema),
});

const ExtractedArticleFeatureAnalysisSchema = v.strictObject({
  readability: v.strictObject({
    isReadable: v.boolean(),
    reason: v.nullable(v.string()),
  }),
  primaryTopics: v.array(FeatureExtractionTopicSchema),
  mentionedTopics: v.array(FeatureExtractionTopicSchema),
  featureAxes: v.record(v.string(), v.array(FeatureExtractionSignalSchema)),
  otherSignals: v.array(FeatureExtractionOtherSignalSchema),
});

export type ArticleExtractionRegistry = Readonly<{
  version: 1;
  extractions: readonly FeatureExtraction[];
  bodyFetchFailures: readonly BodyFetchFailure[];
  failedExtractionAttempts: readonly FailedExtractionAttempt[];
}>;

export type FeatureExtraction = Readonly<{
  articleId: string;
  extractedAt: string;
  readability: Readonly<{
    isReadable: boolean;
    reason: string | null;
  }>;
  articleFeatures: ArticleFeatures | null;
  author: ArticleAuthor | null;
}>;

export type { ArticleFeatures, FeatureSignal, OtherSignal };

export type BodyFetchFailure = Readonly<{
  articleId: string;
  failedAt: string;
  message: string;
}>;

export type FailedExtractionAttempt = Readonly<{
  articleId: string;
  attemptedAt: string;
  message: string;
}>;

export type ExtractedArticleFeatureAnalysis = v.InferOutput<
  typeof ExtractedArticleFeatureAnalysisSchema
>;

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
    analysis: unknown;
    author?: ArticleAuthor | null;
  },
  featureVocabulary: FeatureExtractionVocabulary,
): FeatureExtraction {
  const analysis = v.parse(ExtractedArticleFeatureAnalysisSchema, input.analysis);
  const author = input.author ?? null;

  if (!analysis.readability.isReadable) {
    return v.parse(FeatureExtractionSchema, {
      articleId: input.articleId,
      extractedAt: input.extractedAt,
      readability: {
        isReadable: false,
        reason: analysis.readability.reason,
      },
      articleFeatures: null,
      author,
    });
  }

  const topics = normalizeTopics(
    analysis.primaryTopics,
    analysis.mentionedTopics,
    featureVocabulary,
  );
  const featureAxes = normalizeFeatureAxes(analysis.featureAxes, featureVocabulary);

  return v.parse(FeatureExtractionSchema, {
    articleId: input.articleId,
    extractedAt: input.extractedAt,
    readability: {
      isReadable: analysis.readability.isReadable,
      reason: analysis.readability.reason,
    },
    articleFeatures: {
      primaryTopics: topics.primaryTopics,
      mentionedTopics: topics.mentionedTopics,
      unknownTopics: topics.unknownTopics,
      featureAxes,
      otherSignals: analysis.otherSignals,
    },
    author,
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

export function parseArticleExtractionRegistry(input: unknown): ArticleExtractionRegistry {
  const state = v.parse(ArticleExtractionRegistrySchema, normalizeArticleExtractionRegistry(input));

  return {
    version: state.version,
    extractions: [...state.extractions],
    bodyFetchFailures: [...state.bodyFetchFailures],
    failedExtractionAttempts: [...state.failedExtractionAttempts],
  };
}

function normalizeArticleExtractionRegistry(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }

  const registry = input as {
    extractions?: unknown;
    bodyFetchFailures?: unknown;
    failedExtractionAttempts?: unknown;
  };

  return {
    ...registry,
    extractions: normalizeArticleIdRecords(registry.extractions),
    bodyFetchFailures: normalizeArticleIdRecords(registry.bodyFetchFailures),
    failedExtractionAttempts: normalizeArticleIdRecords(registry.failedExtractionAttempts),
  };
}

function normalizeArticleIdRecords(records: unknown): unknown {
  if (!Array.isArray(records)) {
    return records;
  }

  return records.map((record) => {
    if (!record || typeof record !== "object") {
      return record;
    }

    const articleRecord = record as { articleId?: unknown };

    return {
      ...articleRecord,
      articleId:
        typeof articleRecord.articleId === "string"
          ? normalizeLegacyArticleId(articleRecord.articleId)
          : articleRecord.articleId,
    };
  });
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
  const featureAxes: Record<string, readonly FeatureSignal[]> = {};

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

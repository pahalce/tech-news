import * as v from "valibot";

import { ArticleIdSchema } from "src/domains/article";
import type { ReadonlyDeep } from "src/shared/domain/readonly-deep";

const NonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty("value must not be empty."));

const DateStringSchema = v.pipe(
  NonEmptyStringSchema,
  v.check((value) => !Number.isNaN(Date.parse(value)), "value must be a date string."),
);

const ReactionFeedbackPlaceholderSchema = v.strictObject({
  emoji: NonEmptyStringSchema,
  userIds: v.array(NonEmptyStringSchema),
  processedAt: v.nullable(DateStringSchema),
  ignoredReason: v.nullable(NonEmptyStringSchema),
});

const DeliveryReferenceSchema = v.strictObject({
  externalSystem: NonEmptyStringSchema,
  destination: NonEmptyStringSchema,
  id: NonEmptyStringSchema,
});

const PublicationRecordSchema = v.strictObject({
  articleId: ArticleIdSchema,
  deliveryReference: DeliveryReferenceSchema,
  postedAt: DateStringSchema,
  reactionFeedback: v.array(ReactionFeedbackPlaceholderSchema),
});

const RecommendedArticleSchema = v.strictObject({
  articleId: ArticleIdSchema,
  firstRecommendedAt: DateStringSchema,
});

const PublishedDigestRegistrySchema = v.strictObject({
  version: v.literal(1),
  publicationRecords: v.array(PublicationRecordSchema),
  recommendedArticles: v.array(RecommendedArticleSchema),
});

export type ReactionFeedbackPlaceholder = ReadonlyDeep<
  v.InferOutput<typeof ReactionFeedbackPlaceholderSchema>
>;

export type DeliveryReference = ReadonlyDeep<v.InferOutput<typeof DeliveryReferenceSchema>>;

export type PublicationRecord = ReadonlyDeep<v.InferOutput<typeof PublicationRecordSchema>>;

export type RecommendedArticle = ReadonlyDeep<v.InferOutput<typeof RecommendedArticleSchema>>;

export type PublishedDigestRegistry = ReadonlyDeep<
  v.InferOutput<typeof PublishedDigestRegistrySchema>
>;

export function createPublicationRecord(input: {
  articleId: string;
  deliveryReference: DeliveryReference;
  postedAt: string;
}): PublicationRecord {
  return v.parse(PublicationRecordSchema, {
    ...input,
    reactionFeedback: [
      { emoji: "👍", userIds: [], processedAt: null, ignoredReason: null },
      { emoji: "👎", userIds: [], processedAt: null, ignoredReason: null },
    ],
  });
}

export function createRecommendedArticle(input: RecommendedArticle): RecommendedArticle {
  return v.parse(RecommendedArticleSchema, input);
}

export function parsePublishedDigestRegistry(input: unknown): PublishedDigestRegistry {
  const state = v.parse(PublishedDigestRegistrySchema, restoreLegacyPublishedDigestRegistry(input));

  return {
    version: state.version,
    publicationRecords: [...state.publicationRecords],
    recommendedArticles: [...state.recommendedArticles],
  };
}

function restoreLegacyPublishedDigestRegistry(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }

  const registry = input as {
    publicationRecords?: unknown;
  };

  if (!Array.isArray(registry.publicationRecords)) {
    return input;
  }

  return {
    ...input,
    publicationRecords: registry.publicationRecords.map((record) => {
      if (!record || typeof record !== "object" || "deliveryReference" in record) {
        return record;
      }

      const legacyRecord = record as {
        messageId?: unknown;
        channelId?: unknown;
      };

      if (
        typeof legacyRecord.messageId !== "string" ||
        typeof legacyRecord.channelId !== "string"
      ) {
        return record;
      }

      const { messageId, channelId, ...rest } = legacyRecord;

      return {
        ...rest,
        deliveryReference: {
          externalSystem: "discord",
          destination: channelId,
          id: messageId,
        },
      };
    }),
  };
}

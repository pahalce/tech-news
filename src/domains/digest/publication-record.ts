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

const PublicationRecordSchema = v.strictObject({
  articleId: ArticleIdSchema,
  messageId: NonEmptyStringSchema,
  channelId: NonEmptyStringSchema,
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

export type PublicationRecord = ReadonlyDeep<v.InferOutput<typeof PublicationRecordSchema>>;

export type RecommendedArticle = ReadonlyDeep<v.InferOutput<typeof RecommendedArticleSchema>>;

export type PublishedDigestRegistry = ReadonlyDeep<
  v.InferOutput<typeof PublishedDigestRegistrySchema>
>;

export function createPublicationRecord(input: {
  articleId: string;
  messageId: string;
  channelId: string;
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
  const state = v.parse(PublishedDigestRegistrySchema, input);

  return {
    version: state.version,
    publicationRecords: [...state.publicationRecords],
    recommendedArticles: [...state.recommendedArticles],
  };
}

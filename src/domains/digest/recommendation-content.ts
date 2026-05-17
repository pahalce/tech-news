import * as v from "valibot";

import { ArticleIdSchema } from "src/domains/article";

const NonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty("value must not be empty."));

const RecommendationContentSchema = v.strictObject({
  articleId: ArticleIdSchema,
  summary: NonEmptyStringSchema,
  whyRecommended: NonEmptyStringSchema,
  learningPoints: v.pipe(
    v.array(NonEmptyStringSchema),
    v.minLength(1, "Recommendation Content learningPoints must not be empty."),
  ),
  signalsUsed: v.pipe(
    v.array(NonEmptyStringSchema),
    v.minLength(1, "Recommendation Content signalsUsed must not be empty."),
  ),
});

const RecommendationContentHistorySchema = v.strictObject({
  version: v.literal(1),
  recommendationContents: v.array(RecommendationContentSchema),
});

export type RecommendationContent = v.InferOutput<typeof RecommendationContentSchema>;

export type RecommendationContentHistory = v.InferOutput<typeof RecommendationContentHistorySchema>;

export function parseRecommendationContent(input: unknown): RecommendationContent {
  return v.parse(RecommendationContentSchema, input);
}

export function parseRecommendationContentHistory(input: unknown): RecommendationContentHistory {
  const state = v.parse(RecommendationContentHistorySchema, input);

  return {
    version: state.version,
    recommendationContents: [...state.recommendationContents],
  };
}

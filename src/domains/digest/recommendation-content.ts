import * as v from "valibot";

import { ArticleIdSchema } from "src/domains/article/article-id";

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

const RecommendationContentStateSchema = v.strictObject({
  version: v.literal(1),
  recommendationContents: v.array(RecommendationContentSchema),
});

export type RecommendationContent = v.InferOutput<typeof RecommendationContentSchema>;

export type RecommendationContentState = v.InferOutput<typeof RecommendationContentStateSchema>;

export function parseRecommendationContent(input: unknown): RecommendationContent {
  return v.parse(RecommendationContentSchema, input);
}

export function parseRecommendationContentState(input: unknown): RecommendationContentState {
  const state = v.parse(RecommendationContentStateSchema, input);

  return {
    version: state.version,
    recommendationContents: [...state.recommendationContents],
  };
}

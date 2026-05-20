import * as v from "valibot";

import { ArticleIdSchema, normalizeLegacyArticleId } from "src/domains/article";

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
  const state = v.parse(
    RecommendationContentHistorySchema,
    normalizeRecommendationContentHistory(input),
  );

  return {
    version: state.version,
    recommendationContents: [...state.recommendationContents],
  };
}

function normalizeRecommendationContentHistory(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }

  const history = input as { recommendationContents?: unknown };

  return {
    ...history,
    recommendationContents: Array.isArray(history.recommendationContents)
      ? history.recommendationContents.map((record) => {
          if (!record || typeof record !== "object") {
            return record;
          }

          const content = record as { articleId?: unknown };

          return {
            ...content,
            articleId:
              typeof content.articleId === "string"
                ? normalizeLegacyArticleId(content.articleId)
                : content.articleId,
          };
        })
      : history.recommendationContents,
  };
}

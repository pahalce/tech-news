import * as v from "valibot";

import { ArticleIdSchema } from "src/domains/article/article-id";

const NonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty("value must not be empty."));

const DateStringSchema = v.pipe(
  NonEmptyStringSchema,
  v.check((value) => !Number.isNaN(Date.parse(value)), "value must be a date string."),
);

const VocabularyPromotionCandidateSchema = v.strictObject({
  key: NonEmptyStringSchema,
  descriptionJa: NonEmptyStringSchema,
  occurrenceCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
  representativeArticleIds: v.array(ArticleIdSchema),
  relatedFeedbackCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  recommendedAction: NonEmptyStringSchema,
});

const VocabularySuggestionRunSchema = v.strictObject({
  suggestedAt: DateStringSchema,
  candidates: v.array(VocabularyPromotionCandidateSchema),
});

const ArticleFeatureSuggestionHistorySchema = v.strictObject({
  version: v.literal(1),
  suggestionRuns: v.array(VocabularySuggestionRunSchema),
});

export type VocabularyPromotionCandidate = v.InferOutput<typeof VocabularyPromotionCandidateSchema>;

export type VocabularySuggestionRun = v.InferOutput<typeof VocabularySuggestionRunSchema>;

export type ArticleFeatureSuggestionHistory = v.InferOutput<
  typeof ArticleFeatureSuggestionHistorySchema
>;

export function parseArticleFeatureSuggestionHistory(
  input: unknown,
): ArticleFeatureSuggestionHistory {
  const state = v.parse(ArticleFeatureSuggestionHistorySchema, input);

  return {
    version: state.version,
    suggestionRuns: state.suggestionRuns.map((run) => ({
      suggestedAt: run.suggestedAt,
      candidates: [...run.candidates],
    })),
  };
}

export function createVocabularySuggestionRun(
  input: VocabularySuggestionRun,
): VocabularySuggestionRun {
  return v.parse(VocabularySuggestionRunSchema, input);
}

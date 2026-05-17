import * as v from "valibot";

export const ArticleIdSchema = v.pipe(
  v.string(),
  v.regex(/^zenn:[\da-f]{64}$/u, "Article ID must be source plus Canonical URL hash."),
);

export type ArticleId = v.InferOutput<typeof ArticleIdSchema>;

export function parseArticleId(input: unknown): ArticleId {
  return v.parse(ArticleIdSchema, input);
}

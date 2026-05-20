import * as v from "valibot";

export const ArticleIdSchema = v.pipe(
  v.string(),
  v.regex(/^[\da-f]{64}$/u, "Article ID must be a Canonical URL hash."),
);

export type ArticleId = v.InferOutput<typeof ArticleIdSchema>;

export function parseArticleId(input: unknown): ArticleId {
  return v.parse(ArticleIdSchema, input);
}

export function normalizeLegacyArticleId(input: string): string {
  const legacyMatch = /^(?:zenn|hatena_blog|other):([\da-f]{64})$/u.exec(input);

  return legacyMatch?.[1] ?? input;
}

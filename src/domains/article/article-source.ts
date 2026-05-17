import * as v from "valibot";

export const ArticleSourceSchema = v.literal("zenn");

export type ArticleSource = v.InferOutput<typeof ArticleSourceSchema>;

export function parseArticleSource(input: unknown): ArticleSource {
  return v.parse(ArticleSourceSchema, input);
}

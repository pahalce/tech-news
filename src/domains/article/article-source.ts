import * as v from "valibot";

export const ArticleSourceSchema = v.union([
  v.literal("zenn"),
  v.literal("hatena_blog"),
  v.literal("other"),
]);

export type ArticleSource = v.InferOutput<typeof ArticleSourceSchema>;

export function parseArticleSource(input: unknown): ArticleSource {
  return v.parse(ArticleSourceSchema, input);
}

import * as v from "valibot";

const NonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty("value must not be empty."));

export const ArticleAuthorSchema = v.strictObject({
  username: NonEmptyStringSchema,
  displayName: v.nullable(v.string()),
  publicationName: v.nullable(v.string()),
});

export type ArticleAuthor = v.InferOutput<typeof ArticleAuthorSchema>;

export function parseArticleAuthor(input: unknown): ArticleAuthor {
  return v.parse(ArticleAuthorSchema, input);
}

export function formatArticleAuthorLine(author: ArticleAuthor): string {
  const labels: string[] = [];
  if (author.displayName) {
    labels.push(author.displayName);
  }
  if (author.publicationName) {
    labels.push(author.publicationName);
  }

  const detail =
    labels.length > 0 ? `${labels.join(" · ")} (@${author.username})` : `@${author.username}`;

  return `_著者:_ ${detail}`;
}

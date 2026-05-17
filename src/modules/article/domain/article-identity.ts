import { createHash } from "node:crypto";

import * as v from "valibot";

import { ArticleIdSchema } from "./article-id";
import { ArticleSourceSchema, type ArticleSource } from "./article-source";
import { normalizeCanonicalUrl, UrlStringSchema } from "./canonical-url";

const ArticleIdentitySchema = v.pipe(
  v.object({
    articleId: ArticleIdSchema,
    canonicalUrl: UrlStringSchema,
    source: ArticleSourceSchema,
  }),
  v.check(
    (identity) => identity.articleId === deriveArticleId(identity.source, identity.canonicalUrl),
    "Article ID must match source and Canonical URL.",
  ),
);

export type ArticleIdentity = v.InferOutput<typeof ArticleIdentitySchema>;

export function createArticleIdentity(
  sourceInput: ArticleSource,
  urlInput: string,
): ArticleIdentity {
  const source = v.parse(ArticleSourceSchema, sourceInput);
  const canonicalUrl = normalizeCanonicalUrl(urlInput);

  return parseArticleIdentity({
    articleId: deriveArticleId(source, canonicalUrl),
    canonicalUrl,
    source,
  });
}

export function parseArticleIdentity(input: unknown): ArticleIdentity {
  return v.parse(ArticleIdentitySchema, input);
}

function deriveArticleId(source: ArticleSource, canonicalUrl: string): string {
  const canonicalUrlHash = createHash("sha256").update(canonicalUrl).digest("hex");

  return `${source}:${canonicalUrlHash}`;
}

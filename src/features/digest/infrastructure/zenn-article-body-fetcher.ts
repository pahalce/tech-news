import type { ExtractCurrentFeedCandidateFeaturesInput } from "src/features/digest/application/extract-current-feed-candidate-features-use-case";
import { fetchTextWithTimeout } from "src/features/digest/infrastructure/http-client";
import { resolveZennArticleAuthor } from "src/features/digest/infrastructure/zenn-article-author";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

export function createZennArticleBodyFetcher(input: {
  timeoutMs: number;
  logger: WorkflowLogger;
}): ExtractCurrentFeedCandidateFeaturesInput["fetchArticleBody"] {
  return async (candidate) => {
    const startedAt = performance.now();
    input.logger.info("article body fetch started", {
      articleId: candidate.articleId,
      url: candidate.canonicalUrl,
    });
    const html = await fetchArticleHtml({
      url: candidate.canonicalUrl,
      timeoutMs: input.timeoutMs,
    });
    const author = resolveZennArticleAuthor(candidate.canonicalUrl, html);
    const body = htmlToReadableText(html);
    input.logger.info("article body fetch finished", {
      articleId: candidate.articleId,
      elapsedMs: elapsedMs(startedAt),
      bodyLength: body.length,
      authorUsername: author?.username ?? null,
    });
    return { body, author };
  };
}

export async function fetchArticleHtml(input: { url: string; timeoutMs: number }): Promise<string> {
  return fetchTextWithTimeout({
    url: input.url,
    timeoutMs: input.timeoutMs,
    failurePrefix: "Failed to fetch article body",
  });
}

export function htmlToReadableText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/giu, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

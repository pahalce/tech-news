import { parseArticleAuthor, type ArticleAuthor } from "src/domains/article/article-author";

export type { ArticleAuthor };

export function extractZennArticleAuthorFromCanonicalUrl(
  canonicalUrl: string,
): Pick<ArticleAuthor, "username"> | null {
  try {
    const url = new URL(canonicalUrl);
    if (url.hostname !== "zenn.dev") {
      return null;
    }

    const pathParts = url.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 3 || pathParts[1] !== "articles") {
      return null;
    }

    const username = pathParts[0];
    if (!username) {
      return null;
    }

    return { username };
  } catch {
    return null;
  }
}

export function extractZennArticleAuthorFromHtml(
  html: string,
): Pick<ArticleAuthor, "displayName" | "publicationName"> | null {
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/u,
  );
  const nextDataJson = nextDataMatch?.[1];
  if (!nextDataJson) {
    return null;
  }

  try {
    const nextData = JSON.parse(nextDataJson) as {
      props?: {
        pageProps?: {
          error?: unknown;
          user?: { name?: unknown };
          publication?: { name?: unknown } | null;
        };
      };
    };
    const pageProps = nextData.props?.pageProps;
    if (!pageProps || pageProps.error) {
      return null;
    }

    return {
      displayName: nonEmptyString(pageProps.user?.name),
      publicationName: nonEmptyString(pageProps.publication?.name),
    };
  } catch {
    return null;
  }
}

export function resolveZennArticleAuthor(
  canonicalUrl: string,
  html: string | null,
): ArticleAuthor | null {
  const fromUrl = extractZennArticleAuthorFromCanonicalUrl(canonicalUrl);
  if (!fromUrl) {
    return null;
  }

  const fromHtml = html ? extractZennArticleAuthorFromHtml(html) : null;

  return parseArticleAuthor({
    username: fromUrl.username,
    displayName: fromHtml?.displayName ?? null,
    publicationName: fromHtml?.publicationName ?? null,
  });
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

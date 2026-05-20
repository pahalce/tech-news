import {
  createArticleFeedEntry,
  type ArticleFeed,
  type ArticleFeedEntry,
} from "src/domains/article";

type FetchText = (url: string) => Promise<string>;

export async function readHatenaBlogTopicFeed(
  feed: ArticleFeed,
  fetchText: FetchText,
): Promise<ArticleFeedEntry[]> {
  const html = await fetchText(feed.url);
  const entries: ArticleFeedEntry[] = [];
  const linkPattern =
    /<a\b(?=[^>]*class=["'][^"']*\bentry-title\b[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/giu;

  for (const match of html.matchAll(linkPattern)) {
    const url = decodeHtml(match[1] ?? "");
    const title = normalizeText(stripTags(decodeHtml(match[2] ?? "")));
    const afterLinkHtml = html.slice(match.index ?? 0, (match.index ?? 0) + 1200);
    const publishedAt = parsePublishedAt(extractDatetime(afterLinkHtml));

    entries.push(
      createArticleFeedEntry({
        title,
        url,
        publishedAt,
      }),
    );
  }

  return entries;
}

function extractDatetime(html: string): string | null {
  const match = /<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/iu.exec(html);

  return match?.[1] ?? null;
}

function parsePublishedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/gu, " ");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

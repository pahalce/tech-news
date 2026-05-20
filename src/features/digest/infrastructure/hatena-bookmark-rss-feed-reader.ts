import { XMLParser } from "fast-xml-parser";

import {
  createArticleFeedEntry,
  type ArticleFeed,
  type ArticleFeedEntry,
} from "src/domains/article";

type FetchText = (url: string) => Promise<string>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export async function readHatenaBookmarkRssFeed(
  feed: ArticleFeed,
  fetchText: FetchText,
): Promise<ArticleFeedEntry[]> {
  const rss = xmlParser.parse(await fetchText(feed.url)) as {
    rss?: { channel?: { item?: unknown } };
  };
  const items = asArray(rss.rss?.channel?.item);

  return items.map((item) =>
    createArticleFeedEntry({
      title: stringFromXmlValue(item.title),
      url: stringFromXmlValue(item.link),
      publishedAt: parsePublishedAt(item.pubDate),
    }),
  );
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePublishedAt(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function stringFromXmlValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

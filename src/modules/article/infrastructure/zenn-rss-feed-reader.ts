import { XMLParser } from "fast-xml-parser";

import {
  createArticleFeedEntry,
  type ArticleFeed,
  type ArticleFeedEntry,
} from "src/modules/article/domain/article-feed";

type FetchText = (url: string) => Promise<string>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export async function readZennRssFeed(
  feed: ArticleFeed,
  fetchText: FetchText = defaultFetchText,
): Promise<ArticleFeedEntry[]> {
  const rss = parseRss(await fetchText(feed.url));
  const channel = rss.rss?.channel;

  if (!isRecord(channel)) {
    throw new Error(`Invalid Zenn RSS feed: ${feed.id}`);
  }

  const items = asArray(channel.item);

  return items.map((item) =>
    createArticleFeedEntry({
      title: stringFromXmlValue(item.title),
      url: stringFromXmlValue(item.link),
      publishedAt: parsePublishedAt(item.pubDate),
    }),
  );
}

async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseRss(value: string): { rss?: { channel?: { item?: unknown } } } {
  return xmlParser.parse(value) as { rss?: { channel?: { item?: unknown } } };
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

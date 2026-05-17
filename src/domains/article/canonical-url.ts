import * as v from "valibot";

export const UrlStringSchema = v.pipe(
  v.string(),
  v.nonEmpty("url must not be empty."),
  v.check((url) => URL.canParse(url), "url must be a valid URL."),
);

export function normalizeCanonicalUrl(urlInput: unknown): string {
  const url = v.parse(UrlStringSchema, urlInput);
  const canonicalUrl = new URL(url);
  canonicalUrl.protocol = "https:";
  canonicalUrl.hash = "";

  for (const key of Array.from(canonicalUrl.searchParams.keys())) {
    if (isTrackingQueryParameter(key)) {
      canonicalUrl.searchParams.delete(key);
    }
  }

  canonicalUrl.searchParams.sort();

  if (canonicalUrl.pathname !== "/" && canonicalUrl.pathname.endsWith("/")) {
    canonicalUrl.pathname = canonicalUrl.pathname.slice(0, -1);
  }

  return canonicalUrl.toString();
}

function isTrackingQueryParameter(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey === "fbclid" ||
    normalizedKey === "gclid" ||
    normalizedKey === "yclid" ||
    normalizedKey.startsWith("utm_")
  );
}

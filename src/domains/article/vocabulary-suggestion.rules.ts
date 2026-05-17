const minimumOccurrenceCount = 2;
const suggestionLookbackDays = 7;
const highSalienceThreshold = 0.8;

export type ArticleFeaturePromotionKind = "other_signal" | "unknown_topic";

export function isInsideArticleFeatureSuggestionLookbackWindow(
  extractedAt: string,
  suggestedAt: string,
): boolean {
  const elapsedMs = Date.parse(suggestedAt) - Date.parse(extractedAt);
  return elapsedMs >= 0 && elapsedMs <= suggestionLookbackDays * 24 * 60 * 60 * 1000;
}

export function meetsArticleFeaturePromotionThreshold(
  occurrence: { count: number; maxSalience: number },
  kind: ArticleFeaturePromotionKind,
): boolean {
  if (kind === "unknown_topic") {
    return occurrence.count >= minimumOccurrenceCount;
  }

  return (
    occurrence.count >= minimumOccurrenceCount || occurrence.maxSalience >= highSalienceThreshold
  );
}

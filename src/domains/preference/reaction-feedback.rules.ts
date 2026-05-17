const feedbackWindowDays = 3;

export type ReactionFeedbackKind = "positive" | "negative";

export function isInsideFeedbackCollectionWindow(postedAt: string, collectedAt: string): boolean {
  const elapsedMs = Date.parse(collectedAt) - Date.parse(postedAt);
  return elapsedMs >= 0 && elapsedMs <= feedbackWindowDays * 24 * 60 * 60 * 1000;
}

export function shouldIgnoreContradictoryReactionFeedback(input: {
  positiveCount: number;
  negativeCount: number;
}): boolean {
  return input.positiveCount > 0 && input.negativeCount > 0;
}

export function readReactionFeedbackWeight(kind: ReactionFeedbackKind): 1 | -1 {
  return kind === "positive" ? 1 : -1;
}

import {
  createVocabularySuggestionRun,
  isInsideArticleFeatureSuggestionLookbackWindow,
  meetsArticleFeaturePromotionThreshold,
  type VocabularyPromotionCandidate as DomainVocabularyPromotionCandidate,
  type ArticleFeatureSuggestionHistory,
} from "src/domains/article";
import type { ArticleFeatures } from "src/domains/article";

export type VocabularyPromotionCandidate = DomainVocabularyPromotionCandidate;

type FeatureExtraction = {
  articleId: string;
  extractedAt: string;
  articleFeatures: ArticleFeatures | null;
};

type FeatureVocabularyConfig = {
  topics: Record<string, unknown>;
  feature_axes: Record<string, { features: Record<string, unknown> }>;
};

type PublicationRecord = {
  articleId: string;
  reactionFeedback: readonly {
    userIds: readonly string[];
    processedAt: string | null;
    ignoredReason: string | null;
  }[];
};

export type VocabularyCandidateDescriber = {
  describe(input: {
    key: string;
    kind: "other_signal" | "unknown_topic";
    occurrenceCount: number;
  }): Promise<string>;
};

export type VocabularySuggestionNotifier = {
  notify(input: {
    candidates: readonly VocabularyPromotionCandidate[];
    suggestedAt: string;
  }): Promise<void>;
};

export type SuggestFeatureVocabularyCandidatesInput = {
  featureExtractions: readonly FeatureExtraction[];
  featureVocabulary: FeatureVocabularyConfig;
  publicationRecords?: readonly PublicationRecord[];
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistory;
  suggestedAt: string;
  describer: VocabularyCandidateDescriber;
  notifier: VocabularySuggestionNotifier;
};

export type SuggestFeatureVocabularyCandidatesResult = {
  candidates: VocabularyPromotionCandidate[];
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistory;
  featureVocabulary: FeatureVocabularyConfig;
};

export async function suggestFeatureVocabularyCandidates(
  input: SuggestFeatureVocabularyCandidatesInput,
): Promise<SuggestFeatureVocabularyCandidatesResult> {
  const relatedFeedbackCounts = countRelatedFeedback(input.publicationRecords ?? []);
  const candidates = await collectCandidates(input, relatedFeedbackCounts);
  const suggestionRun = createVocabularySuggestionRun({
    suggestedAt: input.suggestedAt,
    candidates,
  });
  const articleFeatureSuggestionHistory = {
    version: input.articleFeatureSuggestionHistory.version,
    suggestionRuns: [...input.articleFeatureSuggestionHistory.suggestionRuns, suggestionRun],
  };

  await input.notifier.notify({ candidates, suggestedAt: input.suggestedAt });

  return {
    candidates,
    articleFeatureSuggestionHistory,
    featureVocabulary: input.featureVocabulary,
  };
}

async function collectCandidates(
  input: SuggestFeatureVocabularyCandidatesInput,
  relatedFeedbackCounts: Map<string, number>,
): Promise<VocabularyPromotionCandidate[]> {
  const otherSignals = new Map<
    string,
    { count: number; articleIds: string[]; maxSalience: number }
  >();
  const unknownTopics = new Map<
    string,
    { count: number; articleIds: string[]; maxSalience: number }
  >();

  for (const extraction of input.featureExtractions) {
    if (!isInsideSuggestionLookbackWindow(extraction.extractedAt, input.suggestedAt)) {
      continue;
    }

    if (!extraction.articleFeatures) {
      continue;
    }

    for (const signal of extraction.articleFeatures.otherSignals) {
      if (isExistingFeature(signal.key, input.featureVocabulary)) {
        continue;
      }

      addOccurrence(otherSignals, signal.key, extraction.articleId, signal.salience);
    }

    for (const topic of extraction.articleFeatures.unknownTopics) {
      if (Object.hasOwn(input.featureVocabulary.topics, topic)) {
        continue;
      }

      addOccurrence(unknownTopics, topic, extraction.articleId, 0);
    }
  }

  const candidates: VocabularyPromotionCandidate[] = [];
  await appendCandidates(candidates, otherSignals, "other_signal", input, relatedFeedbackCounts);
  await appendCandidates(candidates, unknownTopics, "unknown_topic", input, relatedFeedbackCounts);

  return candidates.sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount || left.key.localeCompare(right.key),
  );
}

async function appendCandidates(
  candidates: VocabularyPromotionCandidate[],
  occurrences: Map<string, { count: number; articleIds: string[]; maxSalience: number }>,
  kind: "other_signal" | "unknown_topic",
  input: SuggestFeatureVocabularyCandidatesInput,
  relatedFeedbackCounts: Map<string, number>,
): Promise<void> {
  for (const [key, occurrence] of occurrences) {
    if (!meetsArticleFeaturePromotionThreshold(occurrence, kind)) {
      continue;
    }

    const descriptionJa = await input.describer.describe({
      key,
      kind,
      occurrenceCount: occurrence.count,
    });

    candidates.push({
      key,
      descriptionJa,
      occurrenceCount: occurrence.count,
      representativeArticleIds: [...new Set(occurrence.articleIds)].slice(0, 3),
      relatedFeedbackCount: sumRelatedFeedback(occurrence.articleIds, relatedFeedbackCounts),
      recommendedAction:
        kind === "unknown_topic"
          ? "Topic Normalization Dictionary への追加を検討"
          : "Feature Axis への追加を検討",
    });
  }
}

export function isInsideSuggestionLookbackWindow(
  extractedAt: string,
  suggestedAt: string,
): boolean {
  return isInsideArticleFeatureSuggestionLookbackWindow(extractedAt, suggestedAt);
}

function addOccurrence(
  occurrences: Map<string, { count: number; articleIds: string[]; maxSalience: number }>,
  key: string,
  articleId: string,
  salience: number,
): void {
  const current = occurrences.get(key) ?? { count: 0, articleIds: [], maxSalience: 0 };
  occurrences.set(key, {
    count: current.count + 1,
    articleIds: [...current.articleIds, articleId],
    maxSalience: Math.max(current.maxSalience, salience),
  });
}

function isExistingFeature(key: string, featureVocabulary: FeatureVocabularyConfig): boolean {
  return Object.values(featureVocabulary.feature_axes).some((axis) =>
    Object.hasOwn(axis.features, key),
  );
}

function countRelatedFeedback(
  publicationRecords: readonly PublicationRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const record of publicationRecords) {
    const count = record.reactionFeedback
      .filter((feedback) => feedback.processedAt !== null && feedback.ignoredReason === null)
      .reduce((sum, feedback) => sum + feedback.userIds.length, 0);
    counts.set(record.articleId, count);
  }

  return counts;
}

function sumRelatedFeedback(
  articleIds: readonly string[],
  relatedFeedbackCounts: Map<string, number>,
): number {
  return [...new Set(articleIds)].reduce(
    (sum, articleId) => sum + (relatedFeedbackCounts.get(articleId) ?? 0),
    0,
  );
}

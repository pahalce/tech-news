import type { ArticleFeatures } from "../../feature-extraction/domain/article-features";

type RerankCurrentFeedCandidate = {
  articleId: string;
  source: string;
  canonicalUrl: string;
  title: string;
  feedIds: readonly string[];
  firstSeenInCurrentFeedsAt: string | null;
  ruleScore: number;
  articleFeatures: ArticleFeatures;
};

type LlmRerankCandidate = {
  articleId: string;
  title: string;
  canonicalUrl: string;
  ruleScore: number;
  primaryTopics: string[];
};

export type LlmRerankInput = {
  topScoredCandidates: LlmRerankCandidate[];
  longTermPreferenceSummary: string | null;
  recentPreferenceSummary: string | null;
  qualityCriteria: readonly string[];
  maxRecommendations: number;
};

export type LlmRerankResult = {
  selectedArticleIds: readonly string[];
};

export type LlmReranker = {
  rerank(input: LlmRerankInput): Promise<LlmRerankResult>;
};

export type RerankCurrentFeedCandidatesInput = {
  scoredCandidates: readonly RerankCurrentFeedCandidate[];
  longTermPreferenceSummary: string | null;
  recentPreferenceSummary: string | null;
  qualityCriteria: readonly string[];
  maxRecommendations?: number;
  llmReranker: LlmReranker;
};

export type RerankCurrentFeedCandidatesResult = {
  selectedCandidates: RerankCurrentFeedCandidate[];
};

const defaultMaxRecommendations = 10;

export async function rerankCurrentFeedCandidates(
  input: RerankCurrentFeedCandidatesInput,
): Promise<RerankCurrentFeedCandidatesResult> {
  const maxRecommendations = input.maxRecommendations ?? defaultMaxRecommendations;
  const rerankResult = await input.llmReranker.rerank({
    topScoredCandidates: input.scoredCandidates.map((candidate) => ({
      articleId: candidate.articleId,
      title: candidate.title,
      canonicalUrl: candidate.canonicalUrl,
      ruleScore: candidate.ruleScore,
      primaryTopics: candidate.articleFeatures.primaryTopics.map((topic) => topic.key),
    })),
    longTermPreferenceSummary: input.longTermPreferenceSummary,
    recentPreferenceSummary: input.recentPreferenceSummary,
    qualityCriteria: [...input.qualityCriteria],
    maxRecommendations,
  });

  const candidatesByArticleId = new Map(
    input.scoredCandidates.map((candidate) => [candidate.articleId, candidate]),
  );
  const selectedCandidates: RerankCurrentFeedCandidate[] = [];
  const selectedArticleIds = new Set<string>();

  for (const articleId of rerankResult.selectedArticleIds) {
    if (selectedCandidates.length >= maxRecommendations || selectedArticleIds.has(articleId)) {
      continue;
    }

    const candidate = candidatesByArticleId.get(articleId);
    if (!candidate) {
      continue;
    }

    selectedArticleIds.add(articleId);
    selectedCandidates.push({
      ...candidate,
      feedIds: [...candidate.feedIds],
    });
  }

  return { selectedCandidates };
}

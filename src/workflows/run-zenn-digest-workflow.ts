import {
  collectCurrentFeedCandidates,
  type CollectCurrentFeedCandidatesInput,
} from "../modules/article/application/collect-current-feed-candidates-use-case";
import {
  extractCurrentFeedCandidateFeatures,
  type ExtractCurrentFeedCandidateFeaturesInput,
} from "../modules/article/application/extract-current-feed-candidate-features-use-case";
import { selectReadableCurrentFeedCandidates } from "../modules/article/application/select-readable-current-feed-candidates-use-case";
import type { FeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import type { AgentState } from "../modules/agent-state/infrastructure/file-agent-state";
import {
  publishRecommendations,
  type RecommendationPublisher,
} from "../modules/publication/application/publish-recommendations-use-case";
import {
  createRecommendationContents,
  type RecommendationContentCreator,
} from "../modules/recommendation-content/application/create-recommendation-contents-use-case";
import {
  rerankCurrentFeedCandidates,
  type LlmReranker,
} from "../modules/recommendation/application/rerank-current-feed-candidates-use-case";
import { scoreCurrentFeedCandidates } from "../modules/recommendation/application/score-current-feed-candidates-use-case";

export type RunZennDigestWorkflowInput = {
  agentState: AgentState;
  featureVocabulary: FeatureVocabularyConfig;
  feeds: CollectCurrentFeedCandidatesInput["feeds"];
  feedReader: CollectCurrentFeedCandidatesInput["feedReader"];
  now: ExtractCurrentFeedCandidateFeaturesInput["now"];
  fetchArticleBody: ExtractCurrentFeedCandidateFeaturesInput["fetchArticleBody"];
  extractArticleFeatures: ExtractCurrentFeedCandidateFeaturesInput["extractArticleFeatures"];
  llmReranker: LlmReranker;
  recommendationContentCreator: RecommendationContentCreator;
  publisher: RecommendationPublisher;
};

export type RunZennDigestWorkflowResult = {
  agentState: AgentState;
};

const qualityCriteria = [
  "実務で再利用できる具体性がある",
  "薄いニュースまとめや汎用 AI hype ではない",
  "読む前に価値判断できる根拠がある",
] as const;

export async function runZennDigestWorkflow(
  input: RunZennDigestWorkflowInput,
): Promise<RunZennDigestWorkflowResult> {
  const collected = await collectCurrentFeedCandidates({
    feeds: input.feeds,
    feedReader: input.feedReader,
  });
  const extracted = await extractCurrentFeedCandidateFeatures({
    candidates: collected.candidates,
    featureExtractionState: input.agentState.featureExtractionState,
    featureVocabulary: input.featureVocabulary,
    now: input.now,
    fetchArticleBody: input.fetchArticleBody,
    extractArticleFeatures: input.extractArticleFeatures,
  });
  const readable = selectReadableCurrentFeedCandidates({
    currentFeedCandidates: collected.candidates,
    featureExtractionState: extracted.state,
  });
  const scored = scoreCurrentFeedCandidates({
    currentFeedCandidateFeatures: readable.readableCandidates,
    preferenceProfile: input.agentState.preferenceProfile,
    recommendedArticleIds: input.agentState.publicationState.recommendedArticles.map(
      (article) => article.articleId,
    ),
  });
  const featuresByArticleId = new Map(
    readable.readableCandidates.map((candidate) => [
      candidate.candidate.articleId,
      candidate.articleFeatures,
    ]),
  );
  const reranked = await rerankCurrentFeedCandidates({
    scoredCandidates: scored.scoredCandidates.map((candidate) => ({
      ...candidate,
      articleFeatures: featuresByArticleId.get(candidate.articleId)!,
    })),
    longTermPreferenceSummary: input.agentState.preferenceSummaryHistory.long_term_summary,
    recentPreferenceSummary: input.agentState.preferenceSummaryHistory.recent_summary.summary,
    qualityCriteria,
    llmReranker: input.llmReranker,
  });
  const contents = await createRecommendationContents({
    selectedCandidates: reranked.selectedCandidates,
    featureExtractions: extracted.state.extractions,
    recommendationContentCreator: input.recommendationContentCreator,
  });
  const published = await publishRecommendations({
    recommendationContents: contents.recommendationContents,
    existingPublicationRecords: input.agentState.publicationState.publicationRecords,
    existingRecommendedArticles: input.agentState.publicationState.recommendedArticles,
    publisher: input.publisher,
  });

  return {
    agentState: {
      ...input.agentState,
      featureExtractionState: extracted.state,
      recommendationContentState: {
        version: input.agentState.recommendationContentState.version,
        recommendationContents: [
          ...input.agentState.recommendationContentState.recommendationContents,
          ...contents.recommendationContents,
        ],
      },
      publicationState: {
        version: input.agentState.publicationState.version,
        publicationRecords: published.publicationRecords,
        recommendedArticles: published.recommendedArticles,
      },
    },
  };
}

import {
  collectCurrentFeedCandidates,
  type CollectCurrentFeedCandidatesInput,
} from "../modules/article/application/collect-current-feed-candidates-use-case";
import {
  extractCurrentFeedCandidateFeatures,
  type ExtractCurrentFeedCandidateFeaturesInput,
} from "../modules/feature-extraction/application/extract-current-feed-candidate-features-use-case";
import { selectReadableCurrentFeedCandidates } from "../modules/feature-extraction/application/select-readable-current-feed-candidates-use-case";
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
import { elapsedMs, silentWorkflowLogger, type WorkflowLogger } from "./workflow-logger";

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
  logger?: WorkflowLogger;
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
  const logger = input.logger ?? silentWorkflowLogger;
  const workflowStartedAt = performance.now();
  logger.info("workflow started", { feedCount: input.feeds.length });

  const collectStartedAt = performance.now();
  logger.info("collecting feed candidates", { feedCount: input.feeds.length });
  const collected = await collectCurrentFeedCandidates({
    feeds: input.feeds,
    feedReader: input.feedReader,
  });
  logger.info("collected feed candidates", {
    elapsedMs: elapsedMs(collectStartedAt),
    candidateCount: collected.candidates.length,
    failureCount: collected.failures.length,
  });
  for (const failure of collected.failures) {
    logger.warn("feed collection failed", {
      feedId: failure.feedId,
      message: failure.message,
    });
  }

  const extractionStartedAt = performance.now();
  const previousExtractionCount = input.agentState.featureExtractionState.extractions.length;
  const previousBodyFetchFailureCount =
    input.agentState.featureExtractionState.bodyFetchFailures.length;
  const previousFailedExtractionAttemptCount =
    input.agentState.featureExtractionState.failedExtractionAttempts.length;
  logger.info("extracting candidate features", {
    candidateCount: collected.candidates.length,
    existingExtractionCount: previousExtractionCount,
  });
  const extracted = await extractCurrentFeedCandidateFeatures({
    candidates: collected.candidates,
    featureExtractionState: input.agentState.featureExtractionState,
    featureVocabulary: input.featureVocabulary,
    now: input.now,
    fetchArticleBody: input.fetchArticleBody,
    extractArticleFeatures: input.extractArticleFeatures,
    onFeatureExtractionFailure: ({ candidate, progress, message, llmResponse }) => {
      logger.warn("feature extraction failed", {
        articleId: candidate.articleId,
        featureExtractionIndex: progress.index,
        featureExtractionTotal: progress.total,
        featureExtractionProgress: `${progress.index}/${progress.total}`,
        message,
        llmResponse,
      });
    },
  });
  logger.info("extracted candidate features", {
    elapsedMs: elapsedMs(extractionStartedAt),
    newExtractionCount: extracted.state.extractions.length - previousExtractionCount,
    newBodyFetchFailureCount:
      extracted.state.bodyFetchFailures.length - previousBodyFetchFailureCount,
    newFailedExtractionAttemptCount:
      extracted.state.failedExtractionAttempts.length - previousFailedExtractionAttemptCount,
  });

  const readable = selectReadableCurrentFeedCandidates({
    currentFeedCandidates: collected.candidates,
    featureExtractionState: extracted.state,
  });
  logger.info("selected readable candidates", {
    readableCandidateCount: readable.readableCandidates.length,
  });

  const scoreStartedAt = performance.now();
  const scored = scoreCurrentFeedCandidates({
    currentFeedCandidateFeatures: readable.readableCandidates,
    preferenceProfile: input.agentState.preferenceProfile,
    recommendedArticleIds: input.agentState.publicationState.recommendedArticles.map(
      (article) => article.articleId,
    ),
  });
  logger.info("scored candidates", {
    elapsedMs: elapsedMs(scoreStartedAt),
    scoredCandidateCount: scored.scoredCandidates.length,
  });

  if (scored.scoredCandidates.length === 0) {
    logger.warn("skipping rerank because there are no scored candidates");
    logger.info("workflow finished", { elapsedMs: elapsedMs(workflowStartedAt) });
    return {
      agentState: {
        ...input.agentState,
        featureExtractionState: extracted.state,
      },
    };
  }

  const featuresByArticleId = new Map(
    readable.readableCandidates.map((candidate) => [
      candidate.candidate.articleId,
      candidate.articleFeatures,
    ]),
  );
  const rerankStartedAt = performance.now();
  logger.info("reranking scored candidates", {
    scoredCandidateCount: scored.scoredCandidates.length,
  });
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
  logger.info("reranked candidates", {
    elapsedMs: elapsedMs(rerankStartedAt),
    selectedCandidateCount: reranked.selectedCandidates.length,
  });

  const contentStartedAt = performance.now();
  logger.info("creating recommendation contents", {
    selectedCandidateCount: reranked.selectedCandidates.length,
  });
  const contents = await createRecommendationContents({
    selectedCandidates: reranked.selectedCandidates,
    featureExtractions: extracted.state.extractions,
    recommendationContentCreator: input.recommendationContentCreator,
  });
  logger.info("created recommendation contents", {
    elapsedMs: elapsedMs(contentStartedAt),
    recommendationContentCount: contents.recommendationContents.length,
  });

  const publishStartedAt = performance.now();
  logger.info("publishing recommendations", {
    recommendationContentCount: contents.recommendationContents.length,
  });
  const selectedCandidatesByArticleId = new Map(
    reranked.selectedCandidates.map((candidate) => [candidate.articleId, candidate]),
  );
  const featureExtractionsByArticleId = new Map(
    extracted.state.extractions.map((featureExtraction) => [
      featureExtraction.articleId,
      featureExtraction,
    ]),
  );
  const published = await publishRecommendations({
    recommendationContents: contents.recommendationContents.map((content) => {
      const candidate = selectedCandidatesByArticleId.get(content.articleId);
      if (!candidate) {
        throw new Error("Recommendation Content Article ID must match selected candidate.");
      }

      return {
        ...content,
        canonicalUrl: candidate.canonicalUrl,
        title: candidate.title,
        author: featureExtractionsByArticleId.get(content.articleId)?.author ?? null,
      };
    }),
    existingPublicationRecords: input.agentState.publicationState.publicationRecords,
    existingRecommendedArticles: input.agentState.publicationState.recommendedArticles,
    publisher: input.publisher,
    onPublishFailure: ({ articleId, message }) => {
      logger.error("recommendation publish failed", { articleId, message });
    },
  });
  logger.info("published recommendations", {
    elapsedMs: elapsedMs(publishStartedAt),
    publicationRecordCount: published.publicationRecords.length,
    recommendedArticleCount: published.recommendedArticles.length,
    failedArticleCount: published.failedArticleIds.length,
  });
  logger.info("workflow finished", { elapsedMs: elapsedMs(workflowStartedAt) });

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

import type { ExtractCurrentFeedCandidateFeaturesInput } from "src/modules/feature-extraction/application/extract-current-feed-candidate-features-use-case";
import type { CollectCurrentFeedCandidatesInput } from "src/modules/article/application/collect-current-feed-candidates-use-case";
import type { FeatureVocabularyConfig } from "src/modules/feature/application/feature-vocabulary-config";
import type { AgentState } from "src/modules/agent-state/infrastructure/file-agent-state";
import type { RecommendationPublisher } from "src/modules/publication/application/publish-recommendations-use-case";
import type { RecommendationContentCreator } from "src/modules/recommendation-content/application/create-recommendation-contents-use-case";
import type { LlmReranker } from "src/modules/recommendation/application/rerank-current-feed-candidates-use-case";
import {
  runZennDigestWorkflow,
  type DigestAuditPublisher,
} from "src/workflows/run-zenn-digest-workflow";
import {
  elapsedMs,
  silentWorkflowLogger,
  type WorkflowLogger,
} from "src/workflows/workflow-logger";

export type RunZennDigestJobInput = {
  loadAgentState(): Promise<AgentState>;
  saveAgentState(state: AgentState): Promise<void>;
  loadFeatureVocabulary(): Promise<FeatureVocabularyConfig>;
  feeds: CollectCurrentFeedCandidatesInput["feeds"];
  feedReader: CollectCurrentFeedCandidatesInput["feedReader"];
  now: ExtractCurrentFeedCandidateFeaturesInput["now"];
  fetchArticleBody: ExtractCurrentFeedCandidateFeaturesInput["fetchArticleBody"];
  extractArticleFeatures: ExtractCurrentFeedCandidateFeaturesInput["extractArticleFeatures"];
  llmReranker: LlmReranker;
  recommendationContentCreator: RecommendationContentCreator;
  publisher: RecommendationPublisher;
  auditPublisher?: DigestAuditPublisher;
  logger?: WorkflowLogger;
};

export async function runZennDigestJob(input: RunZennDigestJobInput): Promise<void> {
  const logger = input.logger ?? silentWorkflowLogger;
  const startedAt = performance.now();
  logger.info("job started");
  logger.info("loading Agent State and Feature Vocabulary");
  const [agentState, featureVocabulary] = await Promise.all([
    input.loadAgentState(),
    input.loadFeatureVocabulary(),
  ]);
  logger.info("loaded Agent State and Feature Vocabulary", {
    featureExtractionCount: agentState.featureExtractionState.extractions.length,
    recommendedArticleCount: agentState.publicationState.recommendedArticles.length,
  });
  const result = await runZennDigestWorkflow({
    agentState,
    featureVocabulary,
    feeds: input.feeds,
    feedReader: input.feedReader,
    now: input.now,
    fetchArticleBody: input.fetchArticleBody,
    extractArticleFeatures: input.extractArticleFeatures,
    llmReranker: input.llmReranker,
    recommendationContentCreator: input.recommendationContentCreator,
    publisher: input.publisher,
    auditPublisher: input.auditPublisher,
    logger,
  });

  logger.info("saving Agent State");
  await input.saveAgentState(result.agentState);
  logger.info("job finished", {
    elapsedMs: elapsedMs(startedAt),
    featureExtractionCount: result.agentState.featureExtractionState.extractions.length,
    recommendedArticleCount: result.agentState.publicationState.recommendedArticles.length,
  });
}

import type { ExtractCurrentFeedCandidateFeaturesInput } from "src/features/digest/application/extract-current-feed-candidate-features-use-case";
import type { CollectCurrentFeedCandidatesInput } from "src/features/digest/application/collect-current-feed-candidates-use-case";
import type { DigestStateRepositories } from "src/features/digest/application/ports/digest-state-repositories";
import type { ArticleFeatureVocabularyReader } from "src/features/digest/application/ports/article-feature-vocabulary-reader";
import type { RecommendationPublisher } from "src/features/digest/application/publish-recommendations-use-case";
import type { RecommendationContentCreator } from "src/features/digest/application/create-recommendation-contents-use-case";
import type { LlmReranker } from "src/features/digest/application/rerank-current-feed-candidates-use-case";
import {
  runZennDigestWorkflow,
  type DigestAuditPublisher,
} from "src/features/digest/application/run-zenn-digest-workflow";
import {
  elapsedMs,
  silentWorkflowLogger,
  type WorkflowLogger,
} from "src/shared/application/workflow-logger";

export type RunZennDigestUseCaseInput = {
  stateRepositories: DigestStateRepositories;
  articleFeatureVocabularyReader: ArticleFeatureVocabularyReader;
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

export async function runZennDigestUseCase(input: RunZennDigestUseCaseInput): Promise<void> {
  const logger = input.logger ?? silentWorkflowLogger;
  const startedAt = performance.now();
  logger.info("zenn digest use case started");
  logger.info("loading digest state and Feature Vocabulary");
  const [
    articleExtractionRegistry,
    preferenceProfile,
    preferenceSummaryHistory,
    publishedDigestRegistry,
    recommendationContentHistory,
    featureVocabulary,
  ] = await Promise.all([
    input.stateRepositories.articleExtractionRegistry.load(),
    input.stateRepositories.preferenceProfile.load(),
    input.stateRepositories.preferenceSummaryHistory.load(),
    input.stateRepositories.publishedDigestRegistry.load(),
    input.stateRepositories.recommendationContentHistory.load(),
    input.articleFeatureVocabularyReader.read(),
  ]);
  logger.info("loaded digest state and Feature Vocabulary", {
    featureExtractionCount: articleExtractionRegistry.extractions.length,
    recommendedArticleCount: publishedDigestRegistry.recommendedArticles.length,
  });
  const result = await runZennDigestWorkflow({
    articleExtractionRegistry,
    preferenceProfile,
    preferenceSummaryHistory,
    publishedDigestRegistry,
    recommendationContentHistory,
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

  logger.info("saving digest state");
  await Promise.all([
    input.stateRepositories.articleExtractionRegistry.save(result.articleExtractionRegistry),
    input.stateRepositories.publishedDigestRegistry.save(result.publishedDigestRegistry),
    input.stateRepositories.recommendationContentHistory.save(result.recommendationContentHistory),
  ]);
  logger.info("zenn digest use case finished", {
    elapsedMs: elapsedMs(startedAt),
    featureExtractionCount: result.articleExtractionRegistry.extractions.length,
    recommendedArticleCount: result.publishedDigestRegistry.recommendedArticles.length,
  });
}

import { runZennDigestUseCase } from "src/features/digest/application/run-zenn-digest-use-case";
import { createFileDigestStateRepositories } from "src/features/digest/infrastructure/file-digest-state-repositories";
import { createLlmFeatureExtractor } from "src/features/digest/infrastructure/llm-feature-extractor";
import { createLlmRecommendationContentCreator } from "src/features/digest/infrastructure/llm-recommendation-content-creator";
import { createLlmReranker } from "src/features/digest/infrastructure/llm-reranker";
import {
  createDiscordDigestAuditPublisher,
  createDiscordRecommendationPublisher,
  normalizeDiscordBotToken,
} from "src/features/digest/infrastructure/discord-recommendation-publisher";
import {
  createArticleFeedReader,
  maxFeedEntriesPerFeed,
} from "src/features/digest/infrastructure/zenn-feed-reader-adapter";
import { createZennArticleBodyFetcher } from "src/features/digest/infrastructure/zenn-article-body-fetcher";
import { defaultMultiSourceArticleFeeds } from "src/features/digest/infrastructure/zenn-article-feeds";
import { env } from "src/shared/infrastructure/env";
import { loadFeatureVocabularyConfig } from "src/shared/infrastructure/file-article-feature-vocabulary-config";
import { resolveLlmModel, runtimeConfig } from "src/shared/infrastructure/runtime-config";
import { createConsoleWorkflowLogger } from "src/shared/infrastructure/workflow-logger";

export async function runZennDigest(): Promise<void> {
  await runDigest();
}

export async function runDigest(): Promise<void> {
  const featureExtractionModel = resolveLlmModel(runtimeConfig.llm, "featureExtraction");
  const rerankModel = resolveLlmModel(runtimeConfig.llm, "rerank");
  const recommendationContentModel = resolveLlmModel(runtimeConfig.llm, "recommendationContent");
  const logger = createConsoleWorkflowLogger("digest");
  const httpRequestTimeoutMs = runtimeConfig.http.requestTimeoutMs;
  const discordBotToken = normalizeDiscordBotToken(env.DISCORD_BOT_TOKEN);
  const discordChannelId = env.DISCORD_CHANNEL_ID;

  logger.info("runtime config loaded", {
    llmProvider: runtimeConfig.llm.provider,
    featureExtractionModel,
    rerankModel,
    recommendationContentModel,
    httpRequestTimeoutMs,
    maxFeedEntriesPerFeed,
    llmRequestTimeoutMs: runtimeConfig.llm.requestTimeoutMs,
  });

  await runZennDigestUseCase({
    stateRepositories: createFileDigestStateRepositories(),
    articleFeatureVocabularyReader: { read: loadFeatureVocabularyConfig },
    feeds: defaultMultiSourceArticleFeeds,
    feedReader: createArticleFeedReader({ timeoutMs: httpRequestTimeoutMs, logger }),
    now: () => new Date().toISOString(),
    fetchArticleBody: createZennArticleBodyFetcher({ timeoutMs: httpRequestTimeoutMs, logger }),
    extractArticleFeatures: createLlmFeatureExtractor({
      model: featureExtractionModel,
      logger,
    }),
    llmReranker: createLlmReranker({
      model: rerankModel,
      logger,
    }),
    recommendationContentCreator: createLlmRecommendationContentCreator({
      model: recommendationContentModel,
      httpRequestTimeoutMs,
      logger,
    }),
    publisher: createDiscordRecommendationPublisher({
      botToken: discordBotToken,
      channelId: discordChannelId,
      timeoutMs: httpRequestTimeoutMs,
      logger,
    }),
    auditPublisher: createDiscordDigestAuditPublisher({
      botToken: discordBotToken,
      channelId: discordChannelId,
      timeoutMs: httpRequestTimeoutMs,
      logger,
    }),
    logger,
  });
}

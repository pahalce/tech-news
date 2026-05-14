import { defaultZennArticleFeeds } from "../modules/article/infrastructure/zenn-article-feeds";
import { readZennRssFeed } from "../modules/article/infrastructure/zenn-rss-feed-reader";
import {
  loadAgentState,
  saveAgentState,
} from "../modules/agent-state/infrastructure/file-agent-state";
import { loadFeatureVocabularyConfig } from "../modules/feature/infrastructure/file-feature-vocabulary-config";
import {
  readLlmProviderConfig,
  requestJsonFromLlm,
} from "../shared/infrastructure/llm-json-client";
import { readLlmModelConfig } from "./scheduled-jobs-config";
import { createConsoleWorkflowLogger, elapsedMs } from "./workflow-logger";
import { runZennDigestJob } from "./zenn-digest-job";

type DiscordRecommendationContent = {
  articleId: string;
  summary: string;
  whyRecommended: string;
  learningPoints: readonly string[];
  signalsUsed: readonly string[];
};

const maxFeedEntriesPerRun = 20;

export async function validateZennDigestDryRun(): Promise<void> {
  await loadAgentState();
  await loadFeatureVocabularyConfig();
}

export async function runZennDigestFromEnvironment(
  env: Record<string, string | undefined>,
): Promise<void> {
  const modelConfig = readLlmModelConfig(env);
  const llmProviderConfig = readLlmProviderConfig(env);
  const logger = createConsoleWorkflowLogger("zenn-digest");
  const httpRequestTimeoutMs = readPositiveIntegerEnv(env, "HTTP_REQUEST_TIMEOUT_MS") ?? 20_000;
  const discordBotToken = requiredEnv(env, "DISCORD_BOT_TOKEN");
  const discordChannelId = requiredEnv(env, "DISCORD_CHANNEL_ID");
  let remainingFeedEntryBudget = maxFeedEntriesPerRun;

  logger.info("runtime config loaded", {
    llmProvider: llmProviderConfig.provider,
    featureExtractionModel: modelConfig.featureExtractionModel,
    rerankModel: modelConfig.rerankModel,
    recommendationContentModel: modelConfig.recommendationContentModel,
    httpRequestTimeoutMs,
    maxFeedEntriesPerRun,
    llmRequestTimeoutMs: llmProviderConfig.timeoutMs ?? 90_000,
  });

  await runZennDigestJob({
    loadAgentState,
    saveAgentState,
    loadFeatureVocabulary: loadFeatureVocabularyConfig,
    feeds: defaultZennArticleFeeds,
    feedReader: async (feed) => {
      const startedAt = performance.now();
      logger.info("RSS feed fetch started", { feedId: feed.id, url: feed.url });
      const entries = await readZennRssFeed(feed, (url) =>
        fetchTextWithTimeout({
          url,
          timeoutMs: httpRequestTimeoutMs,
          failurePrefix: "RSS feed fetch failed",
        }),
      );
      const selectedEntries = entries.slice(0, remainingFeedEntryBudget);
      remainingFeedEntryBudget -= selectedEntries.length;
      logger.info("RSS feed fetch finished", {
        feedId: feed.id,
        elapsedMs: elapsedMs(startedAt),
        entryCount: entries.length,
        selectedEntryCount: selectedEntries.length,
        remainingFeedEntryBudget,
      });
      return selectedEntries;
    },
    now: () => new Date().toISOString(),
    fetchArticleBody: async (candidate) => {
      const startedAt = performance.now();
      logger.info("article body fetch started", {
        articleId: candidate.articleId,
        url: candidate.canonicalUrl,
      });
      const body = await fetchReadableText({
        url: candidate.canonicalUrl,
        timeoutMs: httpRequestTimeoutMs,
      });
      logger.info("article body fetch finished", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(startedAt),
        bodyLength: body.length,
      });
      return { body };
    },
    extractArticleFeatures: async ({ candidate, body, progress }) => {
      const startedAt = performance.now();
      logger.info("feature extraction LLM request started", {
        articleId: candidate.articleId,
        model: modelConfig.featureExtractionModel,
        featureExtractionIndex: progress.index,
        featureExtractionTotal: progress.total,
        featureExtractionProgress: `${progress.index}/${progress.total}`,
      });
      const result = await requestJsonFromLlm(llmProviderConfig, {
        model: modelConfig.featureExtractionModel,
        system: "You extract structured article features for a personal Zenn digest agent.",
        user: [
          "Return only JSON with keys readability, primary_topics, mentioned_topics, feature_axes, other_signals.",
          "Use readability.is_readable boolean and readability.reason nullable string.",
          "Topics and features must include salience from 0 to 1.",
          `Title: ${candidate.title}`,
          `URL: ${candidate.canonicalUrl}`,
          `Body:\n${body.slice(0, 20000)}`,
        ].join("\n\n"),
      });
      logger.info("feature extraction LLM request finished", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(startedAt),
      });
      return result;
    },
    llmReranker: {
      rerank: async (input) => {
        const startedAt = performance.now();
        logger.info("rerank LLM request started", {
          model: modelConfig.rerankModel,
          candidateCount: input.topScoredCandidates.length,
          maxRecommendations: input.maxRecommendations,
        });
        const result = await requestJsonFromLlm(llmProviderConfig, {
          model: modelConfig.rerankModel,
          system: "You select the best Zenn articles for a concise personal technical digest.",
          user: [
            "Return only JSON with key selectedArticleIds as an array of article IDs.",
            `Max recommendations: ${input.maxRecommendations}`,
            `Long-term preference summary: ${input.longTermPreferenceSummary ?? "none"}`,
            `Recent preference summary: ${input.recentPreferenceSummary ?? "none"}`,
            `Quality criteria: ${input.qualityCriteria.join(", ")}`,
            `Candidates: ${JSON.stringify(input.topScoredCandidates)}`,
          ].join("\n\n"),
        });
        logger.info("rerank LLM request finished", {
          elapsedMs: elapsedMs(startedAt),
          selectedArticleCount: Array.isArray(result.selectedArticleIds)
            ? result.selectedArticleIds.length
            : null,
        });
        return result;
      },
    },
    recommendationContentCreator: {
      create: async ({ candidate, featureExtraction }) => {
        const startedAt = performance.now();
        logger.info("recommendation content LLM request started", {
          articleId: candidate.articleId,
          model: modelConfig.recommendationContentModel,
        });
        const result = await requestJsonFromLlm(llmProviderConfig, {
          model: modelConfig.recommendationContentModel,
          system:
            "You write concise Japanese Discord recommendation content for one technical article.",
          user: [
            "Return only JSON with keys articleId, summary, whyRecommended, learningPoints, signalsUsed.",
            "learningPoints and signalsUsed must be non-empty string arrays.",
            `Article ID: ${candidate.articleId}`,
            `Title: ${candidate.title}`,
            `URL: ${candidate.canonicalUrl}`,
            `Rule score: ${candidate.ruleScore}`,
            `Feature extraction: ${JSON.stringify(featureExtraction)}`,
          ].join("\n\n"),
        });
        logger.info("recommendation content LLM request finished", {
          articleId: candidate.articleId,
          elapsedMs: elapsedMs(startedAt),
        });
        return result;
      },
    },
    publisher: {
      publish: async ({ recommendationContent }) => {
        const startedAt = performance.now();
        logger.info("Discord publish started", { articleId: recommendationContent.articleId });
        const result = await publishDiscordRecommendation({
          recommendationContent,
          botToken: discordBotToken,
          channelId: discordChannelId,
          timeoutMs: httpRequestTimeoutMs,
        });
        logger.info("Discord publish finished", {
          articleId: recommendationContent.articleId,
          elapsedMs: elapsedMs(startedAt),
          messageId: result.messageId,
          channelId: result.channelId,
        });
        return result;
      },
    },
    logger,
  });
}

function requiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

async function fetchReadableText(input: { url: string; timeoutMs: number }): Promise<string> {
  const html = await fetchTextWithTimeout({
    url: input.url,
    timeoutMs: input.timeoutMs,
    failurePrefix: "Failed to fetch article body",
  });
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/giu, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function publishDiscordRecommendation(input: {
  recommendationContent: DiscordRecommendationContent;
  botToken: string;
  channelId: string;
  timeoutMs: number;
}): Promise<{ messageId: string; channelId: string; postedAt: string }> {
  const response = await fetchWithTimeout(
    `https://discord.com/api/v10/channels/${input.channelId}/messages`,
    {
      timeoutMs: input.timeoutMs,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bot ${input.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: formatDiscordMessage(input.recommendationContent),
        }),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Discord publish failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    id?: string;
    channel_id?: string;
    timestamp?: string;
  };
  if (!payload.id || !payload.channel_id || !payload.timestamp) {
    throw new Error("Discord response did not include message identity.");
  }

  return {
    messageId: payload.id,
    channelId: payload.channel_id,
    postedAt: payload.timestamp,
  };
}

function formatDiscordMessage(content: DiscordRecommendationContent): string {
  return [
    `**${content.summary}**`,
    "",
    `Why: ${content.whyRecommended}`,
    "",
    "Learning points:",
    ...content.learningPoints.map((point) => `- ${point}`),
    "",
    `Signals: ${content.signalsUsed.join(", ")}`,
  ].join("\n");
}

async function fetchTextWithTimeout(input: {
  url: string;
  timeoutMs: number;
  failurePrefix: string;
}): Promise<string> {
  const response = await fetchWithTimeout(input.url, { timeoutMs: input.timeoutMs });
  if (!response.ok) {
    throw new Error(`${input.failurePrefix}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchWithTimeout(
  url: string,
  options: { timeoutMs: number; init?: RequestInit },
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      ...options.init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Fetch timed out after ${options.timeoutMs}ms: ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readPositiveIntegerEnv(
  env: Record<string, string | undefined>,
  key: string,
): number | undefined {
  const value = env[key];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
}

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
import { runZennDigestJob } from "./zenn-digest-job";

type DiscordRecommendationContent = {
  articleId: string;
  summary: string;
  whyRecommended: string;
  learningPoints: readonly string[];
  signalsUsed: readonly string[];
};

export async function validateZennDigestDryRun(): Promise<void> {
  await loadAgentState();
  await loadFeatureVocabularyConfig();
}

export async function runZennDigestFromEnvironment(
  env: Record<string, string | undefined>,
): Promise<void> {
  const modelConfig = readLlmModelConfig(env);
  const llmProviderConfig = readLlmProviderConfig(env);
  const discordBotToken = requiredEnv(env, "DISCORD_BOT_TOKEN");
  const discordChannelId = requiredEnv(env, "DISCORD_CHANNEL_ID");

  await runZennDigestJob({
    loadAgentState,
    saveAgentState,
    loadFeatureVocabulary: loadFeatureVocabularyConfig,
    feeds: defaultZennArticleFeeds,
    feedReader: (feed) => readZennRssFeed(feed),
    now: () => new Date().toISOString(),
    fetchArticleBody: async (candidate) => ({
      body: await fetchReadableText(candidate.canonicalUrl),
    }),
    extractArticleFeatures: async ({ candidate, body }) =>
      requestJsonFromLlm(llmProviderConfig, {
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
      }),
    llmReranker: {
      rerank: async (input) =>
        requestJsonFromLlm(llmProviderConfig, {
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
        }),
    },
    recommendationContentCreator: {
      create: async ({ candidate, featureExtraction }) =>
        requestJsonFromLlm(llmProviderConfig, {
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
        }),
    },
    publisher: {
      publish: async ({ recommendationContent }) =>
        publishDiscordRecommendation({
          recommendationContent,
          botToken: discordBotToken,
          channelId: discordChannelId,
        }),
    },
  });
}

function requiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

async function fetchReadableText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch article body: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
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
}): Promise<{ messageId: string; channelId: string; postedAt: string }> {
  const response = await fetch(`https://discord.com/api/v10/channels/${input.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${input.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: formatDiscordMessage(input.recommendationContent),
    }),
  });

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

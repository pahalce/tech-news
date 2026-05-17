import { jsonSchema, type JSONSchema7 } from "ai";
import * as v from "valibot";

import { defaultZennArticleFeeds } from "../modules/article/infrastructure/zenn-article-feeds";
import {
  formatArticleAuthorLine,
  type ArticleAuthor,
} from "../modules/article/application/article-author";
import { resolveZennArticleAuthor } from "../modules/article/infrastructure/zenn-article-author";
import { readZennRssFeed } from "../modules/article/infrastructure/zenn-rss-feed-reader";
import {
  loadAgentState,
  saveAgentState,
} from "../modules/agent-state/infrastructure/file-agent-state";
import type { FeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import { loadFeatureVocabularyConfig } from "../modules/feature/infrastructure/file-feature-vocabulary-config";
import { env } from "../shared/infrastructure/env";
import { generateLlmText } from "../shared/infrastructure/llm-text-generation";
import { resolveLlmModel, runtimeConfig } from "../shared/infrastructure/runtime-config";
import { createConsoleWorkflowLogger, elapsedMs } from "./workflow-logger";
import { runZennDigestJob } from "./zenn-digest-job";

export type DiscordRecommendationContent = {
  articleId: string;
  canonicalUrl: string;
  title: string;
  summary: string;
  whyRecommended: string;
  learningPoints: readonly string[];
  signalsUsed: readonly string[];
  author?: ArticleAuthor | null;
};

const recommendationContentBodyMaxLength = 20_000;
const discordMessageMaxLength = 2_000;

type LlmFeatureSignal = {
  key: string;
  salience: number;
};

type LlmFeatureExtractionOutput = {
  readability: {
    is_readable: boolean;
    reason: string | null;
  };
  primary_topics: LlmFeatureSignal[];
  mentioned_topics: LlmFeatureSignal[];
  feature_axes: Record<string, LlmFeatureSignal[]>;
  other_signals: LlmFeatureSignal[];
};

const LlmRerankResultSchema = v.strictObject({
  selectedArticleIds: v.array(v.string()),
});
const LlmRerankResultOutputSchema = jsonSchema<v.InferOutput<typeof LlmRerankResultSchema>>(
  {
    type: "object",
    properties: {
      selectedArticleIds: { type: "array", items: { type: "string" } },
    },
    required: ["selectedArticleIds"],
    additionalProperties: false,
  },
  {
    validate: (value) => validateValibot(LlmRerankResultSchema, value),
  },
);

const RecommendationContentSchema = v.strictObject({
  articleId: v.string(),
  summary: v.pipe(v.string(), v.nonEmpty()),
  whyRecommended: v.pipe(v.string(), v.nonEmpty()),
  learningPoints: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.minLength(1)),
  signalsUsed: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.minLength(1)),
});
const RecommendationContentOutputSchema = jsonSchema<
  v.InferOutput<typeof RecommendationContentSchema>
>(
  {
    type: "object",
    properties: {
      articleId: { type: "string" },
      summary: { type: "string", minLength: 1 },
      whyRecommended: { type: "string", minLength: 1 },
      learningPoints: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
      },
      signalsUsed: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
      },
    },
    required: ["articleId", "summary", "whyRecommended", "learningPoints", "signalsUsed"],
    additionalProperties: false,
  },
  {
    validate: (value) => validateValibot(RecommendationContentSchema, value),
  },
);

const maxFeedEntriesPerFeed = 3;

export async function validateZennDigestDryRun(): Promise<void> {
  await loadAgentState();
  await loadFeatureVocabularyConfig();
}

export async function runZennDigest(): Promise<void> {
  const featureExtractionModel = resolveLlmModel(runtimeConfig.llm, "featureExtraction");
  const rerankModel = resolveLlmModel(runtimeConfig.llm, "rerank");
  const recommendationContentModel = resolveLlmModel(runtimeConfig.llm, "recommendationContent");
  const logger = createConsoleWorkflowLogger("zenn-digest");
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
      const selectedEntries = entries.slice(0, maxFeedEntriesPerFeed);
      logger.info("RSS feed fetch finished", {
        feedId: feed.id,
        elapsedMs: elapsedMs(startedAt),
        entryCount: entries.length,
        selectedEntryCount: selectedEntries.length,
        maxFeedEntriesPerFeed,
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
      const html = await fetchArticleHtml({
        url: candidate.canonicalUrl,
        timeoutMs: httpRequestTimeoutMs,
      });
      const author = resolveZennArticleAuthor(candidate.canonicalUrl, html);
      const body = htmlToReadableText(html);
      logger.info("article body fetch finished", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(startedAt),
        bodyLength: body.length,
        authorUsername: author?.username ?? null,
      });
      return { body, author };
    },
    extractArticleFeatures: async ({ candidate, body, progress, featureVocabulary }) => {
      const startedAt = performance.now();
      const featureVocabularyPrompt = formatFeatureVocabularyPrompt(featureVocabulary);
      logger.info("feature extraction LLM request started", {
        articleId: candidate.articleId,
        model: featureExtractionModel,
        featureExtractionIndex: progress.index,
        featureExtractionTotal: progress.total,
        featureExtractionProgress: `${progress.index}/${progress.total}`,
      });
      let result: any;
      try {
        result = await generateLlmText({
          model: featureExtractionModel,
          system: "You extract structured article features for a personal Zenn digest agent.",
          schema: createFeatureExtractionOutputSchema(featureVocabulary),
          prompt: [
            "Extract article features using the provided structured output schema.",
            "Every signal must use key and salience.",
            "feature_axes must be an object keyed by allowed axis keys, not an array.",
            "other_signals must be an array of { key, salience } objects. Use snake_case keys.",
            "If the article is not readable, set readability.is_readable false, readability.reason to a short string, and return empty arrays/objects for the other keys.",
            "Use only the allowed topic keys and feature keys below. Put unmatched topics into primary_topics or mentioned_topics using the closest allowed topic key only when it genuinely fits; otherwise omit them.",
            featureVocabularyPrompt,
            `Title: ${candidate.title}`,
            `URL: ${candidate.canonicalUrl}`,
            `Body:\n${body.slice(0, 20000)}`,
          ].join("\n\n"),
        });
      } catch (error) {
        logger.error("feature extraction LLM request failed", {
          articleId: candidate.articleId,
          elapsedMs: elapsedMs(startedAt),
          llmError: errorDetails(error),
        });
        throw error;
      }
      logger.info("feature extraction LLM request finished", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(startedAt),
        llmResponse: result,
      });
      return result;
    },
    llmReranker: {
      rerank: async (input) => {
        const startedAt = performance.now();
        logger.info("rerank LLM request started", {
          model: rerankModel,
          candidateCount: input.topScoredCandidates.length,
          maxRecommendations: input.maxRecommendations,
        });
        let result: any;
        try {
          result = await generateLlmText({
            model: rerankModel,
            system: "You select the best Zenn articles for a concise personal technical digest.",
            schema: LlmRerankResultOutputSchema,
            prompt: [
              "Select article IDs using the provided structured output schema.",
              `Max recommendations: ${input.maxRecommendations}`,
              `Long-term preference summary: ${input.longTermPreferenceSummary ?? "none"}`,
              `Recent preference summary: ${input.recentPreferenceSummary ?? "none"}`,
              `Quality criteria: ${input.qualityCriteria.join(", ")}`,
              `Candidates: ${JSON.stringify(input.topScoredCandidates)}`,
            ].join("\n\n"),
          });
        } catch (error) {
          logger.error("rerank LLM request failed", {
            elapsedMs: elapsedMs(startedAt),
            candidateCount: input.topScoredCandidates.length,
            llmError: errorDetails(error),
          });
          throw error;
        }
        logger.info("rerank LLM request finished", {
          elapsedMs: elapsedMs(startedAt),
          selectedArticleCount: selectedArticleCount(result),
          llmResponse: result,
        });
        return result;
      },
    },
    recommendationContentCreator: {
      create: async ({ candidate, featureExtraction }) => {
        const startedAt = performance.now();
        logger.info("recommendation content body fetch started", {
          articleId: candidate.articleId,
          url: candidate.canonicalUrl,
        });
        const bodyFetchStartedAt = performance.now();
        const articleHtml = await fetchArticleHtml({
          url: candidate.canonicalUrl,
          timeoutMs: httpRequestTimeoutMs,
        });
        const articleBody = htmlToReadableText(articleHtml);
        logger.info("recommendation content body fetch finished", {
          articleId: candidate.articleId,
          elapsedMs: elapsedMs(bodyFetchStartedAt),
          bodyLength: articleBody.length,
          authorUsername: featureExtraction?.author?.username ?? null,
        });
        logger.info("recommendation content LLM request started", {
          articleId: candidate.articleId,
          model: recommendationContentModel,
        });
        let result: any;
        try {
          result = await generateLlmText({
            model: recommendationContentModel,
            system:
              "You write concise Japanese Discord recommendation content for one technical article. learningPoints must be concrete takeaways from the article body that remain useful without opening the article.",
            schema: RecommendationContentOutputSchema,
            prompt: [
              "Write recommendation content using the provided structured output schema.",
              "summary: 2-3 sentences summarizing the article.",
              "whyRecommended: why this article fits the owner's preferences and quality bar.",
              'learningPoints: 3-5 items. Each item must be a concrete fact, comparison, setting, step, or insight taken from the article body. Write standalone Japanese sentences. Do not write chapter titles, topic labels, or phrases like "〜について学べる" or "〜の違い" without stating the actual difference.',
              "signalsUsed: non-empty string array of signal keys used from feature extraction.",
              `Article ID: ${candidate.articleId}`,
              `Title: ${candidate.title}`,
              `URL: ${candidate.canonicalUrl}`,
              `Rule score: ${candidate.ruleScore}`,
              `Feature extraction: ${JSON.stringify(featureExtraction)}`,
              `Body:\n${articleBody.slice(0, recommendationContentBodyMaxLength)}`,
            ].join("\n\n"),
          });
        } catch (error) {
          logger.error("recommendation content LLM request failed", {
            articleId: candidate.articleId,
            elapsedMs: elapsedMs(startedAt),
            llmError: errorDetails(error),
          });
          throw error;
        }
        logger.info("recommendation content LLM request finished", {
          articleId: candidate.articleId,
          elapsedMs: elapsedMs(startedAt),
          llmResponse: result,
        });
        return result;
      },
    },
    publisher: {
      publish: async ({ recommendationContent }) => {
        const startedAt = performance.now();
        logger.info("Discord publish started", { articleId: recommendationContent.articleId });
        const result = await publishDiscordRecommendation({
          recommendationContent: {
            ...recommendationContent,
            author: recommendationContent.author ?? null,
          },
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
    auditPublisher: {
      publishDigestAudit: async ({ message }) => {
        const startedAt = performance.now();
        logger.info("Discord digest audit publish started", { messageLength: message.length });
        const result = await publishDiscordPlainMessage({
          message,
          botToken: discordBotToken,
          channelId: discordChannelId,
          timeoutMs: httpRequestTimeoutMs,
        });
        logger.info("Discord digest audit publish finished", {
          elapsedMs: elapsedMs(startedAt),
          messageId: result.messageId,
          channelId: result.channelId,
        });
      },
    },
    logger,
  });
}

function normalizeDiscordBotToken(value: string): string {
  return value.replace(/^Bot\s+/iu, "").trim();
}

async function fetchArticleHtml(input: { url: string; timeoutMs: number }): Promise<string> {
  return fetchTextWithTimeout({
    url: input.url,
    timeoutMs: input.timeoutMs,
    failurePrefix: "Failed to fetch article body",
  });
}

function htmlToReadableText(html: string): string {
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
    throw new Error(await formatDiscordApiError(response, "Discord publish failed"));
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

async function publishDiscordPlainMessage(input: {
  message: string;
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
          content: truncateDiscordMessage(input.message),
        }),
      },
    },
  );

  if (!response.ok) {
    throw new Error(await formatDiscordApiError(response, "Discord audit publish failed"));
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

function truncateDiscordMessage(message: string): string {
  if (message.length <= discordMessageMaxLength) {
    return message;
  }

  return `${message.slice(0, discordMessageMaxLength - 30)}\n\n...(監査ログを省略しました)`;
}

export function formatDiscordMessage(content: DiscordRecommendationContent): string {
  const footerLines: string[] = [];
  if (content.author) {
    footerLines.push(formatArticleAuthorLine(content.author));
  }
  footerLines.push(content.canonicalUrl);

  return [
    `**[${content.title}](${content.canonicalUrl})**`,
    "",
    "**要約**",
    content.summary,
    "",
    "**推薦理由**",
    content.whyRecommended,
    "",
    "**この記事から得られる学び**",
    ...content.learningPoints.map((point) => `• ${point}`),
    "",
    `_Signals:_ ${content.signalsUsed.join(", ")}`,
    "",
    "**フィードバック**",
    "• 👍 気に入った記事なら押してください。今後、類似する記事を推薦しやすくなります。",
    "• 👎 合わなかった記事なら押してください。今後、似た記事を控えます。",
    "",
    ...footerLines,
  ].join("\n");
}

async function formatDiscordApiError(response: Response, prefix: string): Promise<string> {
  const body = await response.text();
  const details = formatDiscordErrorBody(body);
  const tokenHint =
    response.status === 401
      ? " Check that DISCORD_BOT_TOKEN is a current bot token, not the client secret or application public key."
      : "";

  return `${prefix}: ${response.status} ${response.statusText}${details}${tokenHint}`;
}

function formatDiscordErrorBody(body: string): string {
  if (!body) {
    return "";
  }

  try {
    const parsed = JSON.parse(body) as {
      code?: unknown;
      message?: unknown;
      errors?: unknown;
    };
    const parts = [
      typeof parsed.code === "number" || typeof parsed.code === "string"
        ? `Discord code: ${parsed.code}`
        : null,
      typeof parsed.message === "string" ? `Discord message: ${parsed.message}` : null,
      parsed.errors ? `Discord errors: ${JSON.stringify(parsed.errors)}` : null,
    ].filter((part): part is string => part !== null);

    return parts.length > 0 ? `. ${parts.join(". ")}` : `. Discord response: ${body}`;
  } catch {
    return `. Discord response: ${body.slice(0, 500)}`;
  }
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

function selectedArticleCount(result: unknown): number | null {
  if (
    result &&
    typeof result === "object" &&
    "selectedArticleIds" in result &&
    Array.isArray(result.selectedArticleIds)
  ) {
    return result.selectedArticleIds.length;
  }

  return null;
}

function createFeatureExtractionOutputSchema(featureVocabulary: FeatureVocabularyConfig) {
  const topicKeys = Object.keys(featureVocabulary.topics);
  const featureAxes = Object.entries(featureVocabulary.feature_axes);
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      readability: {
        type: "object",
        properties: {
          is_readable: { type: "boolean" },
          reason: { type: ["string", "null"] },
        },
        required: ["is_readable", "reason"],
        additionalProperties: false,
      },
      primary_topics: { type: "array", items: featureSignalJsonSchema(topicKeys) },
      mentioned_topics: { type: "array", items: featureSignalJsonSchema(topicKeys) },
      feature_axes: {
        type: "object",
        properties: Object.fromEntries(
          featureAxes.map(([axis, config]) => [
            axis,
            {
              type: "array",
              items: featureSignalJsonSchema(Object.keys(config.features)),
            },
          ]),
        ),
        additionalProperties: false,
      },
      other_signals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", pattern: "^[a-z0-9_]+$" },
            salience: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["key", "salience"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "readability",
      "primary_topics",
      "mentioned_topics",
      "feature_axes",
      "other_signals",
    ],
    additionalProperties: false,
  };

  return jsonSchema<LlmFeatureExtractionOutput>(schema, {
    validate: (value) => validateFeatureExtractionOutput(value, featureVocabulary),
  });
}

function featureSignalJsonSchema(allowedKeys: string[]): JSONSchema7 {
  return {
    type: "object",
    properties: {
      key: allowedKeys.length > 0 ? { type: "string", enum: allowedKeys } : { type: "string" },
      salience: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["key", "salience"],
    additionalProperties: false,
  };
}

function validateFeatureExtractionOutput(
  value: unknown,
  featureVocabulary: FeatureVocabularyConfig,
) {
  try {
    const output = parseFeatureExtractionOutputShape(value);
    const topicKeys = new Set(Object.keys(featureVocabulary.topics));

    for (const topic of [...output.primary_topics, ...output.mentioned_topics]) {
      assertAllowedKey(topic.key, topicKeys, "topic");
    }

    for (const [axis, features] of Object.entries(output.feature_axes)) {
      const axisConfig = featureVocabulary.feature_axes[axis];
      if (!axisConfig) {
        throw new Error(`${axis} is not an allowed feature axis.`);
      }

      const featureKeys = new Set(Object.keys(axisConfig.features));
      for (const feature of features) {
        assertAllowedKey(feature.key, featureKeys, `${axis} feature`);
      }
    }

    return { success: true as const, value: output };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function parseFeatureExtractionOutputShape(value: unknown): LlmFeatureExtractionOutput {
  if (!isRecord(value)) {
    throw new Error("Feature extraction output must be an object.");
  }

  const readability = value.readability;
  if (!isRecord(readability) || typeof readability.is_readable !== "boolean") {
    throw new Error("Feature extraction readability is invalid.");
  }

  if (readability.reason !== null && typeof readability.reason !== "string") {
    throw new Error("Feature extraction readability reason is invalid.");
  }

  return {
    readability: {
      is_readable: readability.is_readable,
      reason: readability.reason,
    },
    primary_topics: parseFeatureSignals(value.primary_topics, "primary_topics"),
    mentioned_topics: parseFeatureSignals(value.mentioned_topics, "mentioned_topics"),
    feature_axes: parseFeatureAxes(value.feature_axes),
    other_signals: parseFeatureSignals(value.other_signals, "other_signals"),
  };
}

function parseFeatureAxes(value: unknown): Record<string, LlmFeatureSignal[]> {
  if (!isRecord(value)) {
    throw new Error("feature_axes must be an object.");
  }

  return Object.fromEntries(
    Object.entries(value).map(([axis, features]) => [axis, parseFeatureSignals(features, axis)]),
  );
}

function parseFeatureSignals(value: unknown, field: string): LlmFeatureSignal[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  return value.map((signal, index) => {
    if (!isRecord(signal)) {
      throw new Error(`${field}[${index}] must be an object.`);
    }

    if (typeof signal.key !== "string" || signal.key.length === 0) {
      throw new Error(`${field}[${index}].key must be a non-empty string.`);
    }

    if (
      typeof signal.salience !== "number" ||
      !Number.isFinite(signal.salience) ||
      signal.salience < 0 ||
      signal.salience > 1
    ) {
      throw new Error(`${field}[${index}].salience must be a number between 0 and 1.`);
    }

    return { key: signal.key, salience: signal.salience };
  });
}

function assertAllowedKey(key: string, allowedKeys: Set<string>, label: string): void {
  if (!allowedKeys.has(key)) {
    throw new Error(`${key} is not an allowed ${label} key.`);
  }
}

function validateValibot<Output>(
  schema: v.GenericSchema<unknown, Output>,
  value: unknown,
): { success: true; value: Output } | { success: false; error: Error } {
  const result = v.safeParse(schema, value);
  if (result.success) {
    return { success: true, value: result.output };
  }

  return { success: false, error: new Error(v.summarize(result.issues)) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatFeatureVocabularyPrompt(featureVocabulary: FeatureVocabularyConfig): string {
  return [
    `Allowed topic keys: ${Object.keys(featureVocabulary.topics).join(", ")}`,
    "Allowed feature axes and feature keys:",
    ...Object.entries(featureVocabulary.feature_axes).map(
      ([axis, config]) => `- ${axis}: ${Object.keys(config.features).join(", ")}`,
    ),
  ].join("\n");
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  return { message: String(error) };
}

import { jsonSchema } from "ai";
import * as v from "valibot";

import {
  loadAgentState,
  saveAgentState,
} from "../modules/agent-state/infrastructure/file-agent-state";
import type { ReactionFeedbackReader } from "../modules/preference/application/collect-reaction-feedback-use-case";
import {
  readLlmProviderConfig,
  requestJsonFromLlm,
  type LlmProviderConfig,
} from "../shared/infrastructure/llm-json-client";
import { readLlmModelConfig } from "./scheduled-jobs-config";
import { runCollectFeedbackJob } from "./collect-feedback-job";

const PreferenceSummarySchema = v.strictObject({
  long_term_summary: v.nullable(v.string()),
  recent_summary: v.nullable(v.string()),
  recent_confidence: v.picklist(["insufficient_feedback", "low", "medium", "high"]),
});
const PreferenceSummaryOutputSchema = jsonSchema<v.InferOutput<typeof PreferenceSummarySchema>>(
  {
    type: "object",
    properties: {
      long_term_summary: { type: ["string", "null"] },
      recent_summary: { type: ["string", "null"] },
      recent_confidence: {
        type: "string",
        enum: ["insufficient_feedback", "low", "medium", "high"],
      },
    },
    required: ["long_term_summary", "recent_summary", "recent_confidence"],
    additionalProperties: false,
  },
  {
    validate: (value) => {
      const result = v.safeParse(PreferenceSummarySchema, value);
      return result.success
        ? { success: true, value: result.output }
        : { success: false, error: new Error(v.summarize(result.issues)) };
    },
  },
);

export async function validateCollectFeedbackDryRun(): Promise<void> {
  await loadAgentState();
}

export async function runCollectFeedbackFromEnvironment(
  env: Record<string, string | undefined>,
): Promise<void> {
  const modelConfig = readLlmModelConfig(env);
  const discordBotToken = normalizeDiscordBotToken(requiredEnv(env, "DISCORD_BOT_TOKEN"));
  const llmProviderConfig = readLlmProviderConfig(env);

  await runCollectFeedbackJob({
    loadAgentState,
    saveAgentState,
    collectedAt: () => new Date().toISOString(),
    reactionFeedbackReader: createDiscordReactionFeedbackReader(discordBotToken),
    preferenceSummaryUpdater: {
      update: async (input) =>
        updatePreferenceSummary({
          llmProviderConfig,
          model: modelConfig.preferenceSummaryModel,
          preferenceProfile: input.preferenceProfile,
          previousSummaryHistory: input.previousSummaryHistory,
          processedFeedbackCount: input.processedFeedbackCount,
          collectedAt: input.collectedAt,
        }),
    },
  });
}

function createDiscordReactionFeedbackReader(botToken: string): ReactionFeedbackReader {
  return {
    read: async (record) => ({
      positiveUserIds: await fetchDiscordReactionUserIds({
        botToken,
        channelId: record.channelId,
        messageId: record.messageId,
        emoji: "👍",
      }),
      negativeUserIds: await fetchDiscordReactionUserIds({
        botToken,
        channelId: record.channelId,
        messageId: record.messageId,
        emoji: "👎",
      }),
    }),
  };
}

async function fetchDiscordReactionUserIds(input: {
  botToken: string;
  channelId: string;
  messageId: string;
  emoji: string;
}): Promise<string[]> {
  const response = await fetch(
    `https://discord.com/api/v10/channels/${input.channelId}/messages/${input.messageId}/reactions/${encodeURIComponent(input.emoji)}?limit=100`,
    {
      headers: {
        Authorization: `Bot ${input.botToken}`,
      },
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await formatDiscordApiError(response, "Discord reaction fetch failed"));
  }

  const users = (await response.json()) as Array<{ id?: string; bot?: boolean }>;
  return users.filter((user) => user.id && user.bot !== true).map((user) => user.id as string);
}

async function updatePreferenceSummary(input: {
  llmProviderConfig: LlmProviderConfig;
  model: string;
  preferenceProfile: Parameters<
    Parameters<typeof runCollectFeedbackJob>[0]["preferenceSummaryUpdater"]["update"]
  >[0]["preferenceProfile"];
  previousSummaryHistory: Parameters<
    Parameters<typeof runCollectFeedbackJob>[0]["preferenceSummaryUpdater"]["update"]
  >[0]["previousSummaryHistory"];
  processedFeedbackCount: number;
  collectedAt: string;
}): ReturnType<Parameters<typeof runCollectFeedbackJob>[0]["preferenceSummaryUpdater"]["update"]> {
  if (input.processedFeedbackCount === 0) {
    return input.previousSummaryHistory;
  }

  const summary = await requestJsonFromLlm(input.llmProviderConfig, {
    model: input.model,
    system: "You summarize a single owner's technical article preferences in Japanese.",
    schema: PreferenceSummaryOutputSchema,
    user: [
      "Summarize preferences using the provided structured output schema.",
      `Collected at: ${input.collectedAt}`,
      `Processed feedback count: ${input.processedFeedbackCount}`,
      `Previous summary history: ${JSON.stringify(input.previousSummaryHistory)}`,
      `Preference profile: ${JSON.stringify(input.preferenceProfile)}`,
    ].join("\n\n"),
  });

  return {
    version: input.previousSummaryHistory.version,
    long_term_summary: stringOrNull(summary.long_term_summary),
    recent_summary: {
      window_days: input.previousSummaryHistory.recent_summary.window_days,
      summary: stringOrNull(summary.recent_summary),
      confidence:
        typeof summary.recent_confidence === "string"
          ? summary.recent_confidence
          : input.previousSummaryHistory.recent_summary.confidence,
    },
    history: [
      ...input.previousSummaryHistory.history,
      {
        summarized_at: input.collectedAt,
        processed_feedback_count: input.processedFeedbackCount,
        long_term_summary: stringOrNull(summary.long_term_summary),
        recent_summary: stringOrNull(summary.recent_summary),
      },
    ],
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function normalizeDiscordBotToken(value: string): string {
  return value.replace(/^Bot\s+/iu, "").trim();
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

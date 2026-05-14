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

export async function validateCollectFeedbackDryRun(): Promise<void> {
  await loadAgentState();
}

export async function runCollectFeedbackFromEnvironment(
  env: Record<string, string | undefined>,
): Promise<void> {
  const modelConfig = readLlmModelConfig(env);
  const discordBotToken = requiredEnv(env, "DISCORD_BOT_TOKEN");
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
    throw new Error(`Discord reaction fetch failed: ${response.status} ${response.statusText}`);
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
    user: [
      "Return only JSON with keys long_term_summary, recent_summary, recent_confidence.",
      "recent_confidence should be insufficient_feedback, low, medium, or high.",
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
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

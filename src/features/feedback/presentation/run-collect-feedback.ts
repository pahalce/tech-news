import { jsonSchema } from "ai";
import * as v from "valibot";

import { createFileStateRepositories } from "src/shared/infrastructure/file-agent-state";
import type { ReactionFeedbackReader } from "src/features/feedback/application/collect-reaction-feedback-use-case";
import { env } from "src/shared/infrastructure/env";
import { generateLlmText } from "src/shared/infrastructure/llm-text-generation";
import {
  resolveLlmModel,
  runtimeConfig,
  type LlmRuntimeModelId,
} from "src/shared/infrastructure/runtime-config";
import { runCollectFeedbackJob } from "src/features/feedback/application/collect-feedback-job";

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
  const stateRepositories = createFileStateRepositories();
  await Promise.all([
    stateRepositories.articleExtractionRegistry.load(),
    stateRepositories.publishedDigestRegistry.load(),
    stateRepositories.preferenceProfile.load(),
    stateRepositories.preferenceSummaryHistory.load(),
  ]);
}

export async function runCollectFeedback(): Promise<void> {
  const preferenceSummaryModel = resolveLlmModel(runtimeConfig.llm, "preferenceSummary");
  const discordBotToken = normalizeDiscordBotToken(env.DISCORD_BOT_TOKEN);

  await runCollectFeedbackJob({
    stateRepositories: createFileStateRepositories(),
    collectedAt: () => new Date().toISOString(),
    reactionFeedbackReader: createDiscordReactionFeedbackReader(discordBotToken),
    preferenceSummaryUpdater: {
      update: async (input) =>
        updatePreferenceSummary({
          model: preferenceSummaryModel,
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
    read: async (record) => {
      const positiveUserIds = await fetchDiscordReactionUserIds({
        botToken,
        channelId: record.channelId,
        messageId: record.messageId,
        emoji: "👍",
      });
      await sleep(250);
      const negativeUserIds = await fetchDiscordReactionUserIds({
        botToken,
        channelId: record.channelId,
        messageId: record.messageId,
        emoji: "👎",
      });

      return { positiveUserIds, negativeUserIds };
    },
  };
}

async function fetchDiscordReactionUserIds(input: {
  botToken: string;
  channelId: string;
  messageId: string;
  emoji: string;
}): Promise<string[]> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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

    if (response.status === 429 && attempt < maxAttempts) {
      await sleep(readDiscordRetryAfterMs(response, await response.text()));
      continue;
    }

    if (!response.ok) {
      throw new Error(await formatDiscordApiError(response, "Discord reaction fetch failed"));
    }

    const users = (await response.json()) as Array<{ id?: string; bot?: boolean }>;
    return users.filter((user) => user.id && user.bot !== true).map((user) => user.id as string);
  }

  throw new Error("Discord reaction fetch failed after retry attempts.");
}

async function updatePreferenceSummary(input: {
  model: LlmRuntimeModelId;
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

  const summary = await generateLlmText({
    model: input.model,
    system: "You summarize a single owner's technical article preferences in Japanese.",
    schema: PreferenceSummaryOutputSchema,
    prompt: [
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

function normalizeDiscordBotToken(value: string): string {
  return value.replace(/^Bot\s+/iu, "").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readDiscordRetryAfterMs(response: Response, body: string): number {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterFromHeader = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
  if (retryAfterFromHeader && Number.isFinite(retryAfterFromHeader)) {
    return Math.ceil(retryAfterFromHeader) + 250;
  }

  try {
    const parsed = JSON.parse(body) as { retry_after?: unknown };
    if (typeof parsed.retry_after === "number" && Number.isFinite(parsed.retry_after)) {
      return Math.ceil(parsed.retry_after * 1000) + 250;
    }
  } catch {
    // Fall through to a conservative short wait.
  }

  return 1500;
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

import type { ReactionFeedbackReader } from "src/features/feedback/application/collect-reaction-feedback-use-case";

export function normalizeDiscordBotToken(value: string): string {
  return value.replace(/^Bot\s+/iu, "").trim();
}

export function createDiscordReactionFeedbackReader(botToken: string): ReactionFeedbackReader {
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

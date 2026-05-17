import { formatArticleAuthorLine, type ArticleAuthor } from "src/domains/article";
import type { DigestAuditPublisher } from "src/features/digest/application/run-zenn-digest-workflow";
import type { RecommendationPublisher } from "src/features/digest/application/publish-recommendations-use-case";
import { fetchWithTimeout } from "src/features/digest/infrastructure/http-client";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

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

const discordMessageMaxLength = 2_000;

export function normalizeDiscordBotToken(value: string): string {
  return value.replace(/^Bot\s+/iu, "").trim();
}

export function createDiscordRecommendationPublisher(input: {
  botToken: string;
  channelId: string;
  timeoutMs: number;
  logger: WorkflowLogger;
}): RecommendationPublisher {
  return {
    publish: async ({ recommendationContent }) => {
      const startedAt = performance.now();
      input.logger.info("Discord publish started", { articleId: recommendationContent.articleId });
      const result = await publishDiscordRecommendation({
        recommendationContent: {
          ...recommendationContent,
          author: recommendationContent.author ?? null,
        },
        botToken: input.botToken,
        channelId: input.channelId,
        timeoutMs: input.timeoutMs,
      });
      input.logger.info("Discord publish finished", {
        articleId: recommendationContent.articleId,
        elapsedMs: elapsedMs(startedAt),
        messageId: result.deliveryReference.id,
        channelId: result.deliveryReference.destination,
      });
      return result;
    },
  };
}

export function createDiscordDigestAuditPublisher(input: {
  botToken: string;
  channelId: string;
  timeoutMs: number;
  logger: WorkflowLogger;
}): DigestAuditPublisher {
  return {
    publishDigestAudit: async ({ message }) => {
      const startedAt = performance.now();
      input.logger.info("Discord digest audit publish started", { messageLength: message.length });
      const result = await publishDiscordPlainMessage({
        message,
        botToken: input.botToken,
        channelId: input.channelId,
        timeoutMs: input.timeoutMs,
      });
      input.logger.info("Discord digest audit publish finished", {
        elapsedMs: elapsedMs(startedAt),
        messageId: result.messageId,
        channelId: result.channelId,
      });
    },
  };
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

async function publishDiscordRecommendation(input: {
  recommendationContent: DiscordRecommendationContent;
  botToken: string;
  channelId: string;
  timeoutMs: number;
}): Promise<{
  deliveryReference: {
    externalSystem: "discord";
    destination: string;
    id: string;
  };
  postedAt: string;
}> {
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
    deliveryReference: {
      externalSystem: "discord",
      destination: payload.channel_id,
      id: payload.id,
    },
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

import type { VocabularyPromotionCandidate } from "src/features/article-feature-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

/** Discord thread messages allow at most 2000 characters in `content`. */
export const DISCORD_MESSAGE_CONTENT_MAX_LENGTH = 2000;

const DISCORD_THREAD_AUTO_ARCHIVE_MINUTES = 10080;

const VOCABULARY_SUGGESTION_HEADER = "**Feature Vocabulary 昇格候補**";
const VOCABULARY_SUGGESTION_CONTINUATION_HEADER = "**Feature Vocabulary 昇格候補 (続き)**";

export function normalizeDiscordBotToken(value: string): string {
  return value.replace(/^Bot\s+/iu, "").trim();
}

export function formatDiscordVocabularySuggestionMessages(
  candidates: readonly VocabularyPromotionCandidate[],
): string[] {
  if (candidates.length === 0) {
    return ["今週の Feature Vocabulary 昇格候補はありません。"];
  }

  const messages: string[] = [];
  let candidateIndex = 0;

  while (candidateIndex < candidates.length) {
    const header =
      messages.length === 0
        ? VOCABULARY_SUGGESTION_HEADER
        : VOCABULARY_SUGGESTION_CONTINUATION_HEADER;
    const blocks: string[] = [];

    while (candidateIndex < candidates.length) {
      const block = formatVocabularyPromotionCandidateBlock(candidates[candidateIndex]!);
      const candidateBlocks = [...blocks, block];
      if (
        assembleDiscordVocabularySuggestionMessage(header, candidateBlocks).length <=
        DISCORD_MESSAGE_CONTENT_MAX_LENGTH
      ) {
        blocks.push(block);
        candidateIndex += 1;
        continue;
      }

      if (blocks.length > 0) {
        break;
      }

      blocks.push(truncateVocabularyPromotionCandidateBlock(header, block));
      candidateIndex += 1;
      break;
    }

    messages.push(assembleDiscordVocabularySuggestionMessage(header, blocks));
  }

  return messages;
}

export function formatDiscordVocabularyThreadName(suggestedAt: string): string {
  const datePart = suggestedAt.slice(0, 10);
  return `昇格候補 ${datePart}`;
}

export function formatDiscordVocabularyThreadStarterContent(
  candidates: readonly VocabularyPromotionCandidate[],
): string {
  if (candidates.length === 0) {
    return "**Feature Vocabulary 昇格候補** — 今週の候補はありません（詳細はスレッド）";
  }

  return `**Feature Vocabulary 昇格候補** — ${candidates.length} 件（詳細はスレッド）`;
}

export async function publishDiscordVocabularySuggestions(input: {
  candidates: readonly VocabularyPromotionCandidate[];
  suggestedAt: string;
  botToken: string;
  channelId: string;
  logger: WorkflowLogger;
}): Promise<void> {
  const publishStartedAt = performance.now();
  const threadMessages = formatDiscordVocabularySuggestionMessages(input.candidates);
  const threadName = formatDiscordVocabularyThreadName(input.suggestedAt);

  input.logger.info("Discord vocabulary suggestion publish started", {
    candidateCount: input.candidates.length,
    threadMessageCount: threadMessages.length,
    threadName,
    channelId: input.channelId,
  });

  let starterMessageId: string;
  const starterPublishStartedAt = performance.now();
  input.logger.info("Discord vocabulary suggestion starter publish started");
  try {
    starterMessageId = await postDiscordMessage({
      channelId: input.channelId,
      botToken: input.botToken,
      content: formatDiscordVocabularyThreadStarterContent(input.candidates),
      errorPrefix: "Discord vocabulary suggestion starter publish failed",
    });
    input.logger.info("Discord vocabulary suggestion starter publish finished", {
      elapsedMs: elapsedMs(starterPublishStartedAt),
      messageId: starterMessageId,
    });
  } catch (error) {
    input.logger.error("Discord vocabulary suggestion starter publish failed", {
      elapsedMs: elapsedMs(starterPublishStartedAt),
      message: errorMessage(error),
    });
    throw error;
  }

  let threadId: string;
  const threadCreateStartedAt = performance.now();
  input.logger.info("Discord vocabulary suggestion thread create started", { threadName });
  try {
    threadId = await createDiscordPublicThreadFromMessage({
      channelId: input.channelId,
      messageId: starterMessageId,
      botToken: input.botToken,
      name: threadName,
      errorPrefix: "Discord vocabulary suggestion thread create failed",
    });
    input.logger.info("Discord vocabulary suggestion thread create finished", {
      elapsedMs: elapsedMs(threadCreateStartedAt),
      threadId,
    });
  } catch (error) {
    input.logger.error("Discord vocabulary suggestion thread create failed", {
      elapsedMs: elapsedMs(threadCreateStartedAt),
      message: errorMessage(error),
    });
    throw error;
  }

  for (const [index, content] of threadMessages.entries()) {
    const messagePublishStartedAt = performance.now();
    input.logger.info("Discord vocabulary suggestion thread message publish started", {
      threadId,
      messageIndex: index + 1,
      messageCount: threadMessages.length,
      contentLength: content.length,
    });

    try {
      const messageId = await postDiscordMessage({
        channelId: threadId,
        botToken: input.botToken,
        content,
        errorPrefix: "Discord vocabulary suggestion publish failed",
      });
      input.logger.info("Discord vocabulary suggestion thread message publish finished", {
        threadId,
        messageIndex: index + 1,
        messageCount: threadMessages.length,
        elapsedMs: elapsedMs(messagePublishStartedAt),
        messageId,
      });
    } catch (error) {
      input.logger.error("Discord vocabulary suggestion thread message publish failed", {
        threadId,
        messageIndex: index + 1,
        messageCount: threadMessages.length,
        elapsedMs: elapsedMs(messagePublishStartedAt),
        message: errorMessage(error),
      });
      throw error;
    }
  }

  input.logger.info("Discord vocabulary suggestion publish finished", {
    elapsedMs: elapsedMs(publishStartedAt),
    candidateCount: input.candidates.length,
    threadMessageCount: threadMessages.length,
    threadId,
  });
}

function formatVocabularyPromotionCandidateBlock(candidate: VocabularyPromotionCandidate): string {
  return [
    `- ${candidate.key}: ${candidate.descriptionJa}`,
    `  occurrence: ${candidate.occurrenceCount}, feedback: ${candidate.relatedFeedbackCount}`,
    `  representative articles: ${candidate.representativeArticleIds.join(", ")}`,
    `  action: ${candidate.recommendedAction}`,
  ].join("\n");
}

function assembleDiscordVocabularySuggestionMessage(
  header: string,
  blocks: readonly string[],
): string {
  return [header, "", ...blocks].join("\n");
}

function truncateVocabularyPromotionCandidateBlock(header: string, block: string): string {
  const maxBlockLength = DISCORD_MESSAGE_CONTENT_MAX_LENGTH - header.length - 2;
  if (block.length <= maxBlockLength) {
    return block;
  }

  return `${block.slice(0, Math.max(0, maxBlockLength - 1))}…`;
}

async function postDiscordMessage(input: {
  channelId: string;
  botToken: string;
  content: string;
  errorPrefix: string;
}): Promise<string> {
  const response = await fetch(`https://discord.com/api/v10/channels/${input.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${input.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: input.content }),
  });

  if (!response.ok) {
    throw new Error(await formatDiscordApiError(response, input.errorPrefix));
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error(`${input.errorPrefix}: Discord response did not include message id.`);
  }

  return payload.id;
}

async function createDiscordPublicThreadFromMessage(input: {
  channelId: string;
  messageId: string;
  botToken: string;
  name: string;
  errorPrefix: string;
}): Promise<string> {
  const response = await fetch(
    `https://discord.com/api/v10/channels/${input.channelId}/messages/${input.messageId}/threads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${input.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        auto_archive_duration: DISCORD_THREAD_AUTO_ARCHIVE_MINUTES,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await formatDiscordApiError(response, input.errorPrefix));
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error(`${input.errorPrefix}: Discord response did not include thread id.`);
  }

  return payload.id;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

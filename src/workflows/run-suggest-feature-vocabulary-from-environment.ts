import { jsonSchema } from "ai";
import * as v from "valibot";

import {
  loadAgentState,
  saveAgentState,
} from "../modules/agent-state/infrastructure/file-agent-state";
import { loadFeatureVocabularyConfig } from "../modules/feature/infrastructure/file-feature-vocabulary-config";
import type { VocabularyPromotionCandidate } from "../modules/vocabulary-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import {
  readLlmProviderConfig,
  requestJsonFromLlm,
} from "../shared/infrastructure/llm-json-client";
import { readLlmModelConfig } from "./scheduled-jobs-config";
import { runSuggestFeatureVocabularyJob } from "./suggest-feature-vocabulary-job";

const VocabularyCandidateDescriptionSchema = v.strictObject({
  description_ja: v.pipe(v.string(), v.nonEmpty()),
});
const VocabularyCandidateDescriptionOutputSchema = jsonSchema<
  v.InferOutput<typeof VocabularyCandidateDescriptionSchema>
>(
  {
    type: "object",
    properties: {
      description_ja: { type: "string", minLength: 1 },
    },
    required: ["description_ja"],
    additionalProperties: false,
  },
  {
    validate: (value) => {
      const result = v.safeParse(VocabularyCandidateDescriptionSchema, value);
      return result.success
        ? { success: true, value: result.output }
        : { success: false, error: new Error(v.summarize(result.issues)) };
    },
  },
);

export async function validateSuggestFeatureVocabularyDryRun(): Promise<void> {
  await loadAgentState();
  await loadFeatureVocabularyConfig();
}

export async function runSuggestFeatureVocabularyFromEnvironment(
  env: Record<string, string | undefined>,
): Promise<void> {
  const modelConfig = readLlmModelConfig(env);
  const llmProviderConfig = readLlmProviderConfig(env);
  const discordBotToken = normalizeDiscordBotToken(requiredEnv(env, "DISCORD_BOT_TOKEN"));
  const discordChannelId = requiredEnv(env, "DISCORD_CHANNEL_ID");

  await runSuggestFeatureVocabularyJob({
    loadAgentState,
    saveAgentState,
    loadFeatureVocabulary: loadFeatureVocabularyConfig,
    suggestedAt: () => new Date().toISOString(),
    describer: {
      describe: async (input) => {
        const described = await requestJsonFromLlm(llmProviderConfig, {
          model: modelConfig.vocabularySuggestionModel,
          system:
            "You write concise Japanese descriptions for feature vocabulary promotion candidates.",
          schema: VocabularyCandidateDescriptionOutputSchema,
          user: [
            "Write the description using the provided structured output schema.",
            `Candidate key: ${input.key}`,
            `Kind: ${input.kind}`,
            `Occurrence count: ${input.occurrenceCount}`,
          ].join("\n\n"),
        });

        return typeof described.description_ja === "string" && described.description_ja.length > 0
          ? described.description_ja
          : `${input.key} に関する昇格候補`;
      },
    },
    notifier: {
      notify: async ({ candidates }) =>
        publishDiscordVocabularySuggestions({
          candidates,
          botToken: discordBotToken,
          channelId: discordChannelId,
        }),
    },
  });
}

async function publishDiscordVocabularySuggestions(input: {
  candidates: readonly VocabularyPromotionCandidate[];
  botToken: string;
  channelId: string;
}): Promise<void> {
  const content =
    input.candidates.length === 0
      ? "今週の Feature Vocabulary 昇格候補はありません。"
      : [
          "**Feature Vocabulary 昇格候補**",
          "",
          ...input.candidates.map((candidate) =>
            [
              `- ${candidate.key}: ${candidate.descriptionJa}`,
              `  occurrence: ${candidate.occurrenceCount}, feedback: ${candidate.relatedFeedbackCount}`,
              `  representative articles: ${candidate.representativeArticleIds.join(", ")}`,
              `  action: ${candidate.recommendedAction}`,
            ].join("\n"),
          ),
        ].join("\n");

  const response = await fetch(`https://discord.com/api/v10/channels/${input.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${input.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(
      await formatDiscordApiError(response, "Discord vocabulary suggestion publish failed"),
    );
  }
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

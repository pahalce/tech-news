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

export async function validateSuggestFeatureVocabularyDryRun(): Promise<void> {
  await loadAgentState();
  await loadFeatureVocabularyConfig();
}

export async function runSuggestFeatureVocabularyFromEnvironment(
  env: Record<string, string | undefined>,
): Promise<void> {
  const modelConfig = readLlmModelConfig(env);
  const llmProviderConfig = readLlmProviderConfig(env);
  const discordBotToken = requiredEnv(env, "DISCORD_BOT_TOKEN");
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
          user: [
            "Return only JSON with key description_ja.",
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
      `Discord vocabulary suggestion publish failed: ${response.status} ${response.statusText}`,
    );
  }
}

function requiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

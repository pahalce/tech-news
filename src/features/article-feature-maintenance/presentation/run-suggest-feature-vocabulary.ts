import { runSuggestFeatureVocabularyUseCase } from "src/features/article-feature-maintenance/application/run-suggest-feature-vocabulary-use-case";
import {
  normalizeDiscordBotToken,
  publishDiscordVocabularySuggestions,
} from "src/features/article-feature-maintenance/infrastructure/discord-vocabulary-suggestion-notifier";
import { createFileArticleFeatureMaintenanceStateRepositories } from "src/features/article-feature-maintenance/infrastructure/file-article-feature-maintenance-state-repositories";
import { createLlmVocabularyCandidateDescriber } from "src/features/article-feature-maintenance/infrastructure/llm-vocabulary-candidate-describer";
import { env } from "src/shared/infrastructure/env";
import { loadFeatureVocabularyConfig } from "src/shared/infrastructure/file-article-feature-vocabulary-config";
import { resolveLlmModel, runtimeConfig } from "src/shared/infrastructure/runtime-config";
import { createConsoleWorkflowLogger } from "src/shared/infrastructure/workflow-logger";

export async function runSuggestFeatureVocabulary(): Promise<void> {
  const logger = createConsoleWorkflowLogger("suggest-feature-vocabulary");
  const vocabularySuggestionModel = resolveLlmModel(runtimeConfig.llm, "vocabularySuggestion");
  const discordBotToken = normalizeDiscordBotToken(env.DISCORD_BOT_TOKEN);
  const discordChannelId = env.DISCORD_CHANNEL_ID;

  logger.info("runtime config loaded", {
    llmProvider: runtimeConfig.llm.provider,
    vocabularySuggestionModel,
    llmRequestTimeoutMs: runtimeConfig.llm.requestTimeoutMs,
    discordChannelId,
  });

  await runSuggestFeatureVocabularyUseCase({
    stateRepositories: createFileArticleFeatureMaintenanceStateRepositories(),
    articleFeatureVocabularyReader: { read: loadFeatureVocabularyConfig },
    suggestedAt: () => new Date().toISOString(),
    logger,
    describer: createLlmVocabularyCandidateDescriber({
      model: vocabularySuggestionModel,
      logger,
    }),
    notifier: {
      notify: async ({ candidates, suggestedAt }) =>
        publishDiscordVocabularySuggestions({
          candidates,
          suggestedAt,
          botToken: discordBotToken,
          channelId: discordChannelId,
          logger,
        }),
    },
  });
}

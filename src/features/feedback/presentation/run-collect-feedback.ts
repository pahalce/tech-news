import { runCollectFeedbackUseCase } from "src/features/feedback/application/run-collect-feedback-use-case";
import { createFileFeedbackStateRepositories } from "src/features/feedback/infrastructure/file-feedback-state-repositories";
import {
  createDiscordReactionFeedbackReader,
  normalizeDiscordBotToken,
} from "src/features/feedback/infrastructure/discord-reaction-feedback-reader";
import { createLlmPreferenceSummaryUpdater } from "src/features/feedback/infrastructure/llm-preference-summary-updater";
import { env } from "src/shared/infrastructure/env";
import { resolveLlmModel, runtimeConfig } from "src/shared/infrastructure/runtime-config";

export async function runCollectFeedback(): Promise<void> {
  const preferenceSummaryModel = resolveLlmModel(runtimeConfig.llm, "preferenceSummary");
  const discordBotToken = normalizeDiscordBotToken(env.DISCORD_BOT_TOKEN);

  await runCollectFeedbackUseCase({
    stateRepositories: createFileFeedbackStateRepositories(),
    collectedAt: () => new Date().toISOString(),
    reactionFeedbackReader: createDiscordReactionFeedbackReader(discordBotToken),
    preferenceSummaryUpdater: createLlmPreferenceSummaryUpdater({
      model: preferenceSummaryModel,
    }),
  });
}

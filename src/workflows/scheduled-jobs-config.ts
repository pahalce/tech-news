import {
  assertRequiredLlmEnvironment,
  readLlmProvider,
  type LlmProvider,
} from "../shared/infrastructure/llm-json-client";

export type ScheduledJobName = "collect-feedback" | "zenn-digest" | "suggest-feature-vocabulary";

export type ScheduledJobConfig = {
  name: ScheduledJobName;
  cron: string;
  command: string;
  requiredEnvironmentVariables: string[];
};

export const scheduledJobs: ScheduledJobConfig[] = [
  {
    name: "collect-feedback",
    // 08:00 JST daily.
    cron: "0 23 * * *",
    command: "pnpm collect-feedback",
    requiredEnvironmentVariables: ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"],
  },
  {
    name: "zenn-digest",
    // 09:00 JST daily.
    cron: "0 0 * * *",
    command: "pnpm zenn-digest",
    requiredEnvironmentVariables: ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"],
  },
  {
    name: "suggest-feature-vocabulary",
    // 08:30 JST Saturdays.
    cron: "30 23 * * 5",
    command: "pnpm suggest-feature-vocabulary",
    requiredEnvironmentVariables: ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"],
  },
];

export function readLlmModelConfig(env: Record<string, string | undefined>): {
  featureExtractionModel: string;
  recommendationContentModel: string;
  rerankModel: string;
  preferenceSummaryModel: string;
  vocabularySuggestionModel: string;
} {
  const defaultModel =
    readOptionalEnv(env, "LLM_MODEL") ?? defaultModelForProvider(readLlmProvider(env));

  return {
    featureExtractionModel: readOptionalEnv(env, "FEATURE_EXTRACTION_MODEL") ?? defaultModel,
    recommendationContentModel:
      readOptionalEnv(env, "RECOMMENDATION_CONTENT_MODEL") ?? defaultModel,
    rerankModel: readOptionalEnv(env, "RERANK_MODEL") ?? defaultModel,
    preferenceSummaryModel: readOptionalEnv(env, "PREFERENCE_SUMMARY_MODEL") ?? defaultModel,
    vocabularySuggestionModel: readOptionalEnv(env, "VOCABULARY_SUGGESTION_MODEL") ?? defaultModel,
  };
}

function readOptionalEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function defaultModelForProvider(provider: LlmProvider): string {
  if (provider === "gemini") {
    return "google/gemini-3.1-flash-lite-preview";
  }

  return "gpt-4.1-mini";
}

export function assertRequiredEnvironment(
  jobName: ScheduledJobName,
  env: Record<string, string | undefined>,
): void {
  const job = scheduledJobs.find((item) => item.name === jobName);

  if (!job) {
    throw new Error(`${jobName} is not a configured scheduled job.`);
  }

  const missing = job.requiredEnvironmentVariables.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`${jobName} is missing required environment variables: ${missing.join(", ")}`);
  }

  assertRequiredLlmEnvironment(env);
}

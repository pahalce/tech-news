import { assertRequiredLlmEnvironment } from "../shared/infrastructure/llm-json-client";

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
    cron: "0 23 * * *",
    command: "pnpm collect-feedback",
    requiredEnvironmentVariables: ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"],
  },
  {
    name: "zenn-digest",
    cron: "0 0 * * *",
    command: "pnpm zenn-digest",
    requiredEnvironmentVariables: ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"],
  },
  {
    name: "suggest-feature-vocabulary",
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
  const defaultModel = env.LLM_MODEL ?? "gemini-2.5-flash";

  return {
    featureExtractionModel: env.FEATURE_EXTRACTION_MODEL ?? defaultModel,
    recommendationContentModel: env.RECOMMENDATION_CONTENT_MODEL ?? defaultModel,
    rerankModel: env.RERANK_MODEL ?? defaultModel,
    preferenceSummaryModel: env.PREFERENCE_SUMMARY_MODEL ?? defaultModel,
    vocabularySuggestionModel: env.VOCABULARY_SUGGESTION_MODEL ?? defaultModel,
  };
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

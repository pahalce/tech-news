import { assertRequiredLlmEnvironment } from "../shared/infrastructure/llm-text-generation";

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

export function assertRequiredEnvironment(
  jobName: ScheduledJobName,
  env: NodeJS.ProcessEnv = process.env,
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

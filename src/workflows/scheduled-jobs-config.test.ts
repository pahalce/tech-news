import { describe, expect, it } from "vite-plus/test";

import { assertRequiredEnvironment, scheduledJobs } from "./scheduled-jobs-config";

describe("scheduled jobs config に関するテスト", () => {
  it("collect-feedback を設定したとき、08:00 JST daily の cron になる", () => {
    // Arrange
    const job = scheduledJobs.find((item) => item.name === "collect-feedback");

    // Act
    const actual = job?.cron;

    // Assert
    expect(actual).toBe("0 23 * * *");
  });

  it("zenn-digest を設定したとき、09:00 JST daily の cron になる", () => {
    // Arrange
    const job = scheduledJobs.find((item) => item.name === "zenn-digest");

    // Act
    const actual = job?.cron;

    // Assert
    expect(actual).toBe("0 0 * * *");
  });

  it("suggest-feature-vocabulary を設定したとき、Saturday 08:30 JST の cron になる", () => {
    // Arrange
    const job = scheduledJobs.find((item) => item.name === "suggest-feature-vocabulary");

    // Act
    const actual = job?.cron;

    // Assert
    expect(actual).toBe("30 23 * * 5");
  });

  it("dry-run で必須環境変数を渡したとき、entrypoint 設定エラーにならない", () => {
    // Arrange
    const env = {
      DISCORD_BOT_TOKEN: "token",
      DISCORD_CHANNEL_ID: "channel",
      GEMINI_API_KEY: "key",
    };

    // Act
    const actual = () => assertRequiredEnvironment("zenn-digest", env);

    // Assert
    expect(actual).not.toThrow();
  });

  it("Gemini secret がないとき、entrypoint 設定エラーにする", () => {
    // Arrange
    const env = {
      DISCORD_BOT_TOKEN: "token",
      DISCORD_CHANNEL_ID: "channel",
    };

    // Act
    const actual = () => assertRequiredEnvironment("zenn-digest", env);

    // Assert
    expect(actual).toThrow("GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is required.");
  });

  it("job 固有の必須環境変数がないとき、entrypoint 設定エラーにする", () => {
    // Arrange
    const env = {
      DISCORD_BOT_TOKEN: "token",
      GEMINI_API_KEY: "key",
    };

    // Act
    const actual = () => assertRequiredEnvironment("zenn-digest", env);

    // Assert
    expect(actual).toThrow(
      "zenn-digest is missing required environment variables: DISCORD_CHANNEL_ID",
    );
  });

  it("未設定の scheduled job 名を渡したとき、entrypoint 設定エラーにする", () => {
    // Arrange
    const env = {
      DISCORD_BOT_TOKEN: "token",
      DISCORD_CHANNEL_ID: "channel",
      GEMINI_API_KEY: "key",
    };

    // Act
    const actual = () => assertRequiredEnvironment("unknown-job" as never, env);

    // Assert
    expect(actual).toThrow("unknown-job is not a configured scheduled job.");
  });
});

import { describe, expect, it } from "vite-plus/test";

import {
  assertRequiredEnvironment,
  readLlmModelConfig,
  scheduledJobs,
} from "./scheduled-jobs-config";

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

  it("モデル環境変数を渡したとき、LLM model config に反映される", () => {
    // Arrange
    const env = {
      FEATURE_EXTRACTION_MODEL: "gpt-feature",
      RECOMMENDATION_CONTENT_MODEL: "gpt-content",
      RERANK_MODEL: "gpt-rerank",
      PREFERENCE_SUMMARY_MODEL: "gpt-summary",
      VOCABULARY_SUGGESTION_MODEL: "gpt-vocabulary",
    };

    // Act
    const actual = readLlmModelConfig(env);

    // Assert
    expect(actual.rerankModel).toBe("gpt-rerank");
  });

  it("共通モデル環境変数を渡したとき、個別指定のない LLM model config に反映される", () => {
    // Arrange
    const env = {
      LLM_MODEL: "gemini-2.5-flash",
      RERANK_MODEL: "gemini-2.5-pro",
    };

    // Act
    const actual = readLlmModelConfig(env);

    // Assert
    expect(actual.featureExtractionModel).toBe("gemini-2.5-flash");
    expect(actual.rerankModel).toBe("gemini-2.5-pro");
  });

  it("個別モデル環境変数が空文字のとき、LLM_MODEL にフォールバックする", () => {
    // Arrange
    const env = {
      LLM_MODEL: "gemini-2.5-flash",
      FEATURE_EXTRACTION_MODEL: "",
      RERANK_MODEL: "",
      RECOMMENDATION_CONTENT_MODEL: "   ",
      PREFERENCE_SUMMARY_MODEL: "",
      VOCABULARY_SUGGESTION_MODEL: "",
    };

    // Act
    const actual = readLlmModelConfig(env);

    // Assert
    expect(actual.featureExtractionModel).toBe("gemini-2.5-flash");
    expect(actual.rerankModel).toBe("gemini-2.5-flash");
    expect(actual.recommendationContentModel).toBe("gemini-2.5-flash");
    expect(actual.preferenceSummaryModel).toBe("gemini-2.5-flash");
    expect(actual.vocabularySuggestionModel).toBe("gemini-2.5-flash");
  });

  it("モデル環境変数を渡さないとき、Gemini の default model を使う", () => {
    // Arrange
    const env = {};

    // Act
    const actual = readLlmModelConfig(env);

    // Assert
    expect(actual.featureExtractionModel).toBe("gemini-2.5-flash");
  });

  it("OpenAI API key だけを渡したとき、OpenAI の default model を使う", () => {
    // Arrange
    const env = { OPENAI_API_KEY: "openai-key" };

    // Act
    const actual = readLlmModelConfig(env);

    // Assert
    expect(actual.featureExtractionModel).toBe("gpt-4.1-mini");
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

  it("Gemini provider の必須環境変数を渡したとき、entrypoint 設定エラーにならない", () => {
    // Arrange
    const env = {
      DISCORD_BOT_TOKEN: "token",
      DISCORD_CHANNEL_ID: "channel",
      LLM_PROVIDER: "gemini",
      GEMINI_API_KEY: "key",
    };

    // Act
    const actual = () => assertRequiredEnvironment("zenn-digest", env);

    // Assert
    expect(actual).not.toThrow();
  });

  it("OpenAI compatible provider で base URL がないとき、entrypoint 設定エラーにする", () => {
    // Arrange
    const env = {
      DISCORD_BOT_TOKEN: "token",
      DISCORD_CHANNEL_ID: "channel",
      LLM_PROVIDER: "openai-compatible",
      LLM_API_KEY: "key",
    };

    // Act
    const actual = () => assertRequiredEnvironment("zenn-digest", env);

    // Assert
    expect(actual).toThrow("LLM_BASE_URL is required.");
  });
});

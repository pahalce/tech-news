import * as v from "valibot";
import { describe, expect, it } from "vite-plus/test";

import { createEnv, llmApiKeyForConfig } from "src/shared/infrastructure/env";
import type { LlmRuntimeConfig } from "src/shared/infrastructure/runtime-config";

describe("runtime environment に関するテスト", () => {
  it("createEnv は server schema のキーを source から読み、trim した値を返す", () => {
    // Act
    const actual = createEnv({
      server: {
        DISCORD_BOT_TOKEN: v.pipe(v.string(), v.trim(), v.nonEmpty()),
        DISCORD_CHANNEL_ID: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      },
      source: {
        DISCORD_BOT_TOKEN: " token ",
        DISCORD_CHANNEL_ID: " channel ",
      },
    });

    // Assert
    expect(actual).toEqual({
      DISCORD_BOT_TOKEN: "token",
      DISCORD_CHANNEL_ID: "channel",
    });
  });

  it("createEnv は server schema にない source key を返さない", () => {
    // Act
    const actual = createEnv({
      server: {
        DISCORD_BOT_TOKEN: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      },
      source: {
        DISCORD_BOT_TOKEN: "token",
        EXTRA_ENV: "extra",
      },
    });

    // Assert
    expect(Object.keys(actual)).toEqual(["DISCORD_BOT_TOKEN"]);
  });

  it("createEnv は必須 env が空文字のとき、Valibot の検証エラーにする", () => {
    // Act
    const actual = () =>
      createEnv({
        server: {
          DISCORD_CHANNEL_ID: v.pipe(v.string(), v.trim(), v.nonEmpty()),
        },
        source: { DISCORD_CHANNEL_ID: "  " },
      }).DISCORD_CHANNEL_ID;

    // Assert
    expect(actual).toThrow();
  });

  it("Gemini provider の LLM API key を読む", () => {
    // Arrange
    const llmConfig: LlmRuntimeConfig = {
      provider: "gemini",
      baseModel: "gemini-3.1-flash-lite-preview",
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = llmApiKeyForConfig({
      llmConfig,
      source: { GEMINI_API_KEY: "gemini-key" },
    });

    // Assert
    expect(actual).toBe("gemini-key");
  });

  it("OpenAI provider の LLM API key を読む", () => {
    // Arrange
    const llmConfig: LlmRuntimeConfig = {
      provider: "openai",
      baseModel: "gpt-4.1-mini",
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = llmApiKeyForConfig({
      llmConfig,
      source: { OPENAI_API_KEY: "openai-key" },
    });

    // Assert
    expect(actual).toBe("openai-key");
  });

  it("OpenAI compatible provider の LLM API key を読む", () => {
    // Arrange
    const llmConfig: LlmRuntimeConfig = {
      provider: "openai-compatible",
      baseUrl: "https://gateway.example/v1",
      baseModel: "provider/model",
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = llmApiKeyForConfig({
      llmConfig,
      source: { LLM_API_KEY: "llm-key" },
    });

    // Assert
    expect(actual).toBe("llm-key");
  });
});

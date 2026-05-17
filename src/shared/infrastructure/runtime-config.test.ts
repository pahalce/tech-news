import { describe, expect, it } from "vite-plus/test";

import { resolveLlmModel, runtimeConfig, type LlmRuntimeConfig } from "./runtime-config";

describe("runtime config に関するテスト", () => {
  it("用途別 model が未指定のとき、base model を使う", () => {
    // Arrange
    const config: LlmRuntimeConfig = {
      provider: "gemini",
      baseModel: "gemini-3.1-flash-lite-preview",
      models: {},
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = resolveLlmModel(config, "featureExtraction");

    // Assert
    expect(actual).toBe("gemini-3.1-flash-lite-preview");
  });

  it("用途別 model が指定されているとき、その model を使う", () => {
    // Arrange
    const config: LlmRuntimeConfig = {
      provider: "openai",
      baseModel: "gpt-4.1-mini",
      models: {
        rerank: "gpt-4.1",
      },
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = resolveLlmModel(config, "rerank");

    // Assert
    expect(actual).toBe("gpt-4.1");
  });

  it("runtime config は LLM と HTTP timeout を TS で保持する", () => {
    // Act
    const actual = runtimeConfig;

    // Assert
    expect(actual.llm.requestTimeoutMs).toBe(90_000);
    expect(actual.http.requestTimeoutMs).toBe(20_000);
  });
});

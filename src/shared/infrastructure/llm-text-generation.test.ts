import { jsonSchema } from "ai";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createLlmLanguageModel } from "./llm-text-generation";
import type { LlmRuntimeConfig } from "./runtime-config";

const TestSchema = jsonSchema<{ ok: boolean }>({
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
});

describe("LLM text generation に関するテスト", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Gemini provider の API key がないとき、設定エラーにする", () => {
    // Act
    const actual = () =>
      createLlmLanguageModel({
        runtimeConfig: {
          provider: "gemini",
          baseModel: "gemini-2.5-flash",
          requestTimeoutMs: 90_000,
        },
        env: {},
        model: "gemini-2.5-flash",
      });

    // Assert
    expect(actual).toThrow();
  });

  it("OpenAI compatible provider で chat completions を呼び出す", async () => {
    // Arrange
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: toRequestUrl(url), init });
      return new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          model: "provider/model",
          object: "chat.completion",
          created: 1,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: '{"ok":true}' },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const model = createLlmLanguageModel({
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://gateway.example/v1",
        baseModel: "provider/model",
        requestTimeoutMs: 90_000,
      },
      env: { LLM_API_KEY: "key" },
      model: "provider/model",
      fetch: fetchImpl,
    });

    // Act
    const { generateText, Output } = await import("ai");
    const { output } = await generateText({
      model,
      output: Output.object({ schema: TestSchema }),
      system: "system",
      prompt: "user",
    });

    // Assert
    expect(output).toEqual({ ok: true });
    expect(calls[0]?.url).toBe("https://gateway.example/v1/chat/completions");
  });

  it("Gemini provider で generateContent を呼び出す", async () => {
    // Arrange
    let requestedUrl = "";
    let requestedBody: unknown;
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = toRequestUrl(url);
      requestedBody = JSON.parse(toRequestBody(init?.body));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: '{"ok":true}' }] },
              finishReason: "STOP",
            },
          ],
        }),
        { status: 200 },
      );
    };
    const model = createLlmLanguageModel({
      runtimeConfig: {
        provider: "gemini",
        baseModel: "gemini-2.5-flash",
        requestTimeoutMs: 90_000,
      },
      env: { GEMINI_API_KEY: "gemini-key" },
      model: "gemini-2.5-flash",
      fetch: fetchImpl,
    });

    // Act
    const { generateText, Output } = await import("ai");
    const { output } = await generateText({
      model,
      output: Output.object({ schema: TestSchema }),
      system: "system",
      prompt: "user",
    });

    // Assert
    expect(output).toEqual({ ok: true });
    expect(requestedUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(requestedBody).toMatchObject({
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
        },
      },
    });
  });

  it("OpenAI provider の API key がないとき、設定エラーにする", () => {
    // Arrange
    const runtimeConfig: LlmRuntimeConfig = {
      provider: "openai",
      baseModel: "gpt-4.1-mini",
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = () =>
      createLlmLanguageModel({
        runtimeConfig,
        env: {},
        model: "gpt-4.1-mini",
      });

    // Assert
    expect(actual).toThrow("Invalid type: Expected string but received undefined");
  });

  it("OpenAI compatible provider の API key がないとき、設定エラーにする", () => {
    // Arrange
    const runtimeConfig: LlmRuntimeConfig = {
      provider: "openai-compatible",
      baseUrl: "https://gateway.example/v1",
      baseModel: "provider/model",
      requestTimeoutMs: 90_000,
    };

    // Act
    const actual = () =>
      createLlmLanguageModel({
        runtimeConfig,
        env: {},
        model: "provider/model",
      });

    // Assert
    expect(actual).toThrow("Invalid type: Expected string but received undefined");
  });
});

function toRequestUrl(url: string | URL | Request): string {
  return typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
}

function toRequestBody(body: BodyInit | null | undefined): string {
  return typeof body === "string" ? body : "";
}

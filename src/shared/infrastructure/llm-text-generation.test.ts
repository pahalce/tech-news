import { jsonSchema } from "ai";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  assertRequiredLlmEnvironment,
  createLlmLanguageModel,
  generateLlmText,
} from "./llm-text-generation";
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
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalGoogleGenerativeAiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv("GEMINI_API_KEY", originalGeminiApiKey);
    restoreEnv("GOOGLE_GENERATIVE_AI_API_KEY", originalGoogleGenerativeAiApiKey);
  });

  it("Gemini provider のとき、Gemini API key を必須にする", () => {
    // Arrange
    const env = { GEMINI_API_KEY: "gemini-key" };

    // Act
    const actual = () => assertRequiredLlmEnvironment(env);

    // Assert
    expect(actual).not.toThrow();
  });

  it("Gemini provider のとき、Google Generative AI API key でも設定エラーにしない", () => {
    // Arrange
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: "google-key" };

    // Act
    const actual = () => assertRequiredLlmEnvironment(env);

    // Assert
    expect(actual).not.toThrow();
  });

  it("Gemini provider の API key がないとき、設定エラーにする", () => {
    // Arrange
    const env = {};

    // Act
    const actual = () => assertRequiredLlmEnvironment(env);

    // Assert
    expect(actual).toThrow("GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is required.");
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

  it("schema を指定して generateLlmText を呼ぶと、structured output を返す", async () => {
    // Arrange
    process.env.GEMINI_API_KEY = "gemini-key";
    globalThis.fetch = async () =>
      new Response(
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

    // Act
    const actual = await generateLlmText({
      model: "gemini-3.1-flash-lite-preview",
      system: "system",
      prompt: "prompt",
      schema: TestSchema,
    });

    // Assert
    expect(actual).toEqual({ ok: true });
  });

  it("schema を指定せず generateLlmText を呼ぶと、text を返す", async () => {
    // Arrange
    process.env.GEMINI_API_KEY = "gemini-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "plain text" }] },
              finishReason: "STOP",
            },
          ],
        }),
        { status: 200 },
      );

    // Act
    const actual = await generateLlmText({
      model: "gemini-3.1-flash-lite-preview",
      system: "system",
      prompt: "prompt",
    });

    // Assert
    expect(actual).toBe("plain text");
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
    expect(actual).toThrow("OPENAI_API_KEY is required.");
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
    expect(actual).toThrow("LLM_API_KEY is required.");
  });
});

function toRequestUrl(url: string | URL | Request): string {
  return typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
}

function toRequestBody(body: BodyInit | null | undefined): string {
  return typeof body === "string" ? body : "";
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

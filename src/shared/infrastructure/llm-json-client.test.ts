import { describe, expect, it } from "vite-plus/test";

import { readLlmProviderConfig, requestJsonFromLlm } from "./llm-json-client";

describe("LLM JSON client に関するテスト", () => {
  it("LLM_PROVIDER 未指定のとき、Gemini API key を読む", () => {
    // Arrange
    const env = { GEMINI_API_KEY: "gemini-key" };

    // Act
    const actual = readLlmProviderConfig(env);

    // Assert
    expect(actual).toEqual({
      provider: "gemini",
      apiKey: "gemini-key",
    });
  });

  it("Gemini provider を指定したとき、Gemini API key を読む", () => {
    // Arrange
    const env = { LLM_PROVIDER: "gemini", GEMINI_API_KEY: "gemini-key" };

    // Act
    const actual = readLlmProviderConfig(env);

    // Assert
    expect(actual).toEqual({
      provider: "gemini",
      apiKey: "gemini-key",
    });
  });

  it("OpenAI compatible provider を指定したとき、base URL と LLM API key を読む", () => {
    // Arrange
    const env = {
      LLM_PROVIDER: "openai-compatible",
      LLM_API_KEY: "gateway-key",
      LLM_BASE_URL: "https://example.com/v1/",
    };

    // Act
    const actual = readLlmProviderConfig(env);

    // Assert
    expect(actual).toEqual({
      provider: "openai-compatible",
      apiKey: "gateway-key",
      baseUrl: "https://example.com/v1",
    });
  });

  it("OpenAI compatible response から JSON を読む", async () => {
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

    // Act
    const actual = await requestJsonFromLlm(
      {
        provider: "openai-compatible",
        apiKey: "key",
        baseUrl: "https://gateway.example/v1",
        fetch: fetchImpl,
      },
      { model: "provider/model", system: "system", user: "user" },
    );

    // Assert
    expect(actual).toEqual({ ok: true });
    expect(calls[0]?.url).toBe("https://gateway.example/v1/chat/completions");
  });

  it("Gemini response から JSON を読む", async () => {
    // Arrange
    let requestedUrl = "";
    let requestedBody: unknown;
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = toRequestUrl(url);
      requestedBody = JSON.parse(toRequestBody(init?.body));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
        { status: 200 },
      );
    };

    // Act
    const actual = await requestJsonFromLlm(
      { provider: "gemini", apiKey: "gemini-key", fetch: fetchImpl },
      { model: "gemini-2.5-flash", system: "system", user: "user" },
    );

    // Assert
    expect(actual).toEqual({ ok: true });
    expect(requestedUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(requestedBody).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
  });

  it("provider が未対応のとき、設定エラーにする", () => {
    // Arrange
    const env = { LLM_PROVIDER: "cursor" };

    // Act
    const actual = () => readLlmProviderConfig(env);

    // Assert
    expect(actual).toThrow("Unsupported LLM_PROVIDER: cursor");
  });
});

function toRequestUrl(url: string | URL | Request): string {
  return typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
}

function toRequestBody(body: BodyInit | null | undefined): string {
  return typeof body === "string" ? body : "";
}

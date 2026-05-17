import type { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { createOpenAI } from "@ai-sdk/openai";

type GoogleGenerativeAiProvider = ReturnType<typeof createGoogleGenerativeAI>;
type OpenAiProvider = ReturnType<typeof createOpenAI>;

export type LlmGeminiModelId = Parameters<GoogleGenerativeAiProvider["languageModel"]>[0];
export type LlmOpenAiChatModelId = Parameters<OpenAiProvider["chat"]>[0];
export type LlmOpenAiCompatibleModelId = string;

export type LlmModelPurpose =
  | "featureExtraction"
  | "rerank"
  | "recommendationContent"
  | "preferenceSummary"
  | "vocabularySuggestion";

export type LlmModelOverrides<ModelId extends string> = Partial<Record<LlmModelPurpose, ModelId>>;

export type LlmRuntimeConfig =
  | {
      provider: "gemini";
      baseModel: LlmGeminiModelId;
      models?: LlmModelOverrides<LlmGeminiModelId>;
      requestTimeoutMs: number;
    }
  | {
      provider: "openai";
      baseModel: LlmOpenAiChatModelId;
      models?: LlmModelOverrides<LlmOpenAiChatModelId>;
      requestTimeoutMs: number;
    }
  | {
      provider: "openai-compatible";
      baseUrl: string;
      baseModel: LlmOpenAiCompatibleModelId;
      models?: LlmModelOverrides<LlmOpenAiCompatibleModelId>;
      requestTimeoutMs: number;
    };

export type LlmRuntimeModelId = string;

export type RuntimeConfig = {
  llm: LlmRuntimeConfig;
  http: {
    requestTimeoutMs: number;
  };
};

export const runtimeConfig = {
  llm: {
    provider: "gemini",
    baseModel: "gemini-3.1-flash-lite-preview",
    models: {},
    requestTimeoutMs: 90_000,
  },
  http: {
    requestTimeoutMs: 20_000,
  },
} as const satisfies RuntimeConfig;

export function resolveLlmModel(
  config: LlmRuntimeConfig,
  purpose: LlmModelPurpose,
): LlmRuntimeModelId {
  return config.models?.[purpose] ?? config.baseModel;
}

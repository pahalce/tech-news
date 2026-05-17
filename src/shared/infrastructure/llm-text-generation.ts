import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type FlexibleSchema, type LanguageModel } from "ai";

import { llmApiKeyForConfig, type RuntimeEnvironment } from "./env";
import {
  runtimeConfig,
  type LlmOpenAiChatModelId,
  type LlmRuntimeConfig,
  type LlmRuntimeModelId,
} from "./runtime-config";

export type LlmTextGenerationInput = {
  model: LlmRuntimeModelId;
  system: string;
  prompt: string;
};

export type LlmStructuredTextGenerationInput<OutputSchema> = LlmTextGenerationInput & {
  schema: FlexibleSchema<OutputSchema>;
};

export async function generateLlmText(input: LlmTextGenerationInput): Promise<string>;
export async function generateLlmText<OutputSchema>(
  input: LlmStructuredTextGenerationInput<OutputSchema>,
): Promise<OutputSchema>;
export async function generateLlmText<OutputSchema>(
  input: LlmTextGenerationInput | LlmStructuredTextGenerationInput<OutputSchema>,
): Promise<string | OutputSchema> {
  const model = createLlmLanguageModel({
    runtimeConfig: runtimeConfig.llm,
    model: input.model,
  });

  if ("schema" in input) {
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: input.schema,
      }),
      system: input.system,
      prompt: input.prompt,
      timeout: { totalMs: runtimeConfig.llm.requestTimeoutMs },
    });

    return output;
  }

  const { text } = await generateText({
    model,
    system: input.system,
    prompt: input.prompt,
    timeout: { totalMs: runtimeConfig.llm.requestTimeoutMs },
  });

  return text;
}

export function createLlmLanguageModel(input: {
  runtimeConfig: LlmRuntimeConfig;
  model: LlmRuntimeModelId;
  env?: RuntimeEnvironment;
  fetch?: typeof fetch;
}): LanguageModel {
  if (input.runtimeConfig.provider === "gemini") {
    return createGoogleGenerativeAI({
      apiKey: llmApiKeyForConfig({
        llmConfig: input.runtimeConfig,
        source: input.env,
      }),
      fetch: input.fetch,
    }).languageModel(input.model);
  }

  const openAi = createOpenAI({
    apiKey: llmApiKeyForConfig({
      llmConfig: input.runtimeConfig,
      source: input.env,
    }),
    baseURL:
      input.runtimeConfig.provider === "openai-compatible"
        ? input.runtimeConfig.baseUrl
        : undefined,
    fetch: input.fetch,
    name: input.runtimeConfig.provider,
  });

  return openAi.chat(input.model as LlmOpenAiChatModelId);
}

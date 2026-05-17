import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type FlexibleSchema, type LanguageModel } from "ai";

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

export function assertRequiredLlmEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  readLlmApiKey(runtimeConfig.llm, env);
}

export async function generateLlmText(input: LlmTextGenerationInput): Promise<string>;
export async function generateLlmText<OutputSchema>(
  input: LlmStructuredTextGenerationInput<OutputSchema>,
): Promise<OutputSchema>;
export async function generateLlmText<OutputSchema>(
  input: LlmTextGenerationInput | LlmStructuredTextGenerationInput<OutputSchema>,
): Promise<string | OutputSchema> {
  const model = createLlmLanguageModel({
    runtimeConfig: runtimeConfig.llm,
    env: process.env,
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
  env: NodeJS.ProcessEnv;
  model: LlmRuntimeModelId;
  fetch?: typeof fetch;
}): LanguageModel {
  if (input.runtimeConfig.provider === "gemini") {
    return createGoogleGenerativeAI({
      apiKey: readLlmApiKey(input.runtimeConfig, input.env),
      fetch: input.fetch,
    }).languageModel(input.model);
  }

  const openAi = createOpenAI({
    apiKey: readLlmApiKey(input.runtimeConfig, input.env),
    baseURL:
      input.runtimeConfig.provider === "openai-compatible"
        ? input.runtimeConfig.baseUrl
        : undefined,
    fetch: input.fetch,
    name: input.runtimeConfig.provider,
  });

  return openAi.chat(input.model as LlmOpenAiChatModelId);
}

function readLlmApiKey(config: LlmRuntimeConfig, env: NodeJS.ProcessEnv): string {
  if (config.provider === "gemini") {
    return requiredFirstEnv(env, ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"]);
  }

  if (config.provider === "openai") {
    return requiredEnv(env, "OPENAI_API_KEY");
  }

  return requiredEnv(env, "LLM_API_KEY");
}

function requiredFirstEnv(env: NodeJS.ProcessEnv, keys: readonly string[]): string {
  const key = keys.find((candidate) => env[candidate]);
  if (!key) {
    throw new Error(`${keys.join(" or ")} is required.`);
  }

  return env[key] as string;
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

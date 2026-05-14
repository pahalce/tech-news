import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";

export type LlmProvider = "openai" | "gemini" | "openai-compatible";

export type LlmProviderConfig = {
  provider: LlmProvider;
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type LlmJsonRequest = {
  model: string;
  system: string;
  user: string;
};

export function readLlmProviderConfig(env: Record<string, string | undefined>): LlmProviderConfig {
  const provider = readLlmProvider(env.LLM_PROVIDER);

  if (provider === "gemini") {
    return {
      provider,
      apiKey: requiredFirstEnv(env, [
        "GEMINI_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY",
        "LLM_API_KEY",
      ]),
    };
  }

  if (provider === "openai-compatible") {
    return {
      provider,
      apiKey: requiredFirstEnv(env, ["LLM_API_KEY"]),
      baseUrl: trimTrailingSlash(requiredEnv(env, "LLM_BASE_URL")),
    };
  }

  return {
    provider,
    apiKey: requiredFirstEnv(env, ["OPENAI_API_KEY", "LLM_API_KEY"]),
  };
}

export function assertRequiredLlmEnvironment(env: Record<string, string | undefined>): void {
  readLlmProviderConfig(env);
}

export async function requestJsonFromLlm(
  config: LlmProviderConfig,
  request: LlmJsonRequest,
): Promise<any> {
  const { object } = await generateObject({
    model: createLanguageModel(config, request.model),
    output: "no-schema",
    system: request.system,
    prompt: request.user,
  });

  return object;
}

function readLlmProvider(value: string | undefined): LlmProvider {
  if (!value || value === "gemini") {
    return "gemini";
  }

  if (value === "openai") {
    return "openai";
  }

  if (value === "openai-compatible") {
    return value;
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${value}`);
}

function createLanguageModel(config: LlmProviderConfig, model: string): LanguageModel {
  if (config.provider === "gemini") {
    return createGoogleGenerativeAI({
      apiKey: config.apiKey,
      fetch: config.fetch,
    })(model);
  }

  const openAi = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    fetch: config.fetch,
    name: config.provider,
  });

  return config.provider === "openai-compatible" ? openAi.chat(model) : openAi(model);
}

function requiredFirstEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[],
): string {
  const key = keys.find((candidate) => env[candidate]);
  if (!key) {
    throw new Error(`${keys.join(" or ")} is required.`);
  }

  return env[key] as string;
}

function requiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

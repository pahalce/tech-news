import * as v from "valibot";

import {
  runtimeConfig,
  type LlmRuntimeConfig,
  type RuntimeConfig,
} from "src/shared/infrastructure/runtime-config";

export type RuntimeEnvironment = Record<string, string | undefined>;

export function createEnv<const TServer extends v.ObjectEntries>(input: {
  server: TServer;
  source?: RuntimeEnvironment;
}): v.InferOutput<v.ObjectSchema<TServer, undefined>> {
  type EnvOutput = v.InferOutput<v.ObjectSchema<TServer, undefined>>;
  const source = input.source ?? process.env;
  let parsed: EnvOutput | null = null;

  function readEnv(): EnvOutput {
    parsed ??= v.parse(
      v.object(input.server),
      Object.fromEntries(Object.keys(input.server).map((key) => [key, source[key]])),
    );
    return parsed;
  }

  return new Proxy(
    {},
    {
      get: (_target, property) => readEnv()[property as keyof EnvOutput],
      ownKeys: () => Reflect.ownKeys(readEnv() as object),
      getOwnPropertyDescriptor: (_target, property) => ({
        enumerable: true,
        configurable: true,
        value: readEnv()[property as keyof EnvOutput],
      }),
    },
  ) as EnvOutput;
}

const activeLlmProvider = runtimeConfig.llm.provider as RuntimeConfig["llm"]["provider"];

export const env = createEnv({
  server: {
    DISCORD_BOT_TOKEN: v.pipe(v.string(), v.trim(), v.nonEmpty()),
    DISCORD_CHANNEL_ID: v.pipe(v.string(), v.trim(), v.nonEmpty()),

    ...(activeLlmProvider === "gemini"
      ? {
          GEMINI_API_KEY: v.pipe(v.string(), v.trim(), v.nonEmpty()),
        }
      : {}),

    ...(activeLlmProvider === "openai"
      ? {
          OPENAI_API_KEY: v.pipe(v.string(), v.trim(), v.nonEmpty()),
        }
      : {}),

    ...(activeLlmProvider === "openai-compatible"
      ? {
          LLM_API_KEY: v.pipe(v.string(), v.trim(), v.nonEmpty()),
        }
      : {}),
  },
});

export function llmApiKey(environment: RuntimeEnvironment = env as RuntimeEnvironment): string {
  if (runtimeConfig.llm.provider === "gemini") {
    return environment.GEMINI_API_KEY as string;
  }

  if (runtimeConfig.llm.provider === "openai") {
    return environment.OPENAI_API_KEY as string;
  }

  return environment.LLM_API_KEY as string;
}

export function llmApiKeyForConfig(input: {
  llmConfig: LlmRuntimeConfig;
  source?: RuntimeEnvironment;
}): string {
  if (input.llmConfig.provider === "gemini") {
    return createEnv({
      server: {
        GEMINI_API_KEY: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      },
      source: input.source,
    }).GEMINI_API_KEY;
  }

  if (input.llmConfig.provider === "openai") {
    return createEnv({
      server: {
        OPENAI_API_KEY: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      },
      source: input.source,
    }).OPENAI_API_KEY;
  }

  return createEnv({
    server: {
      LLM_API_KEY: v.pipe(v.string(), v.trim(), v.nonEmpty()),
    },
    source: input.source,
  }).LLM_API_KEY;
}

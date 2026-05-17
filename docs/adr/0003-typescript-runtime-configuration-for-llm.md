# 0003. TypeScript Runtime Configuration for LLM Calls

## Status

Accepted

## Context

LLM provider, model, and timeout configuration was split between environment variables, scheduled
job wiring, and TypeScript defaults. This made the effective model hard to understand and provided
poor editor support for model IDs.

Vercel AI SDK can also route string model IDs through AI Gateway, but that would add a paid gateway
dependency for jobs that can use direct provider APIs.

## Decision

Use `src/shared/infrastructure/runtime-config.ts` as the source of truth for runtime settings that
are not secrets.

The config owns the LLM provider, base model, task-specific model overrides, provider base URL for
OpenAI-compatible providers, LLM request timeout, and HTTP request timeout. Environment variables
are only used for secrets and Discord connection values.

LLM calls continue to use direct providers through the Vercel AI SDK:

- Gemini via `@ai-sdk/google`
- OpenAI via `@ai-sdk/openai` chat models
- OpenAI-compatible endpoints via `@ai-sdk/openai` chat models with a configured `baseURL`

Model ID types are exported as local aliases derived from the AI SDK provider APIs, so application
code does not depend directly on provider package type names.

## Consequences

Changing providers, model IDs, or timeouts is now a code change instead of an environment change.
This makes configuration reviewable and gives TypeScript completion for direct provider model IDs.

OpenAI-compatible model IDs remain plain strings because the AI SDK cannot know the model catalog of
an arbitrary compatible endpoint.

GitHub Actions no longer passes model, provider, base URL, or timeout variables. It only passes
secrets needed by the configured provider.

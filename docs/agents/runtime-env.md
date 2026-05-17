# Runtime environment

Scheduled agent jobs require these GitHub Actions secrets:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`

LLM runtime settings are defined in TypeScript at `src/shared/infrastructure/runtime-config.ts`.
Do not configure provider, model IDs, provider base URLs, or request timeouts through environment
variables.

Provider secrets depend on `runtimeConfig.llm.provider`:

- `gemini`: `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`
- `openai`: `OPENAI_API_KEY`
- `openai-compatible`: `LLM_API_KEY`

The runtime config also owns:

- `llm.provider`
- `llm.baseModel`
- `llm.models`
- `llm.requestTimeoutMs`
- `http.requestTimeoutMs`
- `llm.baseUrl` when `provider` is `openai-compatible`

Each scheduled job performs its Agent State writes before a single final Data Commit step is added to the workflow that owns persistence.

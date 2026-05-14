# Runtime environment

Scheduled agent jobs require these GitHub Actions secrets:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`

LLM calls go through the Vercel AI SDK. Provider secrets depend on `LLM_PROVIDER`:

- unset or `gemini`: `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `LLM_API_KEY`
- `openai`: `OPENAI_API_KEY` or `LLM_API_KEY`
- `openai-compatible`: `LLM_API_KEY` and `LLM_BASE_URL`

Use `openai-compatible` for providers or gateways that expose the OpenAI chat completions API.
Cursor does not currently expose a general-purpose model API for this workflow, so use a compatible
gateway such as OpenRouter or another OpenAI-compatible endpoint when you want Cursor-adjacent
models.

Model names are read from GitHub Actions variables or process environment variables:

- `LLM_MODEL`
- `FEATURE_EXTRACTION_MODEL`
- `RECOMMENDATION_CONTENT_MODEL`
- `RERANK_MODEL`
- `PREFERENCE_SUMMARY_MODEL`
- `VOCABULARY_SUGGESTION_MODEL`

`LLM_MODEL` is the common default. The task-specific variables override it when a job should use
different models for extraction, rerank, content writing, preference summaries, or vocabulary
descriptions. If none are set, the default is `gemini-2.5-flash`.

Each scheduled job performs its Agent State writes before a single final Data Commit step is added to the workflow that owns persistence.

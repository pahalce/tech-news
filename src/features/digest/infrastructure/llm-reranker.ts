import { jsonSchema } from "ai";
import * as v from "valibot";

import type { LlmReranker } from "src/features/digest/application/rerank-current-feed-candidates-use-case";
import { generateLlmText } from "src/shared/infrastructure/llm-text-generation";
import type { LlmRuntimeModelId } from "src/shared/infrastructure/runtime-config";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

const LlmRerankResultSchema = v.strictObject({
  selectedArticleIds: v.array(v.string()),
});

const LlmRerankResultOutputSchema = jsonSchema<v.InferOutput<typeof LlmRerankResultSchema>>(
  {
    type: "object",
    properties: {
      selectedArticleIds: { type: "array", items: { type: "string" } },
    },
    required: ["selectedArticleIds"],
    additionalProperties: false,
  },
  {
    validate: (value) => validateValibot(LlmRerankResultSchema, value),
  },
);

export function createLlmReranker(input: {
  model: LlmRuntimeModelId;
  logger: WorkflowLogger;
}): LlmReranker {
  return {
    rerank: async (rerankInput) => {
      const startedAt = performance.now();
      input.logger.info("rerank LLM request started", {
        model: input.model,
        candidateCount: rerankInput.topScoredCandidates.length,
        maxRecommendations: rerankInput.maxRecommendations,
      });
      let result: unknown;
      try {
        result = await generateLlmText({
          model: input.model,
          system: "You select the best Zenn articles for a concise personal technical digest.",
          schema: LlmRerankResultOutputSchema,
          prompt: [
            "Select article IDs using the provided structured output schema.",
            `Max recommendations: ${rerankInput.maxRecommendations}`,
            `Long-term preference summary: ${rerankInput.longTermPreferenceSummary ?? "none"}`,
            `Recent preference summary: ${rerankInput.recentPreferenceSummary ?? "none"}`,
            `Quality criteria: ${rerankInput.qualityCriteria.join(", ")}`,
            `Candidates: ${JSON.stringify(rerankInput.topScoredCandidates)}`,
          ].join("\n\n"),
        });
      } catch (error) {
        input.logger.error("rerank LLM request failed", {
          elapsedMs: elapsedMs(startedAt),
          candidateCount: rerankInput.topScoredCandidates.length,
          llmError: errorDetails(error),
        });
        throw error;
      }
      input.logger.info("rerank LLM request finished", {
        elapsedMs: elapsedMs(startedAt),
        selectedArticleCount: selectedArticleCount(result),
        llmResponse: result,
      });
      return result as Awaited<ReturnType<LlmReranker["rerank"]>>;
    },
  };
}

function selectedArticleCount(result: unknown): number | null {
  if (
    result &&
    typeof result === "object" &&
    "selectedArticleIds" in result &&
    Array.isArray(result.selectedArticleIds)
  ) {
    return result.selectedArticleIds.length;
  }

  return null;
}

function validateValibot<Output>(
  schema: v.GenericSchema<unknown, Output>,
  value: unknown,
): { success: true; value: Output } | { success: false; error: Error } {
  const result = v.safeParse(schema, value);
  if (result.success) {
    return { success: true, value: result.output };
  }

  return { success: false, error: new Error(v.summarize(result.issues)) };
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  return { message: String(error) };
}

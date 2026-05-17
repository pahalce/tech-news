import { jsonSchema } from "ai";
import * as v from "valibot";

import type { VocabularyCandidateDescriber } from "src/features/article-feature-maintenance/application/suggest-feature-vocabulary-candidates-use-case";
import { generateLlmText } from "src/shared/infrastructure/llm-text-generation";
import type { LlmRuntimeModelId } from "src/shared/infrastructure/runtime-config";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

const VocabularyCandidateDescriptionSchema = v.strictObject({
  description_ja: v.pipe(v.string(), v.nonEmpty()),
});

const VocabularyCandidateDescriptionOutputSchema = jsonSchema<
  v.InferOutput<typeof VocabularyCandidateDescriptionSchema>
>(
  {
    type: "object",
    properties: {
      description_ja: { type: "string", minLength: 1 },
    },
    required: ["description_ja"],
    additionalProperties: false,
  },
  {
    validate: (value) => {
      const result = v.safeParse(VocabularyCandidateDescriptionSchema, value);
      return result.success
        ? { success: true, value: result.output }
        : { success: false, error: new Error(v.summarize(result.issues)) };
    },
  },
);

export function createLlmVocabularyCandidateDescriber(input: {
  model: LlmRuntimeModelId;
  logger: WorkflowLogger;
}): VocabularyCandidateDescriber {
  return {
    describe: async (candidate) => {
      const startedAt = performance.now();
      input.logger.info("vocabulary candidate description LLM request started", {
        key: candidate.key,
        kind: candidate.kind,
        occurrenceCount: candidate.occurrenceCount,
      });

      try {
        const described = await generateLlmText({
          model: input.model,
          system:
            "You write concise Japanese descriptions for feature vocabulary promotion candidates.",
          schema: VocabularyCandidateDescriptionOutputSchema,
          prompt: [
            "Write the description using the provided structured output schema.",
            `Candidate key: ${candidate.key}`,
            `Kind: ${candidate.kind}`,
            `Occurrence count: ${candidate.occurrenceCount}`,
          ].join("\n\n"),
        });

        const descriptionJa =
          typeof described.description_ja === "string" && described.description_ja.length > 0
            ? described.description_ja
            : `${candidate.key} に関する昇格候補`;

        input.logger.info("vocabulary candidate description LLM request finished", {
          key: candidate.key,
          elapsedMs: elapsedMs(startedAt),
          descriptionLength: descriptionJa.length,
        });

        return descriptionJa;
      } catch (error) {
        input.logger.error("vocabulary candidate description LLM request failed", {
          key: candidate.key,
          kind: candidate.kind,
          elapsedMs: elapsedMs(startedAt),
          message: errorMessage(error),
        });
        throw error;
      }
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

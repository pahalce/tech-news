import { jsonSchema } from "ai";
import * as v from "valibot";

import type { PreferenceSummaryUpdater } from "src/features/feedback/application/collect-reaction-feedback-use-case";
import { generateLlmText } from "src/shared/infrastructure/llm-text-generation";
import type { LlmRuntimeModelId } from "src/shared/infrastructure/runtime-config";

const PreferenceSummarySchema = v.strictObject({
  long_term_summary: v.nullable(v.string()),
  recent_summary: v.nullable(v.string()),
  recent_confidence: v.picklist(["insufficient_feedback", "low", "medium", "high"]),
});

const PreferenceSummaryOutputSchema = jsonSchema<v.InferOutput<typeof PreferenceSummarySchema>>(
  {
    type: "object",
    properties: {
      long_term_summary: { type: ["string", "null"] },
      recent_summary: { type: ["string", "null"] },
      recent_confidence: {
        type: "string",
        enum: ["insufficient_feedback", "low", "medium", "high"],
      },
    },
    required: ["long_term_summary", "recent_summary", "recent_confidence"],
    additionalProperties: false,
  },
  {
    validate: (value) => {
      const result = v.safeParse(PreferenceSummarySchema, value);
      return result.success
        ? { success: true, value: result.output }
        : { success: false, error: new Error(v.summarize(result.issues)) };
    },
  },
);

export function createLlmPreferenceSummaryUpdater(input: {
  model: LlmRuntimeModelId;
}): PreferenceSummaryUpdater {
  return {
    update: async (summaryInput) => {
      if (summaryInput.processedFeedbackCount === 0) {
        return summaryInput.previousSummaryHistory;
      }

      const summary = await generateLlmText({
        model: input.model,
        system: "You summarize a single owner's technical article preferences in Japanese.",
        schema: PreferenceSummaryOutputSchema,
        prompt: [
          "Summarize preferences using the provided structured output schema.",
          `Collected at: ${summaryInput.collectedAt}`,
          `Processed feedback count: ${summaryInput.processedFeedbackCount}`,
          `Previous summary history: ${JSON.stringify(summaryInput.previousSummaryHistory)}`,
          `Preference profile: ${JSON.stringify(summaryInput.preferenceProfile)}`,
        ].join("\n\n"),
      });

      return {
        version: summaryInput.previousSummaryHistory.version,
        long_term_summary: stringOrNull(summary.long_term_summary),
        recent_summary: {
          window_days: summaryInput.previousSummaryHistory.recent_summary.window_days,
          summary: stringOrNull(summary.recent_summary),
          confidence:
            typeof summary.recent_confidence === "string"
              ? summary.recent_confidence
              : summaryInput.previousSummaryHistory.recent_summary.confidence,
        },
        history: [
          ...summaryInput.previousSummaryHistory.history,
          {
            summarized_at: summaryInput.collectedAt,
            processed_feedback_count: summaryInput.processedFeedbackCount,
            long_term_summary: stringOrNull(summary.long_term_summary),
            recent_summary: stringOrNull(summary.recent_summary),
          },
        ],
      };
    },
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

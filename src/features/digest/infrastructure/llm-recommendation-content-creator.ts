import { jsonSchema } from "ai";
import * as v from "valibot";

import type { RecommendationContentCreator } from "src/features/digest/application/create-recommendation-contents-use-case";
import {
  fetchArticleHtml,
  htmlToReadableText,
} from "src/features/digest/infrastructure/zenn-article-body-fetcher";
import { generateLlmText } from "src/shared/infrastructure/llm-text-generation";
import type { LlmRuntimeModelId } from "src/shared/infrastructure/runtime-config";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

const recommendationContentBodyMaxLength = 20_000;

const RecommendationContentSchema = v.strictObject({
  articleId: v.string(),
  summary: v.pipe(v.string(), v.nonEmpty()),
  whyRecommended: v.pipe(v.string(), v.nonEmpty()),
  learningPoints: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.minLength(1)),
  signalsUsed: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.minLength(1)),
});

const RecommendationContentOutputSchema = jsonSchema<
  v.InferOutput<typeof RecommendationContentSchema>
>(
  {
    type: "object",
    properties: {
      articleId: { type: "string" },
      summary: { type: "string", minLength: 1 },
      whyRecommended: { type: "string", minLength: 1 },
      learningPoints: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
      },
      signalsUsed: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
      },
    },
    required: ["articleId", "summary", "whyRecommended", "learningPoints", "signalsUsed"],
    additionalProperties: false,
  },
  {
    validate: (value) => validateValibot(RecommendationContentSchema, value),
  },
);

export function createLlmRecommendationContentCreator(input: {
  model: LlmRuntimeModelId;
  httpRequestTimeoutMs: number;
  logger: WorkflowLogger;
}): RecommendationContentCreator {
  return {
    create: async ({ candidate, featureExtraction }) => {
      const startedAt = performance.now();
      input.logger.info("recommendation content body fetch started", {
        articleId: candidate.articleId,
        url: candidate.canonicalUrl,
      });
      const bodyFetchStartedAt = performance.now();
      const articleHtml = await fetchArticleHtml({
        url: candidate.canonicalUrl,
        timeoutMs: input.httpRequestTimeoutMs,
      });
      const articleBody = htmlToReadableText(articleHtml);
      input.logger.info("recommendation content body fetch finished", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(bodyFetchStartedAt),
        bodyLength: articleBody.length,
        authorUsername: featureExtraction?.author?.username ?? null,
      });
      input.logger.info("recommendation content LLM request started", {
        articleId: candidate.articleId,
        model: input.model,
      });
      let result: unknown;
      try {
        result = await generateLlmText({
          model: input.model,
          system:
            "You write concise Japanese Discord recommendation content for one technical article. learningPoints must be concrete takeaways from the article body that remain useful without opening the article.",
          schema: RecommendationContentOutputSchema,
          prompt: [
            "Write recommendation content using the provided structured output schema.",
            "summary: 2-3 sentences summarizing the article.",
            "whyRecommended: why this article fits the owner's preferences and quality bar.",
            'learningPoints: 3-5 items. Each item must be a concrete fact, comparison, setting, step, or insight taken from the article body. Write standalone Japanese sentences. Do not write chapter titles, topic labels, or phrases like "〜について学べる" or "〜の違い" without stating the actual difference.',
            "signalsUsed: non-empty string array of signal keys used from feature extraction.",
            `Article ID: ${candidate.articleId}`,
            `Title: ${candidate.title}`,
            `URL: ${candidate.canonicalUrl}`,
            `Rule score: ${candidate.ruleScore}`,
            `Feature extraction: ${JSON.stringify(featureExtraction)}`,
            `Body:\n${articleBody.slice(0, recommendationContentBodyMaxLength)}`,
          ].join("\n\n"),
        });
      } catch (error) {
        input.logger.error("recommendation content LLM request failed", {
          articleId: candidate.articleId,
          elapsedMs: elapsedMs(startedAt),
          llmError: errorDetails(error),
        });
        throw error;
      }
      input.logger.info("recommendation content LLM request finished", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(startedAt),
        llmResponse: result,
      });
      return result as Awaited<ReturnType<RecommendationContentCreator["create"]>>;
    },
  };
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

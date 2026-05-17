import { jsonSchema, type JSONSchema7 } from "ai";

import type { FeatureVocabularyConfig } from "src/domains/article";
import type { ExtractCurrentFeedCandidateFeaturesInput } from "src/features/digest/application/extract-current-feed-candidate-features-use-case";
import { generateLlmText } from "src/shared/infrastructure/llm-text-generation";
import type { LlmRuntimeModelId } from "src/shared/infrastructure/runtime-config";
import { elapsedMs, type WorkflowLogger } from "src/shared/infrastructure/workflow-logger";

type LlmFeatureSignal = {
  key: string;
  salience: number;
};

type LlmFeatureExtractionOutput = {
  readability: {
    is_readable: boolean;
    reason: string | null;
  };
  primary_topics: LlmFeatureSignal[];
  mentioned_topics: LlmFeatureSignal[];
  feature_axes: Record<string, LlmFeatureSignal[]>;
  other_signals: LlmFeatureSignal[];
};

export function createLlmFeatureExtractor(input: {
  model: LlmRuntimeModelId;
  logger: WorkflowLogger;
}): ExtractCurrentFeedCandidateFeaturesInput["extractArticleFeatures"] {
  return async ({ candidate, body, progress, featureVocabulary }) => {
    const startedAt = performance.now();
    const featureVocabularyPrompt = formatFeatureVocabularyPrompt(featureVocabulary);
    input.logger.info("feature extraction LLM request started", {
      articleId: candidate.articleId,
      model: input.model,
      featureExtractionIndex: progress.index,
      featureExtractionTotal: progress.total,
      featureExtractionProgress: `${progress.index}/${progress.total}`,
    });
    let result: unknown;
    try {
      result = await generateLlmText({
        model: input.model,
        system: "You extract structured article features for a personal Zenn digest agent.",
        schema: createFeatureExtractionOutputSchema(featureVocabulary),
        prompt: [
          "Extract article features using the provided structured output schema.",
          "Every signal must use key and salience.",
          "feature_axes must be an object keyed by allowed axis keys, not an array.",
          "other_signals must be an array of { key, salience } objects. Use snake_case keys.",
          "If the article is not readable, set readability.is_readable false, readability.reason to a short string, and return empty arrays/objects for the other keys.",
          "Use only the allowed topic keys and feature keys below. Put unmatched topics into primary_topics or mentioned_topics using the closest allowed topic key only when it genuinely fits; otherwise omit them.",
          featureVocabularyPrompt,
          `Title: ${candidate.title}`,
          `URL: ${candidate.canonicalUrl}`,
          `Body:\n${body.slice(0, 20000)}`,
        ].join("\n\n"),
      });
    } catch (error) {
      input.logger.error("feature extraction LLM request failed", {
        articleId: candidate.articleId,
        elapsedMs: elapsedMs(startedAt),
        llmError: errorDetails(error),
      });
      throw error;
    }
    input.logger.info("feature extraction LLM request finished", {
      articleId: candidate.articleId,
      elapsedMs: elapsedMs(startedAt),
      llmResponse: result,
    });
    return result;
  };
}

function createFeatureExtractionOutputSchema(featureVocabulary: FeatureVocabularyConfig) {
  const topicKeys = Object.keys(featureVocabulary.topics);
  const featureAxes = Object.entries(featureVocabulary.feature_axes);
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      readability: {
        type: "object",
        properties: {
          is_readable: { type: "boolean" },
          reason: { type: ["string", "null"] },
        },
        required: ["is_readable", "reason"],
        additionalProperties: false,
      },
      primary_topics: { type: "array", items: featureSignalJsonSchema(topicKeys) },
      mentioned_topics: { type: "array", items: featureSignalJsonSchema(topicKeys) },
      feature_axes: {
        type: "object",
        properties: Object.fromEntries(
          featureAxes.map(([axis, config]) => [
            axis,
            {
              type: "array",
              items: featureSignalJsonSchema(Object.keys(config.features)),
            },
          ]),
        ),
        additionalProperties: false,
      },
      other_signals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", pattern: "^[a-z0-9_]+$" },
            salience: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["key", "salience"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "readability",
      "primary_topics",
      "mentioned_topics",
      "feature_axes",
      "other_signals",
    ],
    additionalProperties: false,
  };

  return jsonSchema<LlmFeatureExtractionOutput>(schema, {
    validate: (value) => validateFeatureExtractionOutput(value, featureVocabulary),
  });
}

function featureSignalJsonSchema(allowedKeys: string[]): JSONSchema7 {
  return {
    type: "object",
    properties: {
      key: allowedKeys.length > 0 ? { type: "string", enum: allowedKeys } : { type: "string" },
      salience: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["key", "salience"],
    additionalProperties: false,
  };
}

function validateFeatureExtractionOutput(
  value: unknown,
  featureVocabulary: FeatureVocabularyConfig,
) {
  try {
    const output = parseFeatureExtractionOutputShape(value);
    const topicKeys = new Set(Object.keys(featureVocabulary.topics));

    for (const topic of [...output.primary_topics, ...output.mentioned_topics]) {
      assertAllowedKey(topic.key, topicKeys, "topic");
    }

    for (const [axis, features] of Object.entries(output.feature_axes)) {
      const axisConfig = featureVocabulary.feature_axes[axis];
      if (!axisConfig) {
        throw new Error(`${axis} is not an allowed feature axis.`);
      }

      const featureKeys = new Set(Object.keys(axisConfig.features));
      for (const feature of features) {
        assertAllowedKey(feature.key, featureKeys, `${axis} feature`);
      }
    }

    return { success: true as const, value: output };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function parseFeatureExtractionOutputShape(value: unknown): LlmFeatureExtractionOutput {
  if (!isRecord(value)) {
    throw new Error("Feature extraction output must be an object.");
  }

  const readability = value.readability;
  if (!isRecord(readability) || typeof readability.is_readable !== "boolean") {
    throw new Error("Feature extraction readability is invalid.");
  }

  if (readability.reason !== null && typeof readability.reason !== "string") {
    throw new Error("Feature extraction readability reason is invalid.");
  }

  return {
    readability: {
      is_readable: readability.is_readable,
      reason: readability.reason,
    },
    primary_topics: parseFeatureSignals(value.primary_topics, "primary_topics"),
    mentioned_topics: parseFeatureSignals(value.mentioned_topics, "mentioned_topics"),
    feature_axes: parseFeatureAxes(value.feature_axes),
    other_signals: parseFeatureSignals(value.other_signals, "other_signals"),
  };
}

function parseFeatureAxes(value: unknown): Record<string, LlmFeatureSignal[]> {
  if (!isRecord(value)) {
    throw new Error("feature_axes must be an object.");
  }

  return Object.fromEntries(
    Object.entries(value).map(([axis, features]) => [axis, parseFeatureSignals(features, axis)]),
  );
}

function parseFeatureSignals(value: unknown, field: string): LlmFeatureSignal[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  return value.map((signal, index) => {
    if (!isRecord(signal)) {
      throw new Error(`${field}[${index}] must be an object.`);
    }

    if (typeof signal.key !== "string" || signal.key.length === 0) {
      throw new Error(`${field}[${index}].key must be a non-empty string.`);
    }

    if (
      typeof signal.salience !== "number" ||
      !Number.isFinite(signal.salience) ||
      signal.salience < 0 ||
      signal.salience > 1
    ) {
      throw new Error(`${field}[${index}].salience must be a number between 0 and 1.`);
    }

    return { key: signal.key, salience: signal.salience };
  });
}

function assertAllowedKey(key: string, allowedKeys: Set<string>, label: string): void {
  if (!allowedKeys.has(key)) {
    throw new Error(`${key} is not an allowed ${label} key.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatFeatureVocabularyPrompt(featureVocabulary: FeatureVocabularyConfig): string {
  return [
    `Allowed topic keys: ${Object.keys(featureVocabulary.topics).join(", ")}`,
    "Allowed feature axes and feature keys:",
    ...Object.entries(featureVocabulary.feature_axes).map(
      ([axis, config]) => `- ${axis}: ${Object.keys(config.features).join(", ")}`,
    ),
  ].join("\n");
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

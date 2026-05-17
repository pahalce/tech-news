import * as v from "valibot";

const LowercaseKeySchema = v.pipe(
  v.string(),
  v.nonEmpty("key must not be empty."),
  v.check((key) => key === key.toLowerCase(), "key must be lowercase."),
);

const JapaneseDescriptionSchema = v.pipe(
  v.string(),
  v.nonEmpty("description_ja must not be empty."),
  v.check(
    (description) => /[\u3040-\u30ff\u3400-\u9fff]/.test(description),
    "description_ja must include Japanese text.",
  ),
);

const TopicEntrySchema = v.object({
  display_name: v.pipe(v.string(), v.nonEmpty("display_name must not be empty.")),
  aliases: v.pipe(v.array(LowercaseKeySchema), v.minLength(1, "aliases must not be empty.")),
  description_ja: JapaneseDescriptionSchema,
});

const FeatureEntrySchema = v.object({
  description_ja: JapaneseDescriptionSchema,
});

const FeatureAxisSchema = v.object({
  description_ja: JapaneseDescriptionSchema,
  features: v.pipe(
    v.record(LowercaseKeySchema, FeatureEntrySchema),
    v.check((features) => Object.keys(features).length > 0, "features must not be empty."),
  ),
});

const FeatureVocabularyConfigSchema = v.object({
  version: v.literal(1),
  topics: v.pipe(
    v.record(LowercaseKeySchema, TopicEntrySchema),
    v.check((topics) => Object.keys(topics).length > 0, "topics must not be empty."),
  ),
  feature_axes: v.pipe(
    v.record(LowercaseKeySchema, FeatureAxisSchema),
    v.check((axes) => Object.keys(axes).length > 0, "feature_axes must not be empty."),
  ),
});

type FeatureVocabularyConfigData = v.InferOutput<typeof FeatureVocabularyConfigSchema>;

export type TopicNormalizationResult =
  | {
      kind: "known_topic";
      topicKey: string;
      displayName: string;
    }
  | {
      kind: "unknown_topic";
      normalizedTopic: string;
    };

export type FeatureVocabularyConfig = FeatureVocabularyConfigData & {
  normalizeTopic(topic: string): TopicNormalizationResult;
};

export type ArticleFeatureVocabularyKeys = Readonly<{
  topicKeys: readonly string[];
  featureAxisKeys: Readonly<Record<string, readonly string[]>>;
}>;

const supportedFeatureAxes = new Set([
  "content_types",
  "evidence_signals",
  "practical_signals",
  "depth_signals",
  "title_signals",
  "audience_levels",
]);

export function parseFeatureVocabularyConfig(value: unknown): FeatureVocabularyConfig {
  const config = v.parse(FeatureVocabularyConfigSchema, value);
  assertSupportedFeatureAxes(config);
  const topicsByAlias = new Map<string, { displayName: string; topicKey: string }>();

  for (const [topicKey, topic] of Object.entries(config.topics)) {
    registerTopicAlias(topicsByAlias, topicKey, topicKey, topic.display_name);
    for (const alias of topic.aliases) {
      registerTopicAlias(topicsByAlias, alias, topicKey, topic.display_name);
    }
  }

  return {
    ...config,
    normalizeTopic(topic) {
      const normalizedTopic = topic.toLowerCase();
      const knownTopic = topicsByAlias.get(normalizedTopic);

      if (knownTopic) {
        return {
          kind: "known_topic",
          topicKey: knownTopic.topicKey,
          displayName: knownTopic.displayName,
        };
      }

      return {
        kind: "unknown_topic",
        normalizedTopic,
      };
    },
  };
}

export function readArticleFeatureVocabularyKeys(
  config: FeatureVocabularyConfig,
): ArticleFeatureVocabularyKeys {
  return {
    topicKeys: Object.keys(config.topics),
    featureAxisKeys: Object.fromEntries(
      Object.entries(config.feature_axes).map(([axis, featureAxis]) => [
        axis,
        Object.keys(featureAxis.features),
      ]),
    ),
  };
}

function registerTopicAlias(
  topicsByAlias: Map<string, { displayName: string; topicKey: string }>,
  alias: string,
  topicKey: string,
  displayName: string,
): void {
  const existingTopic = topicsByAlias.get(alias);

  if (existingTopic && existingTopic.topicKey !== topicKey) {
    throw new Error(
      `Topic alias ${alias} is already used by ${existingTopic.topicKey} and cannot be used by ${topicKey}.`,
    );
  }

  topicsByAlias.set(alias, { displayName, topicKey });
}

function assertSupportedFeatureAxes(config: FeatureVocabularyConfigData): void {
  for (const axis of Object.keys(config.feature_axes)) {
    if (!supportedFeatureAxes.has(axis)) {
      throw new Error(`${axis} is not a supported Feature Axis.`);
    }
  }
}

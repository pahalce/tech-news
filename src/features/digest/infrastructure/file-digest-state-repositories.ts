import { join } from "node:path";

import {
  parseArticleExtractionRegistry,
  type ArticleExtractionRegistry,
} from "src/domains/article";
import {
  parsePublishedDigestRegistry,
  parseRecommendationContentHistory,
  type PublishedDigestRegistry,
  type RecommendationContentHistory,
} from "src/domains/digest";
import {
  parsePreferenceProfile,
  parsePreferenceSummaryHistory,
  type PreferenceProfile,
  type PreferenceSummaryHistory,
} from "src/domains/preference";
import type { DigestStateRepositories } from "src/features/digest/application/ports/digest-state-repositories";
import { loadFeatureVocabularyConfig } from "src/shared/infrastructure/file-article-feature-vocabulary-config";
import { readJsonFile, writeJsonFile } from "src/shared/infrastructure/json-file-store";

const defaultRepositoryRoot = join(import.meta.dirname, "../../../..");

export function createFileDigestStateRepositories(
  repositoryRoot = defaultRepositoryRoot,
): DigestStateRepositories {
  return {
    articleExtractionRegistry: {
      load: async () =>
        parseArticleExtractionRegistry(
          await readJsonFile(join(repositoryRoot, "data", "feature-extraction-state.json")),
        ),
      save: async (registry: ArticleExtractionRegistry) =>
        writeJsonFile(join(repositoryRoot, "data", "feature-extraction-state.json"), registry),
    },
    preferenceProfile: {
      load: async () =>
        parsePreferenceProfile(
          await readJsonFile(join(repositoryRoot, "data", "preference-profile.json")),
          await loadFeatureVocabularyConfig(repositoryRoot),
        ),
      save: async (profile: PreferenceProfile) =>
        writeJsonFile(join(repositoryRoot, "data", "preference-profile.json"), profile),
    },
    preferenceSummaryHistory: {
      load: async () =>
        parsePreferenceSummaryHistory(
          await readJsonFile(join(repositoryRoot, "data", "preference-summary-history.json")),
        ),
      save: async (history: PreferenceSummaryHistory) =>
        writeJsonFile(join(repositoryRoot, "data", "preference-summary-history.json"), history),
    },
    publishedDigestRegistry: {
      load: async () =>
        parsePublishedDigestRegistry(
          await readJsonFile(join(repositoryRoot, "data", "publication-state.json")),
        ),
      save: async (registry: PublishedDigestRegistry) =>
        writeJsonFile(join(repositoryRoot, "data", "publication-state.json"), registry),
    },
    recommendationContentHistory: {
      load: async () =>
        parseRecommendationContentHistory(
          await readJsonFile(join(repositoryRoot, "data", "recommendation-content-state.json")),
        ),
      save: async (history: RecommendationContentHistory) =>
        writeJsonFile(join(repositoryRoot, "data", "recommendation-content-state.json"), history),
    },
  };
}

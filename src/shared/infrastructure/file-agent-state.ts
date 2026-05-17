import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { parseFeatureExtractionState } from "src/domains/article";
import { loadFeatureVocabularyConfig } from "src/shared/infrastructure/file-article-feature-vocabulary-config";
import { parsePreferenceProfile, parsePreferenceSummaryHistory } from "src/domains/preference";
import { parsePublicationState, parseRecommendationContentState } from "src/domains/digest";
import { parseVocabularySuggestionState } from "src/domains/article";
import type {
  ArticleExtractionRegistryRepository,
  ArticleFeatureSuggestionHistoryRepository,
  PreferenceProfileRepository,
  PreferenceSummaryHistoryRepository,
  PublishedDigestRegistryRepository,
  RecommendationContentHistoryRepository,
} from "src/shared/application/state-repositories";

const defaultRepositoryRoot = join(import.meta.dirname, "../../..");

export type FileStateRepositories = {
  articleExtractionRegistry: ArticleExtractionRegistryRepository;
  preferenceProfile: PreferenceProfileRepository;
  preferenceSummaryHistory: PreferenceSummaryHistoryRepository;
  publishedDigestRegistry: PublishedDigestRegistryRepository;
  recommendationContentHistory: RecommendationContentHistoryRepository;
  articleFeatureSuggestionHistory: ArticleFeatureSuggestionHistoryRepository;
};

export function createFileStateRepositories(
  repositoryRoot = defaultRepositoryRoot,
): FileStateRepositories {
  return {
    articleExtractionRegistry: {
      load: async () =>
        parseFeatureExtractionState(
          await readJson(join(repositoryRoot, "data", "feature-extraction-state.json")),
        ),
      save: async (state) =>
        writeJson(join(repositoryRoot, "data", "feature-extraction-state.json"), state),
    },
    preferenceProfile: {
      load: async () =>
        parsePreferenceProfile(
          await readJson(join(repositoryRoot, "data", "preference-profile.json")),
          await loadFeatureVocabularyConfig(repositoryRoot),
        ),
      save: async (profile) =>
        writeJson(join(repositoryRoot, "data", "preference-profile.json"), profile),
    },
    preferenceSummaryHistory: {
      load: async () =>
        parsePreferenceSummaryHistory(
          await readJson(join(repositoryRoot, "data", "preference-summary-history.json")),
        ),
      save: async (history) =>
        writeJson(join(repositoryRoot, "data", "preference-summary-history.json"), history),
    },
    publishedDigestRegistry: {
      load: async () =>
        parsePublicationState(
          await readJson(join(repositoryRoot, "data", "publication-state.json")),
        ),
      save: async (state) =>
        writeJson(join(repositoryRoot, "data", "publication-state.json"), state),
    },
    recommendationContentHistory: {
      load: async () =>
        parseRecommendationContentState(
          await readJson(join(repositoryRoot, "data", "recommendation-content-state.json")),
        ),
      save: async (state) =>
        writeJson(join(repositoryRoot, "data", "recommendation-content-state.json"), state),
    },
    articleFeatureSuggestionHistory: {
      load: async () =>
        parseVocabularySuggestionState(
          await readJson(join(repositoryRoot, "data", "vocabulary-suggestion-state.json")),
        ),
      save: async (state) =>
        writeJson(join(repositoryRoot, "data", "vocabulary-suggestion-state.json"), state),
    },
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

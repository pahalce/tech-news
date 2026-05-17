import { join } from "node:path";

import {
  parseArticleExtractionRegistry,
  parseArticleFeatureSuggestionHistory,
  type ArticleExtractionRegistry,
  type ArticleFeatureSuggestionHistory,
} from "src/domains/article";
import { parsePublishedDigestRegistry, type PublishedDigestRegistry } from "src/domains/digest";
import type { ArticleFeatureMaintenanceStateRepositories } from "src/features/article-feature-maintenance/application/ports/article-feature-maintenance-state-repositories";
import { readJsonFile, writeJsonFile } from "src/shared/infrastructure/json-file-store";

const defaultRepositoryRoot = join(import.meta.dirname, "../../../..");

export function createFileArticleFeatureMaintenanceStateRepositories(
  repositoryRoot = defaultRepositoryRoot,
): ArticleFeatureMaintenanceStateRepositories {
  return {
    articleExtractionRegistry: {
      load: async () =>
        parseArticleExtractionRegistry(
          await readJsonFile(join(repositoryRoot, "data", "feature-extraction-state.json")),
        ),
      save: async (registry: ArticleExtractionRegistry) =>
        writeJsonFile(join(repositoryRoot, "data", "feature-extraction-state.json"), registry),
    },
    publishedDigestRegistry: {
      load: async () =>
        parsePublishedDigestRegistry(
          await readJsonFile(join(repositoryRoot, "data", "publication-state.json")),
        ),
      save: async (registry: PublishedDigestRegistry) =>
        writeJsonFile(join(repositoryRoot, "data", "publication-state.json"), registry),
    },
    articleFeatureSuggestionHistory: {
      load: async () =>
        parseArticleFeatureSuggestionHistory(
          await readJsonFile(join(repositoryRoot, "data", "vocabulary-suggestion-state.json")),
        ),
      save: async (history: ArticleFeatureSuggestionHistory) =>
        writeJsonFile(join(repositoryRoot, "data", "vocabulary-suggestion-state.json"), history),
    },
  };
}

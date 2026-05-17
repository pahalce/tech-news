import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parseFeatureExtractionState } from "src/domains/article";
import { loadFeatureVocabularyConfig } from "src/shared/infrastructure/file-article-feature-vocabulary-config";
import { parsePreferenceProfile, parsePreferenceSummaryHistory } from "src/domains/preference";
import { parsePublicationState, parseRecommendationContentState } from "src/domains/digest";
import { parseVocabularySuggestionState } from "src/domains/article";
import type { AgentState, AgentStateRepository } from "src/shared/application/agent-state";

const defaultRepositoryRoot = join(import.meta.dirname, "../../..");

export async function loadAgentState(repositoryRoot = defaultRepositoryRoot): Promise<AgentState> {
  const [
    featureVocabulary,
    featureExtractionStateJson,
    preferenceProfileJson,
    preferenceSummaryHistoryJson,
    publicationStateJson,
    recommendationContentStateJson,
    vocabularySuggestionStateJson,
  ] = await Promise.all([
    loadFeatureVocabularyConfig(repositoryRoot),
    readJson(join(repositoryRoot, "data", "feature-extraction-state.json")),
    readJson(join(repositoryRoot, "data", "preference-profile.json")),
    readJson(join(repositoryRoot, "data", "preference-summary-history.json")),
    readJson(join(repositoryRoot, "data", "publication-state.json")),
    readJson(join(repositoryRoot, "data", "recommendation-content-state.json")),
    readJson(join(repositoryRoot, "data", "vocabulary-suggestion-state.json")),
  ]);
  const preferenceProfile = parsePreferenceProfile(preferenceProfileJson, featureVocabulary);

  return {
    featureExtractionState: parseFeatureExtractionState(featureExtractionStateJson),
    preferenceProfile,
    preferenceSummaryHistory: parsePreferenceSummaryHistory(preferenceSummaryHistoryJson),
    publicationState: parsePublicationState(publicationStateJson),
    recommendationContentState: parseRecommendationContentState(recommendationContentStateJson),
    vocabularySuggestionState: parseVocabularySuggestionState(vocabularySuggestionStateJson),
  };
}

export async function saveAgentState(
  state: AgentState,
  repositoryRoot = defaultRepositoryRoot,
): Promise<void> {
  const dataDirectory = join(repositoryRoot, "data");
  await mkdir(dataDirectory, { recursive: true });
  await Promise.all([
    writeJson(join(dataDirectory, "feature-extraction-state.json"), state.featureExtractionState),
    writeJson(join(dataDirectory, "preference-profile.json"), state.preferenceProfile),
    writeJson(
      join(dataDirectory, "preference-summary-history.json"),
      state.preferenceSummaryHistory,
    ),
    writeJson(join(dataDirectory, "publication-state.json"), state.publicationState),
    writeJson(
      join(dataDirectory, "recommendation-content-state.json"),
      state.recommendationContentState,
    ),
    writeJson(
      join(dataDirectory, "vocabulary-suggestion-state.json"),
      state.vocabularySuggestionState,
    ),
  ]);
}

export function createFileAgentStateRepository(repositoryRoot?: string): AgentStateRepository {
  return {
    load: () => loadAgentState(repositoryRoot),
    save: (state) => saveAgentState(state, repositoryRoot),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

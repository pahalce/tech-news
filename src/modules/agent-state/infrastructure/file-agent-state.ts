import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseFeatureExtractionState,
  type FeatureExtractionState,
} from "../../article/domain/feature-extraction";
import { loadFeatureVocabularyConfig } from "../../feature/infrastructure/file-feature-vocabulary-config";
import {
  parsePreferenceProfile,
  parsePreferenceSummaryHistory,
  type PreferenceProfile,
  type PreferenceSummaryHistory,
} from "../../preference/domain/preference-state";

export type AgentState = {
  featureExtractionState: FeatureExtractionState;
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
};

const defaultRepositoryRoot = join(import.meta.dirname, "../../../..");

export async function loadAgentState(repositoryRoot = defaultRepositoryRoot): Promise<AgentState> {
  const [
    featureVocabulary,
    featureExtractionStateJson,
    preferenceProfileJson,
    preferenceSummaryHistoryJson,
  ] = await Promise.all([
    loadFeatureVocabularyConfig(repositoryRoot),
    readJson(join(repositoryRoot, "data", "feature-extraction-state.json")),
    readJson(join(repositoryRoot, "data", "preference-profile.json")),
    readJson(join(repositoryRoot, "data", "preference-summary-history.json")),
  ]);
  const preferenceProfile = parsePreferenceProfile(preferenceProfileJson, featureVocabulary);

  return {
    featureExtractionState: parseFeatureExtractionState(featureExtractionStateJson),
    preferenceProfile,
    preferenceSummaryHistory: parsePreferenceSummaryHistory(preferenceSummaryHistoryJson),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

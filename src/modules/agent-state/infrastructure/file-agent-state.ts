import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadFeatureVocabularyConfig } from "../../feature";
import {
  parsePreferenceProfile,
  parsePreferenceSummaryHistory,
  type PreferenceProfile,
  type PreferenceSummaryHistory,
} from "../../preference";

export type AgentState = {
  preferenceProfile: PreferenceProfile;
  preferenceSummaryHistory: PreferenceSummaryHistory;
};

const defaultRepositoryRoot = join(import.meta.dirname, "../../../..");

export async function loadAgentState(repositoryRoot = defaultRepositoryRoot): Promise<AgentState> {
  const [featureVocabulary, preferenceProfileJson, preferenceSummaryHistoryJson] =
    await Promise.all([
      loadFeatureVocabularyConfig(repositoryRoot),
      readJson(join(repositoryRoot, "data", "preference-profile.json")),
      readJson(join(repositoryRoot, "data", "preference-summary-history.json")),
    ]);
  const preferenceProfile = parsePreferenceProfile(preferenceProfileJson, featureVocabulary);

  return {
    preferenceProfile,
    preferenceSummaryHistory: parsePreferenceSummaryHistory(preferenceSummaryHistoryJson),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseFeatureVocabularyConfig,
  type FeatureVocabularyConfig,
} from "src/domains/article/article-feature-vocabulary";

const defaultRepositoryRoot = join(import.meta.dirname, "../../..");

export async function loadFeatureVocabularyConfig(
  repositoryRoot = defaultRepositoryRoot,
): Promise<FeatureVocabularyConfig> {
  const value = JSON.parse(
    await readFile(join(repositoryRoot, "config", "feature-vocabulary.json"), "utf8"),
  ) as unknown;

  return parseFeatureVocabularyConfig(value);
}

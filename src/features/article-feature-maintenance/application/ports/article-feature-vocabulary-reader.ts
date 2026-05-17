import type { FeatureVocabularyConfig } from "src/domains/article";

export type ArticleFeatureVocabularyReader = {
  read(): Promise<FeatureVocabularyConfig>;
};

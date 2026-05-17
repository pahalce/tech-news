import {
  runSuggestFeatureVocabulary,
  validateSuggestFeatureVocabularyDryRun,
} from "src/features/article-feature-maintenance/presentation/run-suggest-feature-vocabulary";

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  await validateSuggestFeatureVocabularyDryRun();
  console.log("suggest-feature-vocabulary dry-run ok");
} else {
  await runSuggestFeatureVocabulary();
  console.log("suggest-feature-vocabulary completed");
}

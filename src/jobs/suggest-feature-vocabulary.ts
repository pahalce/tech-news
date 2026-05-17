import { assertRequiredEnvironment } from "src/workflows/scheduled-jobs-config";
import {
  runSuggestFeatureVocabulary,
  validateSuggestFeatureVocabularyDryRun,
} from "src/workflows/run-suggest-feature-vocabulary";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("suggest-feature-vocabulary");
}

if (isDryRun) {
  await validateSuggestFeatureVocabularyDryRun();
  console.log("suggest-feature-vocabulary dry-run ok");
} else {
  await runSuggestFeatureVocabulary();
  console.log("suggest-feature-vocabulary completed");
}

import { assertRequiredEnvironment } from "../workflows/scheduled-jobs-config";
import {
  runSuggestFeatureVocabulary,
  validateSuggestFeatureVocabularyDryRun,
} from "../workflows/run-suggest-feature-vocabulary";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("suggest-feature-vocabulary", process.env);
}

if (isDryRun) {
  await validateSuggestFeatureVocabularyDryRun();
  console.log("suggest-feature-vocabulary dry-run ok");
} else {
  await runSuggestFeatureVocabulary();
  console.log("suggest-feature-vocabulary completed");
}

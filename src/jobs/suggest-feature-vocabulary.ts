import { assertRequiredEnvironment } from "../workflows/scheduled-jobs-config";
import {
  runSuggestFeatureVocabularyFromEnvironment,
  validateSuggestFeatureVocabularyDryRun,
} from "../workflows/run-suggest-feature-vocabulary-from-environment";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("suggest-feature-vocabulary", process.env);
}

if (isDryRun) {
  await validateSuggestFeatureVocabularyDryRun();
  console.log("suggest-feature-vocabulary dry-run ok");
} else {
  await runSuggestFeatureVocabularyFromEnvironment(process.env);
  console.log("suggest-feature-vocabulary completed");
}

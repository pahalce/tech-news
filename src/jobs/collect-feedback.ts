import { assertRequiredEnvironment } from "../workflows/scheduled-jobs-config";
import {
  runCollectFeedbackFromEnvironment,
  validateCollectFeedbackDryRun,
} from "../workflows/run-collect-feedback-from-environment";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("collect-feedback", process.env);
}

if (isDryRun) {
  await validateCollectFeedbackDryRun();
  console.log("collect-feedback dry-run ok");
} else {
  await runCollectFeedbackFromEnvironment(process.env);
  console.log("collect-feedback completed");
}

import { assertRequiredEnvironment } from "src/workflows/scheduled-jobs-config";
import {
  runCollectFeedback,
  validateCollectFeedbackDryRun,
} from "src/workflows/run-collect-feedback";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("collect-feedback");
}

if (isDryRun) {
  await validateCollectFeedbackDryRun();
  console.log("collect-feedback dry-run ok");
} else {
  await runCollectFeedback();
  console.log("collect-feedback completed");
}

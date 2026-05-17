import {
  runCollectFeedback,
  validateCollectFeedbackDryRun,
} from "src/jobs/runtime/run-collect-feedback";

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  await validateCollectFeedbackDryRun();
  console.log("collect-feedback dry-run ok");
} else {
  await runCollectFeedback();
  console.log("collect-feedback completed");
}

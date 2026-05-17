import { assertRequiredEnvironment } from "../workflows/scheduled-jobs-config";
import { runZennDigest, validateZennDigestDryRun } from "../workflows/run-zenn-digest";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("zenn-digest", process.env);
}

if (isDryRun) {
  await validateZennDigestDryRun();
  console.log("zenn-digest dry-run ok");
} else {
  await runZennDigest();
  console.log("zenn-digest completed");
}

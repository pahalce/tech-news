import { assertRequiredEnvironment } from "../workflows/scheduled-jobs-config";
import {
  runZennDigestFromEnvironment,
  validateZennDigestDryRun,
} from "../workflows/run-zenn-digest-from-environment";

const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun) {
  assertRequiredEnvironment("zenn-digest", process.env);
}

if (isDryRun) {
  await validateZennDigestDryRun();
  console.log("zenn-digest dry-run ok");
} else {
  await runZennDigestFromEnvironment(process.env);
  console.log("zenn-digest completed");
}

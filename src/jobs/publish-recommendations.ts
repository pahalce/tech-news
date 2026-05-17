import {
  runZennDigest,
  validateZennDigestDryRun,
} from "src/features/digest/presentation/run-zenn-digest";

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  await validateZennDigestDryRun();
  console.log("zenn-digest dry-run ok");
} else {
  await runZennDigest();
  console.log("zenn-digest completed");
}

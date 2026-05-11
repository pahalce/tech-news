#!/usr/bin/env sh
set -eu

# Codex Stop hook expects JSON on stdout when exiting 0.
# Keep stdout JSON-only; logs can go to stderr.

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

log_path="${TMPDIR:-/tmp}/codex-stop-quality-check.$$.log"

cleanup() {
  rm -f "$log_path" 2>/dev/null || true
}
trap cleanup EXIT

if sh "$repo_root/.agents/hooks/run-quality-checks.sh" >"$log_path" 2>&1; then
  cat "$log_path" >&2
  printf '%s\n' '{"continue":true}'
  exit 0
fi

cat "$log_path" >&2

# Ask Codex to continue with a new prompt to fix issues.
printf '%s\n' '{"decision":"block","reason":"Quality checks failed (vp check --fix and/or architecture check). See the log at TMPDIR/codex-stop-quality-check.*.log (if available)."}'
exit 0

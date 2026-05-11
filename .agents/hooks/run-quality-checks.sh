#!/usr/bin/env sh
set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

export CI="${CI:-true}"

pnpm exec vp check --fix
node scripts/check-architecture.ts

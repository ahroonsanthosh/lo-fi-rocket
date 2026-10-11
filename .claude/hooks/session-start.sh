#!/bin/bash
# SessionStart hook: install workspace dependencies in Claude Code cloud sessions
# so that `pnpm check` (typecheck, lint, format, tests) works immediately.
# Runs synchronously; idempotent; no-op outside remote sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g pnpm@10
fi

# Lockfile is committed; prefer the frozen lockfile so CI and sessions agree,
# but do not fail the session if the lockfile is being updated on this branch.
pnpm install --frozen-lockfile || pnpm install

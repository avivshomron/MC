#!/usr/bin/env bash
# Open .env.local in Cursor, VS Code, or the system default text editor.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
touch .env.local

if command -v cursor >/dev/null 2>&1; then
  exec cursor .env.local
elif command -v code >/dev/null 2>&1; then
  exec code .env.local
elif [[ "$(uname -s)" == "Darwin" ]]; then
  exec open -t .env.local
else
  "${EDITOR:-nano}" .env.local
fi

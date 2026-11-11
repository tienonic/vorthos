#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${1:-}" == "--worker" ]]; then
  node run.mjs full
  node export.mjs full > cache/full-export.log
  node validate.mjs full > cache/full-validation-console.json
  node examples.mjs full > cache/full-examples-console.txt
  node audit.mjs > cache/embedding-audit-console.json
  node report.mjs
else
  mkdir -p cache
  if [[ -f cache/run.lock ]] && kill -0 "$(cat cache/run.lock)" 2>/dev/null; then
    printf 'Pipeline is already running with PID %s\n' "$(cat cache/run.lock)"
    exit 1
  fi
  if command -v tmux >/dev/null 2>&1; then
    if tmux has-session -t '=vorthos-pipeline' 2>/dev/null; then
      printf 'The vorthos-pipeline tmux session already exists.\n'
      exit 1
    fi
    tmux new-session -d -s vorthos-pipeline -c "$PWD" 'exec ./start-full.sh --worker >> cache/full.log 2>&1'
    printf 'Started detached tmux session vorthos-pipeline; log: cache/full.log\n'
  else
    nohup setsid "$PWD/start-full.sh" --worker >> cache/full.log 2>&1 < /dev/null &
    printf '%s\n' "$!" > cache/launcher.pid
    printf 'Started detached launcher PID %s; log: cache/full.log\n' "$!"
  fi
fi

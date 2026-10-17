#!/bin/bash
# QA harness: starts the Square/Anthropic mocks and an Astro dev server wired to them.
#   REPO     repo to serve (default: this repo)            QA_OUT   logs/screens/PDFs (default /tmp/tracelings-qa)
#   QA_PORT  site port (4421)   SQ_PORT  Square mock (4110)   AI_PORT  Anthropic mock (4111)
# Then:  python3 scripts/qa/api_tests.py scripts/qa $QA_OUT/logs/api.txt   (and the other *.py flows)
# Stop:  scripts/qa/down.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${REPO:-$(cd "$HERE/../.." && pwd)}"
export QA_OUT="${QA_OUT:-/tmp/tracelings-qa}" QA_PORT="${QA_PORT:-4421}" SQ_PORT="${SQ_PORT:-4110}" AI_PORT="${AI_PORT:-4111}"
mkdir -p "$QA_OUT/logs"
(cd "$HERE/../.." && nohup env SQ_PORT=$SQ_PORT AI_PORT=$AI_PORT QA_OUT="$QA_OUT" node "$(command -v tsx || echo node_modules/.bin/tsx)" scripts/qa/mocks.mts > "$QA_OUT/logs/mocks.out" 2>&1 & echo $! > "$QA_OUT/mocks.pid")
cd "$REPO"
env -u ANTHROPIC_BASE_URL -u NOTIFY_WEBHOOK_URL -u BLOB_READ_WRITE_TOKEN -u KIT_API_KEY \
  SQUARE_ACCESS_TOKEN=sq-qa-token-SECRETSQ SQUARE_BASE_URL=http://127.0.0.1:$SQ_PORT \
  SESSION_SECRET=qa-secret-qa-secret-qa-secret-0123456789XYZ \
  ANTHROPIC_API_KEY=sk-ant-qa-SECRETKEY ANTHROPIC_BASE_URL=http://127.0.0.1:$AI_PORT \
  PROGRAM_FAMILY_MONTHLY_MAX=${FAM_MAX:-60} ${QA_EXTRA_ENV:-} \
  nohup npx astro dev --port $QA_PORT --host 127.0.0.1 > "$QA_OUT/logs/astro.out" 2>&1 &
echo $! > "$QA_OUT/astro.pid"
for i in $(seq 1 90); do sleep 1; curl -s -o /dev/null http://127.0.0.1:$QA_PORT/ && break; done
echo "up on $QA_PORT (square $SQ_PORT, ai $AI_PORT), logs in $QA_OUT/logs"

#!/bin/bash
# Stops what scripts/qa/up.sh started (for this QA_OUT and QA_PORT only).
QA_OUT="${QA_OUT:-/tmp/tracelings-qa}"
for f in astro mocks; do
  if [ -f "$QA_OUT/$f.pid" ]; then
    pid="$(cat "$QA_OUT/$f.pid")"
    pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null
    rm -f "$QA_OUT/$f.pid"
  fi
done
pkill -f "astro.mjs dev --port ${QA_PORT:-4421} " 2>/dev/null
# tsx runs the mocks in a child node process, which outlives its parent: stop whatever holds the mock ports.
pkill -f "[n]ode.* scripts/qa/mocks[.]mts" 2>/dev/null
for p in ${SQ_PORT:-4110} ${AI_PORT:-4111}; do fuser -k $p/tcp 2>/dev/null; done
sleep 1
echo down

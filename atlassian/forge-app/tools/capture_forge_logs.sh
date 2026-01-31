#!/bin/bash
# Deterministic Forge Log Capture Script
# Usage: tools/capture_forge_logs.sh <env> <sinceMinutes> <outDir>

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <env> <sinceMinutes> <outDir>" >&2
  exit 1
fi

ENV="$1"
SINCE="$2"
OUT_DIR="$3"

mkdir -p "$OUT_DIR"

# Capture forge version
forge --version > "$OUT_DIR/forge_version.txt" 2>&1 || { echo "FAILED: forge --version"; exit 1; }

# Capture logs since specified minutes
echo "Capturing forge logs for env=$ENV since ${SINCE}m..." >&2
forge logs -e "$ENV" --since "${SINCE}m" > "$OUT_DIR/forge_logs_since_${SINCE}m.txt" 2>&1 || {
  echo "FAILED: forge logs" >&2
  exit 1
}

# Filter for important markers
FILTER_PATTERN="BE_RESOLVER_|ERROR|Exception|Trace|uiReqId|correlationId|ft_"

if command -v rg >/dev/null 2>&1; then
  rg "$FILTER_PATTERN" "$OUT_DIR/forge_logs_since_${SINCE}m.txt" > "$OUT_DIR/forge_logs_filtered.txt" 2>/dev/null || true
else
  grep -E "$FILTER_PATTERN" "$OUT_DIR/forge_logs_since_${SINCE}m.txt" > "$OUT_DIR/forge_logs_filtered.txt" 2>/dev/null || true
fi

# Success marker
echo "OK" > "$OUT_DIR/forge_logs_capture_ok.txt"

echo "✅ Forge logs captured to $OUT_DIR" >&2

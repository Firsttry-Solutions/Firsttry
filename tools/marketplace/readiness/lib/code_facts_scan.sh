#!/bin/bash
# Code Facts Scanner - Deterministic production code analysis
# Outputs JSON with truth facts about what the code actually does
set -euo pipefail

# Usage: code_facts_scan.sh <output_json_path>
OUTPUT_JSON="${1:-}"

if [ -z "$OUTPUT_JSON" ]; then
  echo "Usage: code_facts_scan.sh <output_json_path>" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
APP_DIR="$REPO_ROOT/atlassian/forge-app"

# Production source paths only
PROD_PATHS=(
  "$APP_DIR/src"
  "$APP_DIR/static"
  "$APP_DIR/resources"
)

# Build find command for production paths only
FIND_PATHS=""
for path in "${PROD_PATHS[@]}"; do
  if [ -d "$path" ]; then
    FIND_PATHS="$FIND_PATHS $path"
  fi
done

if [ -z "$FIND_PATHS" ]; then
  echo "ERROR: No production source paths found" >&2
  exit 1
fi

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Scan for Forge storage API usage
find $FIND_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "(storage\.(get|set|delete|query)|@forge/api.*storage|kvs\.|entity\.)" 2>/dev/null > "$TEMP_DIR/storage.txt" || touch "$TEMP_DIR/storage.txt"

# Scan for console usage
find $FIND_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "console\.(log|warn|error|info|debug)" 2>/dev/null > "$TEMP_DIR/console.txt" || touch "$TEMP_DIR/console.txt"

# Scan for disallowed modules
find $FIND_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "(require\(['\"]child_process['\"]\)|import.*child_process|require\(['\"]fs['\"]\)|import.*['\"]fs['\"]|\\beval\\(|new Function\\(|require\(['\"]vm['\"]\)|import.*['\"]vm['\"]|require\(['\"]net['\"]\)|require\(['\"]tls['\"]\)|require\(['\"]dgram['\"]\))" 2>/dev/null > "$TEMP_DIR/disallowed.txt" || touch "$TEMP_DIR/disallowed.txt"

# Scan for HTTP clients
find $FIND_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "(import.*axios|require\(['\"]axios['\"]\)|import.*node-fetch|require\(['\"]node-fetch['\"]\)|import.*http|require\(['\"]http['\"]\)|import.*https|require\(['\"]https['\"]\))" 2>/dev/null > "$TEMP_DIR/http.txt" || touch "$TEMP_DIR/http.txt"

# Scan for hardcoded URLs
find $FIND_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "https?://[a-zA-Z0-9]" 2>/dev/null > "$TEMP_DIR/urls.txt" || touch "$TEMP_DIR/urls.txt"

# Scan for requestJira calls
find $FIND_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "requestJira|api\.asApp\(\)\.requestJira|api\.asUser\(\)\.requestJira" 2>/dev/null > "$TEMP_DIR/requestjira.txt" || touch "$TEMP_DIR/requestjira.txt"

# Build JSON array of scanned paths (bash -> JSON)
SCANNED_PATHS_JSON="["
FIRST=true
for path in "${PROD_PATHS[@]}"; do
  if [ -d "$path" ]; then
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      SCANNED_PATHS_JSON="$SCANNED_PATHS_JSON,"
    fi
    SCANNED_PATHS_JSON="$SCANNED_PATHS_JSON\"$path\""
  fi
done
SCANNED_PATHS_JSON="$SCANNED_PATHS_JSON]"

# Generate JSON output using Node.js for guaranteed valid JSON
node -e "
const fs = require('fs');

function parseMatches(file) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return [];
  return content.split('\\n').map(line => {
    const match = line.match(/^([^:]+):([0-9]+):(.*)$/);
    if (match) {
      return { file: match[1], line: parseInt(match[2]), match: match[3].trim() };
    }
    return null;
  }).filter(Boolean);
}

const storage = parseMatches('$TEMP_DIR/storage.txt');
const console_calls = parseMatches('$TEMP_DIR/console.txt');
const disallowed = parseMatches('$TEMP_DIR/disallowed.txt');
const http = parseMatches('$TEMP_DIR/http.txt');
const urls = parseMatches('$TEMP_DIR/urls.txt');
const requestjira = parseMatches('$TEMP_DIR/requestjira.txt');

const result = {
  scanned_paths: $SCANNED_PATHS_JSON,
  uses_forge_storage: storage.length > 0,
  storage_calls: storage,
  uses_console: console_calls.length > 0,
  console_calls: console_calls,
  uses_disallowed_modules: disallowed.length > 0,
  disallowed_calls: disallowed,
  uses_http_clients: http.length > 0,
  http_client_calls: http,
  contains_urls: urls,
  requestjira_calls: requestjira
};

fs.writeFileSync('$OUTPUT_JSON', JSON.stringify(result, null, 2));
console.log('Code facts scan complete: ' + '$OUTPUT_JSON');
" || {
  echo '{"error": "Failed to generate JSON"}' > "$OUTPUT_JSON"
  exit 1
}

echo "Code facts written to: $OUTPUT_JSON"

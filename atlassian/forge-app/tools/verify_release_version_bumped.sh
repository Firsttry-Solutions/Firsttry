#!/bin/bash
set -e

# Verify that FT_RELEASE_VERSION has been bumped on this commit vs previous
# Fail-closed: if we cannot verify, we fail.

GATE_NAME="[GATE_RELEASE_VERSION]"
RELEASE_FILE="src/release/release_version.ts"

if [ ! -f "$RELEASE_FILE" ]; then
  echo "$GATE_NAME FAIL: $RELEASE_FILE does not exist"
  exit 1
fi

# Extract current version from the file
CURRENT_VERSION=$(grep -oP '(?<=FT_RELEASE_VERSION = ")[^"]*' "$RELEASE_FILE" || echo "")
if [ -z "$CURRENT_VERSION" ]; then
  echo "$GATE_NAME FAIL: Cannot parse FT_RELEASE_VERSION from $RELEASE_FILE"
  exit 1
fi

echo "$GATE_NAME Current version: $CURRENT_VERSION"

# Try to get previous version from HEAD~1
if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
  # Shallow or first commit; cannot verify bump. Fail-closed.
  echo "$GATE_NAME FAIL: Cannot verify previous version (shallow history or first commit)"
  exit 1
fi

PREVIOUS_VERSION=$(git show HEAD~1:"$RELEASE_FILE" 2>/dev/null | grep -oP '(?<=FT_RELEASE_VERSION = ")[^"]*' || echo "UNSET")
if [ "$PREVIOUS_VERSION" = "UNSET" ]; then
  # File didn't exist before; assume this is first time, allow it
  echo "$GATE_NAME INFO: File not in HEAD~1 (first introduction)"
  echo "$GATE_NAME PASS: Released as $CURRENT_VERSION (first introduction)"
  exit 0
fi

echo "$GATE_NAME Previous version: $PREVIOUS_VERSION"

if [ "$CURRENT_VERSION" = "$PREVIOUS_VERSION" ]; then
  echo "$GATE_NAME FAIL: Version unchanged ($CURRENT_VERSION). Must bump FT_RELEASE_VERSION for each production deploy."
  exit 1
fi

echo "$GATE_NAME PASS: Version bumped from $PREVIOUS_VERSION to $CURRENT_VERSION"
exit 0

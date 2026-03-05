#!/bin/bash
set -euo pipefail

# Documentation Overclaim Auditor
# Scans all documentation for unverifiable claims, certifications, and guarantees
# Fail-closed: Any match causes FAIL verdict

EVIDENCE_DIR="${1:-}"
if [ -z "$EVIDENCE_DIR" ] || [ ! -d "$EVIDENCE_DIR" ]; then
  echo "[FATAL] Usage: $0 <EVIDENCE_DIR>" >&2
  echo "[FATAL] EVIDENCE_DIR must exist" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ALLOWLIST="$SCRIPT_DIR/OVERCLAIM_ALLOWLIST.txt"

# Create evidence subdirectory
DOCS_EVID="$EVIDENCE_DIR/docs_overclaim"
mkdir -p "$DOCS_EVID"

SCAN_TARGETS="$DOCS_EVID/scan_targets.txt"
FINDINGS="$DOCS_EVID/findings.txt"
VERDICT="$DOCS_EVID/verdict.txt"

echo "[INFO] Documentation Overclaim Audit"
echo "[INFO] Repository: $REPO_ROOT"
echo "[INFO] Evidence: $DOCS_EVID"

cd "$REPO_ROOT"

# Find all markdown files, excluding node_modules, dist, .git, /tmp, build artifacts
echo "[INFO] Scanning for documentation files..."
find . \
  -type f \
  -name "*.md" \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/.git/*" \
  ! -path "*/tmp/*" \
  ! -path "*/build/*" \
  ! -path "*/.venv/*" \
  ! -path "*/coverage/*" \
  | sort > "$SCAN_TARGETS"

NUM_FILES=$(wc -l < "$SCAN_TARGETS")
echo "[INFO] Found $NUM_FILES markdown files to scan"

if [ "$NUM_FILES" -eq 0 ]; then
  echo "[WARN] No markdown files found"
  echo "PASS" > "$VERDICT"
  echo "No markdown files found" >> "$VERDICT"
  exit 0
fi

# Initialize findings file
> "$FINDINGS"

# Define overclaim patterns
# 1) Certifications / compliance overclaims
CERT_PATTERNS=(
  "SOC 2 certified"
  "SOC2 certified"
  "SOC 2 Type II certified"
  "SOC2 Type II certified"
  "ISO 27001 certified"
  "ISO27001 certified"
  "HIPAA compliant"
  "HIPAA certified"
  "GDPR compliant"
  "GDPR certified"
  "PCI compliant"
  "PCI certified"
  "PCI DSS compliant"
  "FedRAMP"
  "CMMC"
  "NIST 800-53 certified"
  "NIST certified"
)

# 2) Guarantees / absolutes
GUARANTEE_PATTERNS=(
  "guarantee"
  "guaranteed"
  "100%"
  "zero risk"
  "cannot be bypassed"
  "unhackable"
  "perfect security"
  "perfect"
  "always secure"
  "never fails"
  "impossible to"
)

#3) Data handling absolutes (but allow CLAIM_... lines)
DATA_PATTERNS=(
  "no data collected"
  "collects no data"
  "we do not store any data"
  "stores nothing"
  "no storage"
  "zero storage"
  "we never collect"
)

# 4) External validation claims
VALIDATION_PATTERNS=(
  "externally validated"
  "third-party validated"
  "audited by"
  "certified by"
)

echo "[INFO] Scanning for overclaims..."

# Build combined regex pattern for all overclaims
# This is much faster than scanning for each pattern separately
COMBINED_PATTERN=""
for p in "${CERT_PATTERNS[@]}"; do
  [ -n "$COMBINED_PATTERN" ] && COMBINED_PATTERN="${COMBINED_PATTERN}|"
  COMBINED_PATTERN="${COMBINED_PATTERN}${p}"
done
for p in "${GUARANTEE_PATTERNS[@]}"; do
  COMBINED_PATTERN="${COMBINED_PATTERN}|${p}"
done
for p in "${DATA_PATTERNS[@]}"; do
  COMBINED_PATTERN="${COMBINED_PATTERN}|${p}"
done
for p in "${VALIDATION_PATTERNS[@]}"; do
  COMBINED_PATTERN="${COMBINED_PATTERN}|${p}"
done

# Scan all files once with combined pattern
while IFS= read -r file; do
  grep -niE "$COMBINED_PATTERN" "$file" 2>/dev/null || true | while IFS=: read -r fname linenum match; do
    # Skip CLAIM_ prefixed lines (structured claims, allowed)
    if echo "$match" | grep -q "^[[:space:]]*CLAIM_"; then
      continue
    fi
    
    # Skip negated validation overclaims (e.g., "NOT audited by")
    if echo "$match" | grep -qiE "(not|NOT|never|un-|no longer).*(audited by|certified by|validated)"; then
      continue
    fi
    
    # Check allowlist
    SKIP=0
    if [ -f "$ALLOWLIST" ]; then
      while IFS= read -r allow_pattern; do
        [[ -z "$allow_pattern" || "$allow_pattern" =~ ^# ]] && continue
        if echo "$match" | grep -qE "$allow_pattern"; then
          SKIP=1
          break
        fi
      done < "$ALLOWLIST"
    fi
    
    if [ "$SKIP" -eq 1 ]; then
      continue
    fi
    
    # Determine category by pattern matching
    CATEGORY="UNKNOWN"
    for p in "${CERT_PATTERNS[@]}"; do
      if echo "$match" | grep -qiF "$p"; then
        CATEGORY="CERTIFICATION_OVERCLAIM"
        break
      fi
    done
    
    if [ "$CATEGORY" = "UNKNOWN" ]; then
      for p in "${GUARANTEE_PATTERNS[@]}"; do
        if echo "$match" | grep -qiF "$p"; then
          CATEGORY="GUARANTEE_OVERCLAIM"
          break
        fi
      done
    fi
    
    if [ "$CATEGORY" = "UNKNOWN" ]; then
      for p in "${DATA_PATTERNS[@]}"; do
        if echo "$match" | grep -qiF "$p"; then
          CATEGORY="DATA_HANDLING_OVERCLAIM"
          break
        fi
      done
    fi
    
    if [ "$CATEGORY" = "UNKNOWN" ]; then
      for p in "${VALIDATION_PATTERNS[@]}"; do
        if echo "$match" | grep -qiF "$p"; then
          CATEGORY="EXTERNAL_VALIDATION_OVERCLAIM"
          break
        fi
      done
    fi
    
    # Get context
    CONTEXT_START=$((linenum - 2))
    CONTEXT_END=$((linenum + 2))
    [ "$CONTEXT_START" -lt 1 ] && CONTEXT_START=1
    
    echo "=== OVERCLAIM DETECTED ===" >> "$FINDINGS"
    echo "Category: $CATEGORY" >> "$FINDINGS"
    echo "File: $fname" >> "$FINDINGS"
    echo "Line: $linenum" >> "$FINDINGS"
    echo "Context:" >> "$FINDINGS"
    sed -n "${CONTEXT_START},${CONTEXT_END}p" "$fname" | sed "s/^/  /" >> "$FINDINGS"
    echo "" >> "$FINDINGS"
  done
done < "$SCAN_TARGETS"

# Check findings
NUM_FINDINGS=$(grep -c "^=== OVERCLAIM DETECTED ===" "$FINDINGS" 2>/dev/null || true)
# grep -c outputs 0 when no matches (we don't need || echo "0")
[ -z "$NUM_FINDINGS" ] && NUM_FINDINGS=0

if [ "$NUM_FINDINGS" -eq 0 ]; then
  echo "[OK] No overclaims detected in $NUM_FILES files"
  echo "PASS" > "$VERDICT"
  echo "Scanned: $NUM_FILES files" >> "$VERDICT"
  echo "Findings: 0" >> "$VERDICT"
  echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$VERDICT"
  exit 0
else
  echo "[FAIL] Detected $NUM_FINDINGS overclaim(s) in documentation" >&2
  echo "[FAIL] Review: $FINDINGS" >&2
  echo "FAIL" > "$VERDICT"
  echo "Scanned: $NUM_FILES files" >> "$VERDICT"
  echo "Findings: $NUM_FINDINGS" >> "$VERDICT"
  echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$VERDICT"
  echo "" >> "$VERDICT"
  echo "Review findings in: $FINDINGS" >> "$VERDICT"
  exit 1
fi

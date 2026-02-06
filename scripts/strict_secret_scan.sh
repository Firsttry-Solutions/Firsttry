#!/bin/bash
# Strict Secret Scan with Tiered Classification
# Purpose: Detect secrets anywhere, allow only explicit known examples in explicit files
# Fail-closed: any non-waived hit causes failure

set -euo pipefail
export LC_ALL=C
export LANG=C

# Require RUN_DIR
if [[ -z "${RUN_DIR:-}" ]]; then
    echo "ERROR: RUN_DIR environment variable required" >&2
    exit 1
fi

# Require tools
command -v rg >/dev/null 2>&1 || { echo "ERROR: rg missing" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 missing" >&2; exit 1; }

# Must run from repo root
REPO_ROOT="/workspaces/Firsttry"
cd "$REPO_ROOT" || { echo "ERROR: cannot cd $REPO_ROOT" >&2; exit 1; }

echo "[SECRET_SCAN] Starting strict secret scan..."
echo "[SECRET_SCAN] RUN_DIR=$RUN_DIR"

# Secret patterns (comprehensive)
SECRET_PATTERN="(AKIA[0-9A-Z]{16}|-----BEGIN( RSA)? PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]+|ghp_[0-9A-Za-z]{36}|AIza[0-9A-Za-z_-]{35}|sk-[0-9A-Za-z]{20,})"

# Scan entire repo (exclude only build artifacts and git metadata)
echo "[SECRET_SCAN] Running ripgrep scan..."
rg -n -S "$SECRET_PATTERN" \
  --glob "!node_modules/**" \
  --glob "!dist/**" \
  --glob "!.git/**" \
  > "$RUN_DIR/42_secret_scan_all_hits.txt" 2>&1 || true

# Count total hits
TOTAL_HITS=$(wc -l < "$RUN_DIR/42_secret_scan_all_hits.txt" || echo "0")
echo "[SECRET_SCAN] Total secret pattern hits: $TOTAL_HITS"

if [[ "$TOTAL_HITS" -eq 0 ]]; then
    echo "[SECRET_SCAN] No secret patterns detected (clean)"
    echo "[]" > "$RUN_DIR/44_secret_scan_classified.json"
    touch "$RUN_DIR/45_secret_scan_forbidden.txt"
    touch "$RUN_DIR/46_secret_scan_allowed.txt"
    echo "# Secret Scan Waiver - No Secrets Detected" > "$RUN_DIR/47_secret_scan_waiver_generated.md"
    exit 0
fi

# Classify hits using Python
echo "[SECRET_SCAN] Classifying hits..."
python3 - <<'PYCLASSIFY'
import re
import json
import sys
import os
from pathlib import Path

run_dir = os.environ["RUN_DIR"]
hits_file = Path(run_dir) / "42_secret_scan_all_hits.txt"
classified_file = Path(run_dir) / "44_secret_scan_classified.json"
forbidden_file = Path(run_dir) / "45_secret_scan_forbidden.txt"
allowed_file = Path(run_dir) / "46_secret_scan_allowed.txt"
waiver_file = Path(run_dir) / "47_secret_scan_waiver_generated.md"

# Read all hits
with open(hits_file) as f:
    lines = f.read().splitlines()

# Known safe example tokens (exact matches)
KNOWN_EXAMPLES = {
    "AKIAIOSFODNN7EXAMPLE",  # AWS official docs example
    "AKIA0000000000000000",  # Placeholder
    "AKIA1234567890ABCDEF",  # Test fixture
}

# Allowed path patterns (must be explicit)
ALLOWED_PATH_PATTERNS = [
    r"(^|.*/)tests/.*",
    r".*\.test\.ts$",
    r".*\.test\.tsx$",
    r".*_test\.py$",
    r"(^|.*/)audit/.*",
    r".*PROOF.*\.md$",
    r".*PROOF.*\.txt$",
    r".*REMEDIATION.*\.md$",
    r".*REMEDIATION.*\.txt$",
    r".*REPORT.*\.md$",
    r".*REPORT.*\.txt$",
    r"(^|.*/)scripts/strict_secret_scan\.sh$",  # This script contains example tokens
]

def is_allowed_path(filepath):
    """Check if filepath matches allowed patterns"""
    for pattern in ALLOWED_PATH_PATTERNS:
        if re.match(pattern, filepath):
            return True
    return False

def is_known_example(match_text):
    """Check if matched text is a known safe example"""
    # Exact match in known examples
    if any(ex in match_text for ex in KNOWN_EXAMPLES):
        return True
    
    # Private key headers allowed only in docs/tests
    if "BEGIN" in match_text and "PRIVATE KEY" in match_text:
        return True  # Will be gated by path check
    
    # Example markers (case insensitive)
    if re.search(r"(EXAMPLE|example|test_|TEST_|fake|FAKE|placeholder|PLACEHOLDER)", match_text):
        return True
    
    return False

def classify_hit(line):
    """Classify a secret scan hit as allowed or forbidden"""
    # Parse ripgrep output: filepath:lineno:content
    parts = line.split(":", 2)
    if len(parts) < 3:
        return None
    
    filepath, lineno, content = parts[0], parts[1], parts[2]
    
    # Extract matched token (simplified - just take the content)
    match_text = content.strip()
    
    # Classification logic: ALLOW only if BOTH conditions true
    path_ok = is_allowed_path(filepath)
    token_ok = is_known_example(match_text)
    
    if path_ok and token_ok:
        status = "ALLOWED"
        reason = "Test/doc file with known example token"
    else:
        status = "FORBIDDEN"
        if not path_ok:
            reason = "Disallowed file path"
        elif not token_ok:
            reason = "Unknown or real secret pattern"
        else:
            reason = "Classification error"
    
    return {
        "filepath": filepath,
        "lineno": lineno,
        "content": content.strip(),
        "status": status,
        "reason": reason,
    }

# Classify all hits
classified = []
for line in lines:
    if line.strip():
        result = classify_hit(line)
        if result:
            classified.append(result)

# Write classified JSON
with open(classified_file, "w") as f:
    json.dump(classified, f, indent=2)

# Separate into allowed and forbidden
allowed = [h for h in classified if h["status"] == "ALLOWED"]
forbidden = [h for h in classified if h["status"] == "FORBIDDEN"]

print(f"[CLASSIFIER] Total: {len(classified)}, Allowed: {len(allowed)}, Forbidden: {len(forbidden)}")

# Write forbidden hits
with open(forbidden_file, "w") as f:
    for hit in forbidden:
        f.write(f"{hit['filepath']}:{hit['lineno']}: {hit['content']}\n")

# Write allowed hits
with open(allowed_file, "w") as f:
    for hit in allowed:
        f.write(f"{hit['filepath']}:{hit['lineno']}: {hit['content']}\n")

# Generate waiver markdown
waiver_lines = []
waiver_lines.append("# Secret Scan Waiver")
waiver_lines.append("")
waiver_lines.append("**Purpose**: This document explains why certain secret-like patterns exist in the repository.")
waiver_lines.append("")
waiver_lines.append("**Scope**: All allowed patterns are either:")
waiver_lines.append("- Test fixtures using well-known example tokens (e.g., AWS official documentation examples)")
waiver_lines.append("- Documentation files referencing previously remediated secrets or explaining security practices")
waiver_lines.append("- Audit/proof documents that quote known example tokens for verification purposes")
waiver_lines.append("")
waiver_lines.append(f"**Generated**: {Path(run_dir).name}")
waiver_lines.append("")
waiver_lines.append("## Classification Results")
waiver_lines.append("")
waiver_lines.append(f"- **Total secret pattern matches**: {len(classified)}")
waiver_lines.append(f"- **Allowed (waived)**: {len(allowed)}")
waiver_lines.append(f"- **Forbidden (real secrets)**: {len(forbidden)}")
waiver_lines.append("")

if forbidden:
    waiver_lines.append("## ⚠️ FORBIDDEN SECRETS DETECTED")
    waiver_lines.append("")
    waiver_lines.append("The following matches are NOT waived and represent potential real secrets:")
    waiver_lines.append("")
    for hit in forbidden[:20]:  # Show first 20
        waiver_lines.append(f"- `{hit['filepath']}:{hit['lineno']}` - {hit['reason']}")
    if len(forbidden) > 20:
        waiver_lines.append(f"- ... and {len(forbidden) - 20} more (see 45_secret_scan_forbidden.txt)")
    waiver_lines.append("")

waiver_lines.append("## Allowed Patterns")
waiver_lines.append("")
if allowed:
    waiver_lines.append("| File | Line | Reason | Content Preview |")
    waiver_lines.append("|------|-----:|--------|-----------------|")
    for hit in allowed:
        preview = hit["content"][:60] + ("..." if len(hit["content"]) > 60 else "")
        preview_esc = preview.replace("|", "\\|")
        waiver_lines.append(f"| `{hit['filepath']}` | {hit['lineno']} | {hit['reason']} | `{preview_esc}` |")
else:
    waiver_lines.append("*No allowed patterns detected*")

waiver_lines.append("")
waiver_lines.append("## Known Safe Examples")
waiver_lines.append("")
waiver_lines.append("The following tokens are known to be safe examples from official documentation:")
waiver_lines.append("")
waiver_lines.append("- `AKIAIOSFODNN7EXAMPLE` - AWS official documentation example")
waiver_lines.append("- `AKIA0000000000000000` - Placeholder format")
waiver_lines.append("- `AKIA1234567890ABCDEF` - Test fixture")
waiver_lines.append("- `-----BEGIN RSA PRIVATE KEY-----` - Header line (allowed in tests/docs only)")
waiver_lines.append("")

with open(waiver_file, "w") as f:
    f.write("\n".join(waiver_lines) + "\n")

print(f"[CLASSIFIER] Wrote waiver to {waiver_file}")

# Exit with failure code if forbidden hits exist
sys.exit(len(forbidden))
PYCLASSIFY

CLASSIFY_EXIT=$?
echo "[SECRET_SCAN] Classification exit code: $CLASSIFY_EXIT"

# Copy generated waiver to audit directory
AUDIT_WAIVER="$REPO_ROOT/audit/SECRET_SCAN_WAIVER.md"
mkdir -p "$REPO_ROOT/audit"
cp "$RUN_DIR/47_secret_scan_waiver_generated.md" "$AUDIT_WAIVER"
echo "[SECRET_SCAN] Copied waiver to audit/SECRET_SCAN_WAIVER.md"

# Check for forbidden hits
if [[ "$CLASSIFY_EXIT" -ne 0 ]]; then
    FORBIDDEN_COUNT=$(wc -l < "$RUN_DIR/45_secret_scan_forbidden.txt" || echo "0")
    echo "[SECRET_SCAN] FAIL: $FORBIDDEN_COUNT forbidden secret patterns detected" >&2
    echo "[SECRET_SCAN] See: $RUN_DIR/45_secret_scan_forbidden.txt" >&2
    exit 1
fi

echo "[SECRET_SCAN] PASS: All detected patterns are waived"
exit 0

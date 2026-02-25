#!/bin/bash
# verify_no_outbound_runtime.sh - Fail-closed gate
# Purpose: Ensure runtime code (src/*.ts, excluding tests) has no HTTP client calls
# Proof Integrity: Generates ALL required evidence files internally (no external dependencies)

set -euo pipefail

# ==============================================================================
# Determine E directory - Deterministic
# ==============================================================================
if [[ -n "${FT_PROD_READY_E:-}" ]]; then
  E="$FT_PROD_READY_E"
elif [[ -f /tmp/ft_prod_ready_dir.txt ]]; then
  E=$(cat /tmp/ft_prod_ready_dir.txt)
else
  echo "[GATE_OUTBOUND] FAIL: E directory not set. Set FT_PROD_READY_E or create /tmp/ft_prod_ready_dir.txt"
  exit 1
fi

if [[ ! -d "$E" ]]; then
  echo "[GATE_OUTBOUND] FAIL: E directory does not exist: $E"
  exit 1
fi

# Ensure 13_repo_scans directory exists
mkdir -p "$E/13_repo_scans"

# ==============================================================================
# Verify rg is available (fail-closed)
# ==============================================================================
if ! command -v rg &> /dev/null; then
  echo "[GATE_OUTBOUND] FAIL: rg (ripgrep) not found in PATH"
  echo "[GATE_OUTBOUND] Install with: apt install ripgrep or brew install ripgrep"
  exit 1
fi

# ==============================================================================
# Generate evidence files internally (deterministic, no external dependencies)
# ==============================================================================
echo "[GATE_OUTBOUND] Scanning for outbound patterns (generating evidence files)..."

# Generate ALL outbound patterns (all dirs)
rg -n "axios|node-fetch|fetch\(|https?://" . 2>/dev/null | grep -v node_modules/ > "$E/13_repo_scans/rg_outbound_all.txt"

# Generate src-only patterns (runtime code only)
rg -n "axios|node-fetch|fetch\(|https?://" src/ 2>/dev/null | grep -v node_modules/ > "$E/13_repo_scans/rg_outbound_src_only.txt"

echo "[GATE_OUTBOUND] Evidence files generated:"
echo "  - $E/13_repo_scans/rg_outbound_all.txt" 
echo "  - $E/13_repo_scans/rg_outbound_src_only.txt"

# ==============================================================================
# Analyze patterns with Python - Filter false positives
# ==============================================================================
echo "[GATE_OUTBOUND] Analyzing patterns (filtering false positives)..."

python3 << 'PYEOF'
import re
import sys
import os
from pathlib import Path

# Get E from environment (must be set by caller)
E = os.environ.get("FT_PROD_READY_E", "")
if not E:
    print("[GATE_OUTBOUND] FAIL: FT_PROD_READY_E not set in environment")
    sys.exit(1)

scan_file = Path(E) / "13_repo_scans/rg_outbound_src_only.txt"
if not scan_file.exists():
    print(f"[GATE_OUTBOUND] ERROR: Evidence file not found: {scan_file}")
    sys.exit(1)

lines = scan_file.read_text(errors="ignore").splitlines()

forbidden_patterns = []

for line in lines:
    # Skip package-lock.json (metadata)
    if "package-lock.json" in line:
        continue
    
    # Skip .test.ts files (test code)
    if ".test.ts:" in line:
        continue
    
    # Parse: filename:line:content
    parts = line.split(":", 2)
    if len(parts) < 3:
        continue
    
    filename = parts[0]
    line_content = parts[2] if len(parts) > 2 else ""
    
    # Skip comments (// or /* */)
    if "//" in line_content and line_content.strip().startswith("//"):
        continue
    
    # Skip CSS files and comments mentioning URLs
    if filename.endswith(".css"):
        continue
    
    # Skip console.log and comment patterns
    if any(x in line_content for x in ["// ", "* ", "/* ", " *", "Fix for:"]):
        continue
    
    # Now check for actual CALLS (not just string references)
    # Forbidden: fetch(...), axios(...), new Request(...), etc.
    if re.search(r'\bfetch\s*\(', line_content, re.IGNORECASE):
        # BUT allow: fetch(window.location... or fetch(/path or fetch('.' or fetch('/' (relative)
        if not re.search(r'fetch\s*\(\s*(?:window\.location|[\'\"]/|\.)', line_content, re.IGNORECASE):
            forbidden_patterns.append(line)
    
    # axios.* calls (any method)
    if re.search(r'\baxios\s*\.(?:get|post|put|delete|patch|request)\s*\(', line_content, re.IGNORECASE):
        forbidden_patterns.append(line)
    
    # node-fetch or new Request with external URL
    if "node-fetch" in line_content:
        forbidden_patterns.append(line)
    if "new Request" in line_content and re.search(r'https?://', line_content):
        forbidden_patterns.append(line)

# Output classification to evidence files
(Path(E) / "13_repo_scans/outbound_forbidden_patterns.txt").write_text("\n".join(forbidden_patterns) + "\n")
(Path(E) / "13_repo_scans/outbound_forbidden_count.txt").write_text(str(len(forbidden_patterns)) + "\n")

# Exit with appropriate code
if forbidden_patterns:
    print(f"[GATE_OUTBOUND] FAIL: {len(forbidden_patterns)} forbidden patterns found:")
    for p in forbidden_patterns[:20]:
        print(f"  {p}")
    if len(forbidden_patterns) > 20:
        print(f"  ... and {len(forbidden_patterns)-20} more")
    sys.exit(1)
else:
    print("[GATE_OUTBOUND] PASS: No forbidden outbound patterns found")
    sys.exit(0)
PYEOF

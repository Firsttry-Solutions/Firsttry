#!/usr/bin/env python3
"""
Fail-closed validator: forbid specific unsafe tenant-isolation phrases in tracked files.

Why:
- Prevent regression of unproven claims (e.g., "TENANT ISOLATION VERIFIED").
- Enforce conservative, procurement-safe language.

Scope:
- Only scans git-tracked files (no false positives from build artifacts).
- Excludes historical evidence logs by default (optional override).

Exit codes:
- 0: PASS (no forbidden phrases found)
- 1: FAIL (forbidden phrases found OR an error occurs)
"""
import os
import re
import subprocess
import sys
from typing import List, Tuple

FORBID = [
    r"TENANT ISOLATION VERIFIED",
    r"tenant isolation verified",
    r"No cross-tenant access possible",
    r"tenant partitioning verified",
]

# Paths we intentionally do NOT police because they are historical logs.
DEFAULT_EXCLUDE_PREFIXES = [
    "docs/evidence/20260113T131842Z_6ca63141/",  # legacy captured output pack
]

def run(cmd: List[str]) -> Tuple[int, str, str]:
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr

def main() -> int:
    allow_legacy = os.environ.get("ALLOW_LEGACY_EVIDENCE_PHRASES", "").strip().lower() in {"1", "true", "yes"}

    rc, out, err = run(["git", "ls-files"])
    if rc != 0:
        print("FAIL: unable to enumerate tracked files via git ls-files", file=sys.stderr)
        print(err.strip(), file=sys.stderr)
        return 1

    files = [line.strip() for line in out.splitlines() if line.strip()]
    if not files:
        print("FAIL: no tracked files returned by git ls-files", file=sys.stderr)
        return 1

    forbid_re = re.compile("|".join(f"(?:{p})" for p in FORBID), flags=re.IGNORECASE)

    hits = []
    for f in files:
        # Skip empty or malformed filenames
        if not f or f.startswith('"') or f.startswith("'"):
            continue
        if not allow_legacy:
            if any(f.startswith(pref) for pref in DEFAULT_EXCLUDE_PREFIXES):
                continue
        try:
            # Read as text-ish; ignore decode errors.
            with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                for i, line in enumerate(fp, start=1):
                    if forbid_re.search(line):
                        hits.append((f, i, line.rstrip("\n")[:240]))
        except Exception as e:
            print(f"FAIL: error reading {f}: {e}", file=sys.stderr)
            return 1

    if hits:
        print("FAIL: forbidden phrases detected in tracked files:")
        for f, i, line in hits:
            print(f"  - {f}:{i}: {line}")
        print("\nRemediation:")
        print("  Replace with conservative language, e.g.:")
        print("    - 'Tenant isolation guard passed (code-level static checks)'")
        print("    - 'Static checks found no obvious cross-tenant risk patterns'")
        return 1

    print("PASS: no forbidden tenant-isolation phrases found in tracked files.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

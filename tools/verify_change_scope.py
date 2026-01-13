#!/usr/bin/env python3
"""
verify_change_scope.py — fail-closed change scope guard.

Usage:
  python3 tools/verify_change_scope.py --allowed path1 --allowed path2 ...

Default behavior:
  - Checks current working-tree changes (git diff --name-only)
  - If any changed file is not in allowlist => exit 1

Notes:
  - This is deterministic and intentionally strict.
  - It does not attempt to interpret git status beyond name-only diffs.
"""

import argparse
import subprocess
import sys

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"ERROR: command failed: {' '.join(cmd)}", file=sys.stderr)
        print(p.stderr, file=sys.stderr)
        sys.exit(1)
    return p.stdout.strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--allowed", action="append", default=[], help="Allowed changed file path (repeatable)")
    args = ap.parse_args()

    if not args.allowed:
        print("ERROR: No --allowed paths provided. Refusing to run.", file=sys.stderr)
        sys.exit(1)

    allowed = set(args.allowed)
    changed = [x for x in run(["git","diff","--name-only"]).splitlines() if x.strip()]

    unexpected = [f for f in changed if f not in allowed]

    print("=== SCOPE CHECK ===")
    print("Allowed:")
    for f in sorted(allowed):
        print(f"  - {f}")
    print("Changed:")
    for f in changed:
        print(f"  - {f}")

    if unexpected:
        print("❌ FAIL: Unexpected changed files:", file=sys.stderr)
        for f in unexpected:
            print(f"  - {f}", file=sys.stderr)
        sys.exit(1)

    print("✅ PASS: change scope within allowlist")
    sys.exit(0)

if __name__ == "__main__":
    main()

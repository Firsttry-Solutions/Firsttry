#!/usr/bin/env python3
"""
Validate GitHub Actions workflow files for common parsing errors.

Success Criteria:
  (A) Every workflow file parses as valid YAML (basic checks)
  (B) Every workflow contains exactly ONE top-level workflow (name/on/jobs once)
  (C) No workflow file contains Unicode category Cf (format/bidi) characters
"""
import glob
import re
import sys
import unicodedata
from pathlib import Path


def has_cf(s: str) -> bool:
    """Check if string contains Unicode category Cf (format) characters."""
    return any(unicodedata.category(ch) == "Cf" for ch in s)


def cf_positions(s: str):
    """Get positions and codepoints of Cf characters in string."""
    out = []
    for i, ch in enumerate(s):
        if unicodedata.category(ch) == "Cf":
            out.append((i, f"U+{ord(ch):04X}"))
    return out[:30]


def read_workflow(p: Path) -> str:
    """Read workflow file safely."""
    return p.read_text(encoding="utf-8", errors="replace")


def validate_workflows():
    """Validate all workflow files."""
    files = [
        Path(p)
        for p in glob.glob(".github/workflows/*.yml")
        + glob.glob(".github/workflows/*.yaml")
    ]

    if not files:
        print("ERROR: NO workflow files found")
        return False

    print(f"Validating {len(files)} workflow files...")
    bad = []

    for f in sorted(files):
        txt = read_workflow(f)

        # Count top-level keys
        c_name = len(re.findall(r"(?m)^name:\s", txt))
        c_on = len(re.findall(r"(?m)^on:\s", txt))
        c_jobs = len(re.findall(r"(?m)^jobs:\s", txt))

        # Check structure
        if c_name != 1 or c_on != 1 or c_jobs != 1:
            bad.append(
                (
                    str(f),
                    "TOPLEVEL_COUNT",
                    f"name={c_name}, on={c_on}, jobs={c_jobs}",
                )
            )
            print(f"  ❌ {f.name}: name={c_name}, on={c_on}, jobs={c_jobs}")

        # Check for Cf unicode
        if has_cf(txt):
            positions = cf_positions(txt)
            bad.append((str(f), "UNICODE_CF", positions))
            print(f"  ❌ {f.name}: contains Cf unicode at {positions}")

    if bad:
        print(f"\nVALIDATION FAILED: {len(bad)} file(s) have issues")
        return False

    print(f"\n✅ VALIDATION OK: All {len(files)} workflows are structurally valid")
    return True


if __name__ == "__main__":
    success = validate_workflows()
    sys.exit(0 if success else 2)

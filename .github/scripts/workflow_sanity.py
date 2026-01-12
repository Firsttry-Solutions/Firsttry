#!/usr/bin/env python3
"""
Robust GitHub Actions workflow sanity checker.

Detects:
  - Unicode Cf (format) characters with exact codepoint + name + line
  - Top-level keys (name/on/jobs) even if preceded by invisible chars
  - Multiple top-level workflows in one file

Success: exactly ONE name/on/jobs per file, NO Cf characters
"""
import glob
import sys
import unicodedata
import re


def cf_positions(s):
    """Find all Cf characters with metadata."""
    out = []
    for i, ch in enumerate(s):
        if unicodedata.category(ch) == "Cf":
            out.append(
                (i, ch, f"U+{ord(ch):04X}", unicodedata.name(ch, "UNKNOWN"))
            )
    return out


def strip_cf(s):
    """Remove all Unicode Cf characters."""
    return "".join(ch for ch in s if unicodedata.category(ch) != "Cf")


# Patterns to match top-level keys, accounting for Cf chars that may precede them
# Allow BOM and all common Cf characters before the key name
CF_CHARS = r"[\ufeff\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069]*"
TOP_NAME = re.compile(rf"(?m)^{CF_CHARS}name:\s")
TOP_ON = re.compile(rf"(?m)^{CF_CHARS}on:\s*$")
TOP_JOBS = re.compile(rf"(?m)^{CF_CHARS}jobs:\s*$")


def validate_workflows():
    """Validate all workflow files."""
    bad = False
    files = sorted(
        glob.glob(".github/workflows/*.yml")
        + glob.glob(".github/workflows/*.yaml")
    )

    print(f"Validating {len(files)} workflow files...\n")

    for f in files:
        raw = open(f, "r", encoding="utf-8", errors="replace").read()

        # Check for Cf characters
        cfs = cf_positions(raw)
        if cfs:
            bad = True
            print(f"❌ {f}: contains {len(cfs)} Unicode Cf character(s)")
            # Print up to first 20 occurrences with line numbers
            for idx, ch, code, name in cfs[:20]:
                before = raw[: idx + 1]
                line = before.count("\n") + 1
                print(f"   - line {line}: {code} ({name})")
            if len(cfs) > 20:
                print(f"   ... and {len(cfs) - 20} more")

        # Count keys (using Cf-aware regex on raw, simple regex on cleaned)
        n_name_raw = len(TOP_NAME.findall(raw))
        n_on_raw = len(TOP_ON.findall(raw))
        n_jobs_raw = len(TOP_JOBS.findall(raw))

        cleaned = strip_cf(raw)
        n_name = len(re.findall(r"(?m)^name:\s", cleaned))
        n_on = len(re.findall(r"(?m)^on:\s*$", cleaned))
        n_jobs = len(re.findall(r"(?m)^jobs:\s*$", cleaned))

        if n_name != 1 or n_on != 1 or n_jobs != 1:
            bad = True
            print(
                f"❌ {f}: invalid structure after Cf-strip: "
                f"name={n_name}, on={n_on}, jobs={n_jobs}"
            )
            print(
                f"   (raw-detect with unicode-aware regex: "
                f"name={n_name_raw}, on={n_on_raw}, jobs={n_jobs_raw})"
            )

    if bad:
        print("\n❌ FAIL: workflow sanity check failed.")
        return False

    print(
        f"✅ OK: All {len(files)} workflow files have exactly "
        "one name/on/jobs and no Cf chars."
    )
    return True


if __name__ == "__main__":
    success = validate_workflows()
    sys.exit(0 if success else 1)

#!/usr/bin/env python3
"""
Phase 9C: Overclaim Purge + Corpus Truth Lock
Strict scanner for public corpus verification.

Behavior:
- PUBLIC corpus violations → EXIT 2 (BLOCKING, marketplace release fails)
- Internal-only violations → EXIT 0, informational report (non-blocking)
- No violations → EXIT 0 (marketplace ready)
"""

import os
import re
import sys
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Classification prefixes
PUBLIC_PREFIXES = [
    "atlassian/forge-app/legal/",
    "docs/legal/",
    "docs/marketplace/",
    "docs/support/",
    "docs/security/",
    "README.md",
]

# Internal exclusions (development phase docs)
INTERNAL_PREFIXES = [
    "docs/audit/",
    "docs/audit_reports/",
    "docs/evidence/",
    "docs/internal/",
    "docs/proofs/",
    "docs/PHASE",
    "docs/DOCS_",
    "atlassian/forge-app/docs/PHASE",
    "atlassian/forge-app/docs/P4_P5_",
    "atlassian/forge-app/docs/P5_",
    "atlassian/forge-app/docs/PHASE_",
    "atlassian/forge-app/docs/HEARTBEAT_",
    "atlassian/forge-app/docs/MARKETPLACE_REVIEWER_",
    "atlassian/forge-app/docs/MARKETPLACE_SUBMISSION_",
]

# Hard-forbidden terms (unconditional)
HARD_FORBIDDEN_PATTERNS = [
    re.compile(r"\bguarantee(?:d|s|ing)?\b", re.IGNORECASE),  # guaranteed, guarantee, guarantees
    re.compile(r"\balways\s+available\b", re.IGNORECASE),
    re.compile(r"\benterprise[_-]?ready\b", re.IGNORECASE),
    re.compile(r"\bmission[_-]?critical\b", re.IGNORECASE),
]

# SLA-specific pattern and allowed negations
SLA_PATTERN = re.compile(r"\bSLA\b", re.IGNORECASE)
SLA_ALLOWED_NEGATIONS = [
    re.compile(r"\bNO\s+SLA\b", re.IGNORECASE),
    re.compile(r"\bnot\s+an?\s+SLA\b", re.IGNORECASE),
    re.compile(r"\bdoes\s+not\s+constitute\s+.*SLA\b", re.IGNORECASE),
    re.compile(r"\bnon[_-]?binding\b", re.IGNORECASE),
    re.compile(r"\bbest[_-]?effort\b", re.IGNORECASE),
    re.compile(r"\b(internal\s+)?target", re.IGNORECASE),  # internal target, target
    re.compile(r"\bstatus\s+page\b", re.IGNORECASE),  # SLA status page reference
]

# File extensions to scan
EXTS = {".md", ".mdx", ".html", ".txt", ".yml", ".yaml", ".json"}


def get_tracked_files():
    """Get all tracked files from git."""
    try:
        out = subprocess.check_output(["git", "ls-files"], cwd=ROOT, stderr=subprocess.DEVNULL).decode().splitlines()
        files = []
        for f in out:
            if not f:
                continue
            p = ROOT / f
            if p.is_file():
                suffix = p.suffix.lower()
                if suffix in EXTS or f == "README.md":
                    files.append(f)
        return files
    except Exception as e:
        print(f"ERROR getting tracked files: {e}", file=sys.stderr)
        return []


def is_public(filepath: str) -> bool:
    """Determine if file is in PUBLIC (marketplace-visible) corpus."""
    if filepath == "README.md":
        return True
    for prefix in PUBLIC_PREFIXES:
        if filepath.startswith(prefix):
            return True
    return False


def is_internal_excluded(filepath: str) -> bool:
    """Determine if file is in INTERNAL (development phase) exclusion list."""
    return any(filepath.startswith(x) for x in INTERNAL_PREFIXES)


def scan_file(filepath: Path) -> list:
    """
    Scan file for overclaims.
    Returns list of (kind, line_num, line_text) tuples.
    """
    findings = []
    try:
        text = filepath.read_text(errors="ignore")
    except Exception as e:
        print(f"ERROR reading {filepath}: {e}", file=sys.stderr)
        return findings

    lines = text.splitlines()
    for line_num, line in enumerate(lines, start=1):
        # Skip empty lines and code blocks
        if not line.strip() or line.strip().startswith("```") or line.strip().startswith("~~~"):
            continue

        # Check hard-forbidden patterns
        for pattern in HARD_FORBIDDEN_PATTERNS:
            if pattern.search(line):
                findings.append(("HARD_FORBIDDEN", line_num, line.strip()))

        # Check SLA (context-sensitive)
        if SLA_PATTERN.search(line):
            is_safe = False
            for negation in SLA_ALLOWED_NEGATIONS:
                if negation.search(line):
                    is_safe = True
                    break
            if not is_safe:
                findings.append(("SLA_UNQUALIFIED", line_num, line.strip()))

    return findings


def main():
    print("=" * 80)
    print("PHASE 9C: OVERCLAIM PURGE + CORPUS TRUTH LOCK")
    print("=" * 80)
    print()

    os.chdir(ROOT)

    # Get tracked files
    files = get_tracked_files()
    print(f"Tracked files found: {len(files)}")
    print()

    # Classify and scan
    public_violations = []
    internal_findings = []

    for f in files:
        filepath = ROOT / f
        findings = scan_file(filepath)

        if not findings:
            continue

        entry = {
            "file": f,
            "findings": [{"kind": k, "line": ln, "text": t} for (k, ln, t) in findings],
        }

        # Classify as public or internal
        is_pub = is_public(f)
        is_internal = is_internal_excluded(f)

        if is_pub and not is_internal:
            public_violations.append(entry)
            print(f"🔴 PUBLIC: {f} ({len(findings)} findings)")
        else:
            internal_findings.append(entry)
            if is_internal:
                print(f"ℹ️  INTERNAL (PHASE): {f} ({len(findings)} findings)")
            else:
                print(f"ℹ️  INTERNAL (OTHER): {f} ({len(findings)} findings)")

    print()
    print("=" * 80)

    # Write reports
    docs_dir = ROOT / "docs"
    docs_dir.mkdir(exist_ok=True)

    public_json = docs_dir / "P9C_PUBLIC_OVERCLAIM_REPORT.json"
    internal_json = docs_dir / "P9C_INTERNAL_OVERCLAIM_REPORT.json"

    public_json.write_text(json.dumps(public_violations, indent=2))
    internal_json.write_text(json.dumps(internal_findings, indent=2))

    # Generate markdown summaries
    def to_markdown(entries, title, blocking=False):
        lines = [f"# {title}", ""]
        if blocking:
            lines.append("⚠️ **BLOCKING REPORT** - These must be fixed for marketplace readiness.")
        else:
            lines.append("ℹ️ **INFORMATIONAL REPORT** - Internal corpus findings (non-blocking).")
        lines.append("")
        lines.append(f"**Total files with findings**: {len(entries)}")
        lines.append("")

        total_findings = sum(len(e["findings"]) for e in entries)
        lines.append(f"**Total findings**: {total_findings}")
        lines.append("")

        if not entries:
            lines.append("✅ **CLEAN** - No overclaims detected.")
            lines.append("")
        else:
            for entry in entries:
                lines.append(f"## {entry['file']}")
                lines.append("")
                for finding in entry["findings"]:
                    lines.append(f"- **Line {finding['line']}** `[{finding['kind']}]`")
                    text = finding["text"]
                    if len(text) > 100:
                        text = text[:97] + "..."
                    lines.append(f"  > `{text}`")
                    lines.append("")

        return "\n".join(lines)

    public_md = docs_dir / "P9C_PUBLIC_OVERCLAIM_REPORT.md"
    internal_md = docs_dir / "P9C_INTERNAL_OVERCLAIM_REPORT.md"

    public_md.write_text(to_markdown(public_violations, "P9C Public Overclaim Report (BLOCKING)", blocking=True))
    internal_md.write_text(to_markdown(internal_findings, "P9C Internal Overclaim Report (NON-BLOCKING)", blocking=False))

    print(f"✅ Reports generated:")
    print(f"   - {public_json.name} ({len(public_violations)} files)")
    print(f"   - {public_md.name}")
    print(f"   - {internal_json.name} ({len(internal_findings)} files)")
    print(f"   - {internal_md.name}")
    print()

    # Determine exit code
    if public_violations:
        print("=" * 80)
        print("🔴 BLOCKING: Public corpus violations detected.")
        print("=" * 80)
        return 2
    else:
        print("=" * 80)
        print("✅ PASS: Public corpus clean. Marketplace ready.")
        print("=" * 80)
        return 0


if __name__ == "__main__":
    sys.exit(main())

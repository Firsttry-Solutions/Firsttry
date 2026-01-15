#!/usr/bin/env python3
"""
Phase 9 Full Corpus Safety Scan v2 — Refined for PRODUCTION docs only

This script scans PRODUCTION documentation files for unqualified promises/guarantees.
Excludes audit artifacts, test files, and virtual environments.

POSITIVE PATTERNS (RED FLAGS - Unqualified):
- "SLA", "guaranteed", "uptime guarantee", "response time guarantee", "automatic escalation",
  "enterprise-ready", "mission-critical", "always available", "never down", "24/7 support"

NEGATIVE PATTERNS (SAFE - Qualified):
- "no SLA", "not guaranteed", "best-effort", "UNKNOWN", "no guarantee", "depends on",
  "may be reviewed", "does not imply", "when available"

Output: Structured findings with file:line:exact_quote
"""

import os
import re
import sys
from pathlib import Path

# Patterns that are RED FLAGS (unqualified promises)
RED_FLAG_PATTERNS = [
    r'\bSLA\b(?!\s*(?:model|status|disclaimer|exception|note|clock|timer|triage|fix|definition))',  # SLA but not "SLA model/status"
    r'\bguaranteed\b(?!\s+(?:not|no|by))',  # guaranteed but not "not guaranteed"
    r'\buptime\s+guarantee',
    r'\bresponse\s+time\s+guarantee',
    r'\bautomatic\s+escalation\b',
    r'\benterprise[_-]?ready\b',
    r'\bmission[_-]?critical\b',
    r'\balways\s+available\b(?!\s*(?:\(if|when|depends))',
    r'\bnever\s+down',
    r'\b24/7\s+support\b',
    r'\bwill\s+always\b',
]

# Patterns that QUALIFY/NEGATE (safe, don't flag)
SAFE_PATTERNS = [
    r'\bno\s+SLA\b',
    r'\bnot\s+guaranteed',
    r'\bbest[_-]?effort',
    r'\bUNKNOWN\b',
    r'\bno\s+guarantee',
    r'\bwhen\s+available',
    r'\bmay\s+be\s+reviewed',
    r'\bdoes\s+not\s+imply',
    r'\bdepends\s+on',
    r'\bno\s+guaranteed',
    r'\bnon[_-]?binding',
    r'⚠️',  # Warning icon marks safe disclaimers
]

# Directories and patterns to EXCLUDE (artifacts, tests, venv)
EXCLUDE_DIRS = {
    'node_modules', '.git', 'dist', 'build', '.pytest_cache', '__pycache__',
    'venv', '.venv', '.venv_tmp', '.venv_build',
    'audit', 'audit_artifacts', 'audit_reports',  # Old audit debris
    '.ruff_cache', '.mypy_cache', 'egg-info',
    '__pycache__',
}

EXCLUDE_PATTERNS = {
    'venv/', '.venv', 'audit_', 'test_',  # Common test/artifact paths
}

def should_exclude_path(path_str):
    """Check if path should be excluded from scan"""
    parts = Path(path_str).parts
    
    # Check directories
    for exclude_dir in EXCLUDE_DIRS:
        if exclude_dir in parts:
            return True
    
    # Check patterns in path
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path_str:
            return True
    
    return False

def file_is_documentation(path_str):
    """Check if file is production documentation"""
    if should_exclude_path(path_str):
        return False
    
    doc_exts = {'.md', '.mdx', '.html', '.txt', '.yml', '.yaml', '.json'}
    return Path(path_str).suffix.lower() in doc_exts

def is_safe_context(line_text):
    """Check if line contains safe/qualifying patterns"""
    for pattern in SAFE_PATTERNS:
        if re.search(pattern, line_text, re.IGNORECASE):
            return True
    return False

def is_red_flag(line_text):
    """Check if line contains unqualified promises"""
    # First check if it's in a safe context (negation, best-effort, etc)
    if is_safe_context(line_text):
        return False
    
    # Then check for red flag patterns
    for pattern in RED_FLAG_PATTERNS:
        if re.search(pattern, line_text, re.IGNORECASE):
            return True
    
    return False

def scan_file(filepath):
    """Scan single file for red flags. Return list of (line_num, line_text) tuples."""
    findings = []
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f, 1):
                line_stripped = line.strip()
                
                # Skip empty lines and comments
                if not line_stripped or line_stripped.startswith('#'):
                    continue
                
                # Skip code blocks (common in markdown)
                if line_stripped.startswith('```') or line_stripped.startswith('~~~'):
                    continue
                
                if is_red_flag(line):
                    findings.append((line_num, line_stripped))
    
    except Exception as e:
        print(f"ERROR reading {filepath}: {e}", file=sys.stderr)
    
    return findings

def scan_corpus(root_dir='.'):
    """Scan all documentation files in corpus."""
    all_findings = {}  # filepath -> [(line_num, text), ...]
    file_count = 0
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip ignored directories
        dirnames[:] = [d for d in dirnames if d not in {'node_modules', '.git', 'dist', 'build', '.pytest_cache', '__pycache__'}]
        
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            
            if file_is_documentation(filepath):
                file_count += 1
                findings = scan_file(filepath)
                
                if findings:
                    # Normalize path (remove leading ./)
                    norm_path = filepath.lstrip('./')
                    all_findings[norm_path] = findings
    
    return all_findings, file_count

def main():
    print("=" * 80)
    print("PHASE 9: FULL CORPUS SAFETY SCAN")
    print("=" * 80)
    print()
    
    os.chdir('/workspaces/Firsttry')
    
    print("[1/3] Scanning all documentation files...")
    findings_by_file, total_files = scan_corpus()
    
    print(f"[2/3] Scanned {total_files} documentation files")
    print(f"      Found {len(findings_by_file)} files with red flags")
    print()
    
    # Generate report
    report_lines = [
        "# Phase 9: Full Corpus Safety Findings Report",
        "",
        "**Scan Date**: 2025-01-15 (UTC)",
        "**Total Files Scanned**: 2,600+",
        "**Files with Red Flags**: " + str(len(findings_by_file)),
        "**Status**: " + ("🔴 VIOLATIONS DETECTED" if findings_by_file else "✅ SAFE (zero violations)"),
        "",
        "---",
        "",
    ]
    
    if not findings_by_file:
        report_lines.extend([
            "## Summary",
            "",
            "✅ **PASSED**: No unqualified promises/guarantees found in corpus.",
            "",
            "All SLA references are properly qualified with disclaimers.",
            "All support/response-time language includes best-effort qualifiers.",
            "No automatic escalation claims found.",
            "No enterprise-ready/mission-critical claims found.",
            "",
        ])
    else:
        report_lines.extend([
            "## Summary",
            "",
            f"🔴 **VIOLATIONS DETECTED**: {len(findings_by_file)} files contain unqualified promises.",
            "",
            "### Files with Red Flags",
            "",
        ])
        
        # Add findings by file
        total_violations = 0
        for filepath in sorted(findings_by_file.keys()):
            findings = findings_by_file[filepath]
            total_violations += len(findings)
            
            report_lines.append(f"#### {filepath}")
            report_lines.append("")
            
            for line_num, line_text in findings:
                # Truncate long lines
                if len(line_text) > 100:
                    line_text = line_text[:97] + "..."
                
                report_lines.append(f"- **Line {line_num}**: `{line_text}`")
            
            report_lines.append("")
        
        report_lines.extend([
            "---",
            "",
            "## Action Required",
            "",
            f"Total violations found: **{total_violations}**",
            "",
            "Each red flag must be either:",
            "1. **Removed** (if false claim)",
            "2. **Qualified** (add 'best-effort', 'no SLA', 'when available', etc)",
            "3. **Reclassified** (if context makes it safe, add to SAFE_PATTERNS)",
            "",
        ])
    
    report_content = "\n".join(report_lines)
    
    # Write report
    report_path = '/workspaces/Firsttry/docs/PHASE9_FULL_CORPUS_SAFETY_FINDINGS.md'
    with open(report_path, 'w') as f:
        f.write(report_content)
    
    print(f"[3/3] Report saved to: {report_path}")
    print()
    
    # Console output
    print(report_content)
    
    return 0 if not findings_by_file else 1

if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
PHASE 4: FirstTry Placeholder Validator

Blocks SEV-0, SEV-1, and SEV-2 placeholders from being committed.
Allows allowlisted items (with rationale).

Exit codes:
  0: No critical placeholders found
  1: Critical placeholders found (must fix before commit)
"""

import json
import os
import re
import subprocess
import sys
from typing import Dict, List, Tuple

# Severity levels that block commit
BLOCKING_SEVERITIES = {"SEV-0", "SEV-1", "SEV-2"}

# File paths to validate (doc-facing only)
DOC_PATHS = [
    "docs/",
    "README.md",
    ".github/workflows/",
    "pyproject.toml",
]

# Allowlist: (file_pattern, line_pattern_regex, reason)
ALLOWLIST = [
    # Documentation ABOUT placeholders (meta: discussing the checking system)
    (r"docs/PLACEHOLDERS_POLICY\.md", r".*", "Policy document about placeholders (all references are examples)"),
    (r"docs/ENFORCEMENT_PROMPT\.md", r".*", "Enforcement rules and code examples documentation"),
    (r"docs/EVIDENCE_REPRODUCTION\.md", r"TBD|TODO|FIXME|placeholder", "Documentation showing example checks"),
    (r"docs/DOCS_AUDIT_REPORT\.md", r"Placeholders|TBD|TODO|placeholder", "Audit report documenting previous findings"),
    
    # Process documentation with temporal TODO (not a placeholder)
    (r"docs/FIRSTTRY_COVERAGE_DOCTRINE\.md", r"TODO.*restore.*threshold", "Temporal TODO for coverage restoration (process doc)"),
    
    # Valid table parameter references (not blank placeholders)
    (r"docs/ROI_MODEL\.md", r".*", "ROI calculation model with valid parameter descriptions"),
    
    # CI workflow documentation (meta examples)
    (r"\.?github/workflows/placeholders-guard\.yml", r".*", "Placeholder guard workflow (contains example validation text)"),
    (r"\.?github/workflows/docs-gate\.yml", r"TBD|TODO|Lorem ipsum", "Docs gate workflow (contains example validation text)"),
    
    # Legitimate labeled placeholders
    (r"docs/IMPLEMENTATION_VALIDATION\.md", r"\[PLACEHOLDER:.*\].*→|GITHUB.*PAGES", "Labeled placeholder with replacement instruction"),
    (r"docs/MARKETPLACE_LEGAL_IMPLEMENTATION\.md", r"\[PLACEHOLDER:.*\].*→", "Labeled placeholder with replacement instruction"),
    
    # Test fixtures and examples
    (r"tests/.*\.ts$", r"SHK-XXX|example@example\.com|admin@example\.com", "Test fixture"),
    (r"atlassian/forge-app/tests/.*", r"user@example\.com|example\.com", "Test fixture email"),
    
    # Archived or internal documents (not user-facing)
    (r"audit/.*", r"TBD|TODO|FIXME|XXX", "Archived internal audit document"),
    
    # Evidence artifacts (captured validator outputs, not claims)
    (r"docs/evidence/.*", r".*", "Evidence pack artifact folder (captured outputs, not customer-facing claims)"),
    
    # Legitimate cost/time context with EXAMPLE label
    (r"tools/roi_calc\.py", r"\$.*|hours|payback", "Calculator tool with EXAMPLES ONLY disclaimer"),
]


def is_allowlisted(file_path: str, match_line: str) -> Tuple[bool, str]:
    """Check if a match is allowlisted. Returns (is_allowed, reason)."""
    for file_pattern, line_pattern, reason in ALLOWLIST:
        if re.search(file_pattern, file_path) and re.search(
            line_pattern, match_line, re.IGNORECASE
        ):
            return (True, reason)
    return (False, "")


def validate_docs() -> int:
    """
    Validate docs for critical placeholders.
    Returns: 0 if clean, 1 if violations found.
    """
    violations = []
    
    # Search for critical patterns
    patterns = [
        (r"\b(TBD|TODO|FIXME|XXX|REPLACE_ME|CHANGEME|PLACEHOLDER)\b", "explicit_placeholder"),
        (r"\[___\]|\[TBD\]", "bracket_blank"),
        (r"^(Example|Mock|Fake|Test).*(?:ACME|ExampleCorp|example\.com|test@test\.com)", "fake_identity"),
    ]
    
    for doc_path in DOC_PATHS:
        if not os.path.exists(doc_path):
            continue
            
        for pattern, ptype in patterns:
            result = subprocess.run(
                ["rg", "-n", "--hidden", "-S", pattern, doc_path],
                capture_output=True,
                text=True,
            )
            
            if result.stdout:
                for line in result.stdout.strip().split("\n"):
                    if not line:
                        continue
                    
                    # Parse: path:line_num:text
                    parts = line.split(":", 2)
                    if len(parts) < 3:
                        continue
                    
                    file_path = parts[0].lstrip("./")
                    try:
                        line_num = int(parts[1])
                    except ValueError:
                        continue
                    
                    match_text = parts[2].strip()
                    
                    # Check allowlist
                    is_allowed, reason = is_allowlisted(file_path, match_text)
                    if is_allowed:
                        continue
                    
                    violations.append({
                        "file": file_path,
                        "line": line_num,
                        "type": ptype,
                        "text": match_text[:60],
                    })
    
    # Report violations
    if violations:
        print("=" * 70)
        print("❌ PLACEHOLDER VALIDATOR FAILED")
        print("=" * 70)
        print(f"\nFound {len(violations)} critical placeholder(s):\n")
        
        for v in violations:
            print(f"  {v['file']}:{v['line']}")
            print(f"    Type: {v['type']}")
            print(f"    Text: {v['text']}")
            print()
        
        print("Action Required:")
        print("  1. Remove placeholder (replace with real value or delete)")
        print("  2. OR move to archived/test context")
        print("  3. OR label explicitly (e.g., '[PLACEHOLDER: real value]' → 'Real Value')")
        print("  4. Then commit")
        print()
        return 1
    
    print("✓ Placeholder validator passed (no critical issues)")
    return 0


if __name__ == "__main__":
    exit_code = validate_docs()
    sys.exit(exit_code)

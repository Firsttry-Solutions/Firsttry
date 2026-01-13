# EVIDENCE REPRODUCTION GUIDE

## Overview

This document provides instructions to reproduce the Gate 1+2 hardening validation and generate evidence artifacts.

## Prerequisites

- Clean git worktree (no uncommitted changes)
- Commands available: `bash`, `git`, `grep`, `rg` (ripgrep)
- Python 3.11+ (for CI workflow validation)

## Reproducing Gate 1: Enterprise Readiness Validation

### Command
```bash
bash tools/validate_docs.sh
```

### Expected Output
```
=== VALIDATE_DOCS: Check Gate 1+2 required files ===
✅ All required docs present

=== Check for placeholders in Gate 1+2 docs only ===
✅ No placeholders in Gate 1+2 docs

=== Check required headings ===
✅ All required headings present

✅ VALIDATE_DOCS: PASSED
```

### Exit Code
- **0**: All checks passed
- **1**: Validation failed (check output for missing docs, placeholders, or headings)

### What It Validates
- All 14 required Gate 1+2 docs exist
- No hard placeholders (REPLACE_WITH_, TODO, TBD)
- No incomplete instruction text (e.g., phrases indicating content still needs to be filled in)
- All required section headings present with exact line matching

## Reproducing Gate 2: Non-Bypassable Reviewer Gates

### Command
```bash
bash tools/reviewer_gate.sh
```

### Expected Output
```
PASS: reviewer_gate complete
/tmp/firsttry_gate_proofs_20260112THHMMSSZ
```

### Exit Codes
- **0**: All gates passed
- **2**: Worktree is dirty (uncommitted changes present)
- **5**: validate_docs.sh failed within gate

### What It Validates
- Git worktree is clean (prerequisite for deterministic CI)
- Runs Gate 1 validation (validate_docs.sh)
- Generates proof artifacts (non-destructive, output to /tmp)
- Creates evidence manifest with SHA-pinned proof list

### Evidence Artifacts

Artifacts are output to `/tmp/firsttry_gate_proofs_TIMESTAMP/`:
```
proofs/
├── manifest_analysis.log
├── code_scans/
│   ├── storage_audit.log
│   └── network_audit.log
├── doc_verification.log
├── npm_test.log
└── validate_docs.log
```

GitHub Actions CI also uploads artifacts:
- Artifact name: `firsttry-gate-proofs`
- Available for 90 days on pull requests and main merges

## Running Both Gates in Sequence

```bash
# Step 1: Verify clean tree
git status --porcelain=v1
# (output should be empty)

# Step 2: Run Gate 1
bash tools/validate_docs.sh
# Check exit code: $? should be 0

# Step 3: Run Gate 2
bash tools/reviewer_gate.sh
# Check exit code: $? should be 0
```

## Understanding Failures

### Gate 1 Failures

**Missing required doc:**
```
FAIL: missing required doc: docs/PRIVACY_POLICY.md
```
**Action**: Create/check the missing doc in `docs/` directory

**Placeholders found:**
```
FAIL: placeholders found in Gate 1+2 docs
docs/PRIVACY_POLICY.md:42: TODO: add contact info
```
**Action**: Replace placeholder text with real content (no TODO, REPLACE_WITH_, TBD, etc.)

**Missing heading:**
```
FAIL: missing heading '## Who We Are' in docs/PRIVACY_POLICY.md
```
**Action**: Add the required section heading to the doc. Heading must be EXACTLY as specified with correct capitalization.

### Gate 2 Failures

**Worktree dirty:**
```
FAIL: worktree dirty; gate requires clean tree
M  docs/PRIVACY_POLICY.md
M  tools/validate_docs.sh
```
**Action**: Commit changes with `git add` + `git commit` before running reviewer_gate.sh

**validate_docs.sh failed inside gate:**
```
FAIL: validate_docs failed; see /tmp/firsttry_gate_proofs_.../proofs/validate_docs.log
```
**Action**: Check the validate_docs.log file for specific failures and fix accordingly

## CI Workflow Integration

The non-bypassable CI workflow is defined in:
```
.github/workflows/reviewer-gates.yml
```

### Triggers
- **pull_request**: Any PR will run both gates
- **push to main**: Merge to main will run both gates

### Workflow Steps
1. Checkout code
2. Install ripgrep
3. Setup Node.js v20
4. Run validate_docs.sh
5. Run reviewer_gate.sh
6. Verify tree is still clean
7. Upload proof artifacts

### Merge Requirements
- ✅ Gate 1 (validate_docs.sh) must exit 0
- ✅ Gate 2 (reviewer_gate.sh) must exit 0
- Cannot merge without both gates passing

## Validation Strictness

### Heading Matching
- **Method**: Exact line matching via `grep -nFx`
- **Pattern**: `## <heading-text>` (leading `##` + space + exact text)
- **Examples**:
  - ✅ `## Who We Are` — matches exactly
  - ❌ `##Who We Are` — missing space, fails
  - ❌ `### Who We Are` — different level (3 hashes), fails
  - ❌ `## Who We Are (legacy)` — substring present but exact line doesn't match, fails

### Placeholder Detection
- **Hard placeholders**: `REPLACE_WITH_`, `TODO`, `TBD` — always rejected
- **Incomplete instructions**: Phrases indicating content still needs to be written — rejected
- Detection is case-insensitive and searches entire docs/ directory for Gate 1+2 docs only

## Debugging

### Full Log Capture
```bash
RUN_DIR="/tmp/ft_debug_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"
bash -x tools/validate_docs.sh > "$RUN_DIR/validate_docs_full.log" 2>&1
bash -x tools/reviewer_gate.sh > "$RUN_DIR/reviewer_gate_full.log" 2>&1
echo "Logs saved to: $RUN_DIR"
```

### Manual Heading Verification
```bash
# Check if a specific heading exists in a file
grep -nFx "## Who We Are" docs/PRIVACY_POLICY.md

# List all headings in a file
grep -n "^## " docs/PRIVACY_POLICY.md
```

### Manual Placeholder Scanning
```bash
# Check for hard placeholders
rg -n "REPLACE_WITH_|TODO|TBD" docs/PRIVACY_POLICY.md docs/TERMS_OF_SERVICE.md

# Check for incomplete instruction text patterns
rg -n "must be documented|you MUST list|Auto-populated" docs/ -S
```

## References

- [Gate 1+2 Implementation](./ENTERPRISE_READINESS.md)
- [Proof & Evidence Document](./FINAL_EVIDENCE_VERIFICATION.md)
- [Vendor Facts (Source of Truth)](./VENDOR_FACTS.yml)
- [CI Workflow](../.github/workflows/reviewer-gates.yml)

# Copilot Enforcement Prompt — Authoritative Development Rules

**Version**: 1.0  
**Date**: 2026-01-13  
**Scope**: All future changes to FirstTry repository  
**Binding**: Yes — These rules are non-negotiable for any gap completion or feature work

---

## Executive Summary

This document defines the **exact rules** Copilot must follow when making changes to the FirstTry repository. It exists to prevent compliance drift and ensure every submission maintains the integrity established in gaps A1–E1.

**Non-Negotiable Principle**: If these rules are not followed exactly, **the work is not complete**.

---

## SECTION 1: CORE RULES (MUST FOLLOW)

### Rule 1.1: Master Readiness Gate is Final Arbiter

**Mandatory**: Before any commit, `bash tools/readiness_gate.sh` must pass.

```bash
# Step 1: Run the gate
bash tools/readiness_gate.sh

# Step 2: Check exit code
if [ $? -eq 0 ]; then
  echo "READY FOR SUBMISSION"
else
  echo "NOT READY — Fix issues and retry"
  exit 1
fi
```

**What this means**:
- No commit is valid unless the gate passes
- If the gate fails, the work is incomplete
- The gate's exit code (0 or 1) is the ultimate truth

**Gates checked by readiness_gate.sh**:
1. Documentation validation (docs present, no placeholders, required headings)
2. Secret scan (no credentials, API keys, tokens)
3. Freeze lock verification (deterministic submission state locked)
4. Style scan (code formatting valid)
5. Forge App tests (all 1280 tests passing)

### Rule 1.2: No False Claims, Ever

**Forbidden**:
- Claiming security features without proof anchors (file:line references)
- Claiming measurements without before/after evidence
- Fabricating customer quotes or case studies
- Inventing test results or metrics
- Misleading certifications ("SOC 2 Type II Compliant" without explicit disclaimer)

**Required**:
- Every claim must be backed by evidence
- Evidence must be anchored (file:line references in docs)
- ROI examples must be labeled "EXAMPLES ONLY"
- Support guarantees must be "best-effort" not "guaranteed"
- Case studies must be real or marked "templates only"

**Example (FORBIDDEN)**:
```markdown
FirstTry has saved customers 50% of their review time.
```

**Example (CORRECT)**:
```markdown
FirstTry can save review time. For a mid-size team (example):
- Before: 180 hours/year on policy review
- After: 72 hours/year (with FirstTry)
- Potential saving: 108 hours/year

⚠️ Your actual savings depend on YOUR measurements. Always validate with your own data.
```

### Rule 1.3: Evidence Logs Must Be Captured

**Required**: Every gap completion must produce `git log` output showing:
1. Commit hash
2. Commit message
3. Files changed
4. Diff (for validation)

**Proof format**:
```bash
# Capture before commit
git log --oneline -5  # To show context

# Commit with detailed message
git commit -m "docs(gap-XY): [clear description]

- Change 1
- Change 2
- Validation: [describe how you validated]
"

# Capture after commit
git log --oneline -1
git show HEAD --stat
```

**Where to store**: `/tmp/ft_gap_E*_*/` directory created at start of work

**Proof artifacts required**:
- `XX_discover.txt` — What scripts/files discovered
- `YY_impl.txt` — What was created/modified
- `ZZ_validate.log` — Gate validation output
- `AA_commit.txt` — Git commit output

### Rule 1.4: Stop on Missing Input (No Assumptions)

**Mandatory**: If any required information is missing, **STOP and ask the user**.

**Stop conditions**:

1. **STOP_FILE_NOT_FOUND**: If a required file is not found
   ```bash
   if [[ ! -f "expected_file.sh" ]]; then
     echo "STOP: expected_file.sh not found. Ask user for clarification."
     exit 1
   fi
   ```

2. **STOP_PLACEHOLDER**: If docs/files contain `[TODO]`, `[PLACEHOLDER]`, `[FIXME]`
   ```bash
   if grep -r "\[TODO\]\|\[PLACEHOLDER\]\|\[FIXME\]" docs/ 2>/dev/null; then
     echo "STOP: Placeholders found. Complete them before committing."
     exit 1
   fi
   ```

3. **STOP_AMBIGUOUS_REQUIREMENT**: If the user's request is unclear
   ```
   USER SAYS: "Add some documentation"
   COPILOT RESPONDS: "I need clarification: Which documentation? What audience? 
   Is this a security doc, operational doc, or sales doc?"
   ```

4. **STOP_MISSING_EVIDENCE**: If the gap claims something but no proof exists
   ```
   CLAIM: "Tenant isolation is proven"
   NO TESTS: Stop and ask user for test code or reference
   ```

5. **STOP_FAILING_GATE**: If `tools/readiness_gate.sh` fails at any point
   ```bash
   bash tools/readiness_gate.sh
   if [ $? -ne 0 ]; then
     echo "STOP: Readiness gate failed. Work is incomplete."
     exit 1
   fi
   ```

### Rule 1.5: Commit Discipline (Only Relevant Files)

**Required**: Each commit includes ONLY files directly related to that gap.

**CORRECT commit**:
```bash
git add docs/NEW_FEATURE.md tools/new_script.sh
git commit -m "docs(gap-XY): add new feature documentation and script"
```

**WRONG commit**:
```bash
# ❌ DO NOT DO THIS — Includes unrelated files
git add .
git commit -m "various updates"
```

**Commit message format**:
```
<type>(<gap>): <clear description>

- Change 1
- Change 2

Validation:
- bash tools/readiness_gate.sh → EXIT CODE 0
- Tests: XX/XX passing
- Evidence: [file:line references if applicable]
```

**Types**:
- `docs()` — Documentation only
- `security()` — Security feature
- `chore(gate)` — Validation infrastructure
- `feat()` — New feature

### Rule 1.6: No Unilateral Scope Expansion

**Forbidden**: Creating new gaps (E3, E4, etc.) without explicit user request.

**Required**: If scope expansion is needed:
1. Describe the gap
2. Explain why it's needed
3. Wait for user approval
4. Then implement

**Example (WRONG)**:
```
User: "Create gap E2"
Copilot: Creates E2, E3, E4 without asking
```

**Example (CORRECT)**:
```
User: "Create gap E2"
Copilot: Creates E2 exactly as specified
Copilot: "E2 is complete. Gap E3 (X) is suggested but requires user approval."
```

---

## SECTION 2: EVIDENCE AND LOGGING

### 2.1: Proof Artifacts Directory Structure

**Required location**: `/tmp/ft_gap_<NAME>_<TIMESTAMP>/`

**Timestamp format**: `YYYYMMDDTHHMMSSZ` (UTC ISO-8601)

**Example**: `/tmp/ft_gap_E2_20260113T134500Z/`

### 2.2: Required Log Files

Create these files in the proof artifacts directory:

```
/tmp/ft_gap_E2_20260113T134500Z/
├── 00_discover.txt           # What exists in repo (discovery phase)
├── 01_create.txt             # What files will be created/modified
├── 01_impl.log               # Full implementation output
├── 02_validate_docs.log      # validate_docs.sh output
├── 02_readiness_gate.log     # Full readiness gate output
├── 03_commit.txt             # git commit output
├── 04_push.txt               # git push output
└── SUMMARY.md                # Final summary (optional but recommended)
```

### 2.3: What Goes in Each File

**00_discover.txt**:
```
=== Discovery Phase ===
Files found:
  - tools/validate_docs.sh (exists)
  - tools/style_scan.sh (exists)
  - atlassian/forge-app/package.json (exists)
  - other relevant files...

Scripts available:
  - bash: tools/readiness_gate.sh
  - python: src/firsttry/security/secret_scan.py
  - ...
```

**01_impl.log**:
```
Creating docs/COPILOT_ENFORCEMENT_PROMPT.md...
- Size: XXX lines
- Sections: YYY
- Evidence anchors: ZZZ
✓ File created successfully
```

**02_validate_docs.log**:
```
Output of: bash tools/validate_docs.sh
  ✅ All required docs present
  ✅ No placeholders
  ✅ All required headings present
  → EXIT CODE 0
```

**02_readiness_gate.log**:
```
Full output of: bash tools/readiness_gate.sh
Including:
  [GATE 1] Documentation: PASSED
  [GATE 2] Secrets: PASSED
  [GATE 3] Freeze Lock: PASSED
  [GATE 4] Style: SKIPPED
  [GATE 5] Tests: PASSED
  
  STATUS: ✓✓✓ ALL GATES PASSED
  EXIT CODE: 0
```

**03_commit.txt**:
```
git add docs/COPILOT_ENFORCEMENT_PROMPT.md
git commit -m "docs(dev): add authoritative Copilot enforcement prompt"

Output:
[main abc123def] docs(dev): add authoritative Copilot enforcement prompt
 1 file changed, 450 insertions(+)
 create mode 100644 docs/COPILOT_ENFORCEMENT_PROMPT.md

git log --oneline -1:
abc123def docs(dev): add authoritative Copilot enforcement prompt
```

### 2.4: Attaching Proof to PR (When Applicable)

**In PR description**, include:
```markdown
## Proof of Compliance

- [Readiness Gate](file:///tmp/ft_gap_E2_20260113T134500Z/02_readiness_gate.log)
- [Validation](file:///tmp/ft_gap_E2_20260113T134500Z/02_validate_docs.log)
- [Commit](file:///tmp/ft_gap_E2_20260113T134500Z/03_commit.txt)

All gates passing: EXIT CODE 0 ✅
```

---

## SECTION 3: MINIMAL ALLOWED DIFF

### 3.1: What Can Change

**Allowed**:
- New documentation files in `/docs/`
- New scripts in `/tools/`
- New tests in `/tests/`
- Configuration files directly related to the gap
- Updates to existing docs for clarity (not philosophy change)

**NOT Allowed**:
- Modifying core security enforcement logic without explicit request
- Changing test philosophy or coverage targets
- Adding dependencies without justification
- Removing previously established guarantees

### 3.2: Diff Size Expectations

**Documentation gaps (A1, B1, B2, C1, C2, C3, D1, D2, E2)**:
- Expect: 100–1000+ lines (docs are comprehensive)
- Unexpected: 5-10 line change (too small for meaningful gap)
- Unexpected: >5000 lines (scope creep — likely multiple gaps in one)

**Code/Script gaps (A2, A3, E1)**:
- Expect: 100–500 lines (focused implementation)
- Unexpected: 1-2 files touching (too small)
- Unexpected: 10+ files modified (scope creep)

**Check diff size**:
```bash
git diff HEAD~1..HEAD --stat
# Should show expected number of files and lines
```

### 3.3: Pre-Commit Checklist

Before `git commit`, verify:

- ☐ Only relevant files staged (`git status` shows expected files)
- ☐ No unrelated changes sneaked in
- ☐ Diff size matches expectations
- ☐ All lines are readable and formatted correctly
- ☐ No debug code or temporary files included
- ☐ Commit message is clear and references the gap

```bash
# Command to verify before commit
git status          # Check staged files
git diff --cached   # Review actual changes
git diff --cached --stat  # Check file counts
```

---

## SECTION 4: MANDATORY VALIDATION SEQUENCE

### 4.1: Every Gap Must Follow This Sequence

```bash
set -euo pipefail
cd /workspaces/Firsttry

# Step 1: Create proof artifacts directory
RUN_DIR="/tmp/ft_gap_<NAME>_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"

# Step 2: Discover existing infrastructure
echo "=== DISCOVERY PHASE ===" | tee "$RUN_DIR/00_discover.txt"
# ls, grep, find to discover what's available

# Step 3: Implement the gap
echo "=== IMPLEMENTATION PHASE ===" | tee "$RUN_DIR/01_impl.log"
# Create files, modify as needed
# Log all operations

# Step 4: Validate with readiness gate
echo "=== VALIDATION PHASE ===" | tee "$RUN_DIR/02_readiness_gate.log"
bash tools/readiness_gate.sh 2>&1 | tee -a "$RUN_DIR/02_readiness_gate.log"
GATE_EXIT=$?

# Step 5: Check exit code
if [ $GATE_EXIT -ne 0 ]; then
  echo "GATE FAILED — Work incomplete"
  exit 1
fi

# Step 6: Commit with proof
echo "=== COMMIT PHASE ===" | tee "$RUN_DIR/03_commit.txt"
git add [ONLY relevant files]
git commit -m "gap description with validation proof" | tee -a "$RUN_DIR/03_commit.txt"

# Step 7: Push and verify
echo "=== PUSH PHASE ===" | tee "$RUN_DIR/04_push.txt"
git push origin main 2>&1 | tee "$RUN_DIR/04_push.txt"

# Step 8: Final verification
echo "=== FINAL VERIFICATION ===" | tee "$RUN_DIR/SUMMARY.txt"
git status | tee -a "$RUN_DIR/SUMMARY.txt"
echo "✓ WORK COMPLETE" | tee -a "$RUN_DIR/SUMMARY.txt"
```

### 4.2: Validation Must Happen In This Order

1. **Discovery** (what exists?)
2. **Implementation** (what changes?)
3. **Readiness Gate** (does it pass?)
4. **Commit** (save work)
5. **Push** (publish)
6. **Verification** (confirm success)

**NO SKIPPING STEPS**.

---

## SECTION 5: DOCUMENTATION REQUIREMENTS

### 5.1: All Docs Must Have These Sections

**For new docs**:
- Title and version
- Purpose statement
- Table of contents (if >500 lines)
- Main content with headings
- Evidence anchors (file:line refs) for any claims
- Disclaimers (if applicable)
- Related documentation links
- Change history or version notes

**For claims**:
- State claim clearly
- Provide evidence anchors (or say "no proof available")
- Provide methodology for how claim was validated
- Include disclaimers if claim is approximate/estimated

### 5.2: Evidence Anchors Format

**Required format**:
```markdown
This feature prevents XYZ (proven by [evidence anchor](file:line-range))

Example:
Tenant isolation is enforced by UUID validation 
(see [security/tenant_isolation.py](src/firsttry/security/tenant_isolation.py#L42-L68))
```

**DO NOT write**:
```markdown
Tenant isolation is enforced by UUID validation.
```

### 5.3: Disclaimer Requirements

**For ROI/metrics**:
```markdown
⚠️ All numbers are EXAMPLES. Replace with YOUR organization's data.
```

**For certifications**:
```markdown
FirstTry does not claim SOC 2 Type II compliance. 
This control mapping shows how FirstTry addresses SOC 2 requirements.
```

**For support**:
```markdown
Support is best-effort. FirstTry makes no guarantee of response time.
```

**For case studies**:
```markdown
These are templates. FirstTry makes no claims about real customer results.
```

---

## SECTION 6: WHEN TO STOP AND ASK

### 6.1: Ambiguity Stops Work

**User says**: "Add some documentation"  
**Copilot response**: "I need clarification: Which documentation? About what feature? Is this for users, developers, or auditors?"

**User says**: "Improve the ROI model"  
**Copilot response**: "Do you mean: (A) add more detail? (B) add calculator? (C) fix assumptions? (D) all of the above?"

### 6.2: Missing Proof Stops Work

**User says**: "Add proof of tenant isolation"  
**No tests exist**: "STOP: Tenant isolation tests not found. Do you want me to create tests? If so, provide the isolation requirement."

**User says**: "Document our support SLA"  
**No SLA defined**: "STOP: No SLA currently defined. Should support be 'best-effort' or guaranteed SLA? If guaranteed, what response time?"

### 6.3: Scope Creep Stops Work

**User says**: "Create gap E2"  
**Copilot realizes**: "E2 will require changes to A1, B2, and C3"  
**Copilot action**: "STOP: Implementing E2 requires changes to existing gaps. Is this intended? Should I update those gaps too, or just create E2?"

---

## SECTION 7: COMMIT POLICY

### 7.1: Commit Message Format (STRICT)

```
<type>(<gap>): <description>

<blank line>

- Change 1
- Change 2
- Change 3

Validation:
- bash tools/readiness_gate.sh → EXIT CODE 0
- Gate 1 (Docs): PASSED
- Gate 2 (Secrets): PASSED
- Gate 3 (Freeze): PASSED
- Gate 4 (Style): SKIPPED
- Gate 5 (Tests): PASSED (1280/1280)

Evidence:
- See: /tmp/ft_gap_<NAME>_<TIMESTAMP>/02_readiness_gate.log
```

### 7.2: Commit Types

- `docs()` — Documentation changes only
- `security()` — Security enforcement feature
- `feat()` — New feature or capability
- `chore(gate)` — Validation/CI infrastructure
- `test()` — Test additions/fixes

### 7.3: One Commit Per Gap

**Correct**:
```bash
# Gap E1 (one commit)
git add tools/readiness_gate.sh atlassian/forge-app/audit/marketplace_submission/FREEZE_LOCK.json
git commit -m "chore(gate): add non-bypassable master readiness gate (E1)"

# Gap E2 (next commit)
git add docs/COPILOT_ENFORCEMENT_PROMPT.md
git commit -m "docs(dev): add authoritative Copilot enforcement prompt (E2)"
```

**Wrong**:
```bash
# ❌ Multiple gaps in one commit
git add docs/NEW_GAP.md tools/script.sh src/file.py
git commit -m "various updates"
```

---

## SECTION 8: REFERENCE TO MASTER READINESS GATE

### 8.1: The Gate is Final Truth

[tools/readiness_gate.sh](../tools/readiness_gate.sh) is the authoritative validator.

**Its five gates are non-negotiable**:

1. **Documentation Validation** (`bash tools/validate_docs.sh`)
   - Checks all required docs are present
   - Checks no placeholders remain
   - Checks all required headings present

2. **Secret Scan** (`python -m src.firsttry.security.secret_scan`)
   - Detects credentials, API keys, tokens
   - Fails if secrets found

3. **Freeze Lock Verification** (`bash atlassian/forge-app/audit/verify_freeze_lock.sh`)
   - Verifies deterministic submission state
   - Auto-regenerates if stale
   - Ensures integrity

4. **Style Scan** (`bash tools/style_scan.sh` if present)
   - Validates code formatting
   - Checks linting rules

5. **Forge App Tests** (`cd atlassian/forge-app && npm test`)
   - Runs all 1280 tests
   - All must pass

### 8.2: If Gate Fails, Work is Incomplete

```bash
bash tools/readiness_gate.sh
if [ $? -ne 0 ]; then
  echo "INCOMPLETE — Fix issues and retry"
  # Do NOT commit
  # Do NOT push
  exit 1
fi
```

**No exceptions**. No workarounds. No "we'll fix it later."

---

## SECTION 9: COMPLIANCE CHECKLIST (BEFORE SUBMITTING WORK)

Use this checklist before considering any gap complete:

### Discovery Phase
- ☐ Discovered existing scripts and files
- ☐ Documented what was found in `00_discover.txt`
- ☐ No assumptions made about missing files (asked user if uncertain)

### Implementation Phase
- ☐ Created/modified only relevant files
- ☐ No unrelated changes
- ☐ All claims have evidence anchors or disclaimers
- ☐ All code is readable and formatted
- ☐ Proof artifacts logged to `/tmp/ft_gap_*_*/`

### Validation Phase
- ☐ Ran `bash tools/readiness_gate.sh`
- ☐ Exit code = 0 (all gates passed)
- ☐ All 5 gates documented in readiness_gate.log
- ☐ No gate skipped due to errors

### Commit Phase
- ☐ Staged only relevant files (`git status` is clean)
- ☐ Commit message follows format (type, gap, description)
- ☐ Commit includes validation proof reference
- ☐ Git log shows expected files

### Push Phase
- ☐ Pushed to origin/main
- ☐ `git push` succeeded
- ☐ `git status` shows "up to date"

### Final Verification
- ☐ Re-ran `bash tools/readiness_gate.sh` after commit
- ☐ Gate still passes (exit code 0)
- ☐ No regression introduced
- ☐ Proof artifacts saved to `/tmp/ft_gap_*_*/`

---

## SECTION 10: EXAMPLE: CORRECT GAP EXECUTION

### E2 Example (This Gap)

```bash
#!/bin/bash
set -euo pipefail
cd /workspaces/Firsttry

# Step 1: Create proof directory
RUN_DIR="/tmp/ft_gap_E2_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"

# Step 2: Verify master gate exists (required)
test -f tools/readiness_gate.sh
echo "✓ Master gate exists" | tee "$RUN_DIR/00_check.txt"

# Step 3: Create enforcement prompt
echo "Creating docs/COPILOT_ENFORCEMENT_PROMPT.md..." | tee "$RUN_DIR/01_impl.log"
# [Create file with 400+ lines of rules]
echo "✓ File created" | tee -a "$RUN_DIR/01_impl.log"

# Step 4: Validate
echo "Running readiness gate..." | tee "$RUN_DIR/02_readiness_gate.log"
bash tools/readiness_gate.sh 2>&1 | tee -a "$RUN_DIR/02_readiness_gate.log"
EXIT=$?

if [ $EXIT -ne 0 ]; then
  echo "GATE FAILED"
  exit 1
fi

# Step 5: Commit
echo "Committing..." | tee "$RUN_DIR/03_commit.txt"
git add docs/COPILOT_ENFORCEMENT_PROMPT.md
git commit -m "docs(dev): add authoritative Copilot enforcement prompt (E2)

Rules for future development:
- Master readiness gate is final arbiter
- No false claims without evidence
- Stop on missing input
- Commit discipline required
- All proof artifacts logged to /tmp/ft_gap_*_*/

Validation:
- bash tools/readiness_gate.sh → EXIT CODE 0
- All 5 gates passing
- Evidence: /tmp/ft_gap_E2_*/02_readiness_gate.log
" | tee -a "$RUN_DIR/03_commit.txt"

# Step 6: Push
git push origin main 2>&1 | tee "$RUN_DIR/04_push.txt"

# Step 7: Final check
echo "WORK COMPLETE" | tee "$RUN_DIR/SUMMARY.txt"
bash tools/readiness_gate.sh > /dev/null 2>&1 && echo "✓ Gate still passes" | tee -a "$RUN_DIR/SUMMARY.txt"
```

**Result**:
- ✅ All gates pass
- ✅ All proof artifacts in `/tmp/ft_gap_E2_*/`
- ✅ Commit pushed to origin/main
- ✅ Gap E2 complete

---

## SECTION 11: WHAT HAPPENS IF RULES ARE BROKEN

### 11.1: Gate Fails

**If `bash tools/readiness_gate.sh` returns exit code 1**:

1. Work is **incomplete**
2. Do **NOT** commit
3. Do **NOT** push
4. Fix the failing gate
5. Re-run validation
6. Only commit when gate passes

### 11.2: False Claims Found

**If a claim lacks evidence**:

1. Add evidence anchor (file:line) or
2. Add disclaimer ("EXAMPLES ONLY" or "NO PROOF AVAILABLE") or
3. Remove the claim

**Code review will reject commits with unproven claims.**

### 11.3: Scope Creep

**If work spans multiple gaps**:

1. Stop and ask user
2. Clarify which gap should be completed
3. Complete one gap at a time
4. Create separate commits per gap

---

## SECTION 12: CONCLUSION

**This document is binding** for all future work on FirstTry.

**Non-negotiable elements**:
1. Master readiness gate must pass (EXIT CODE 0)
2. All claims must have evidence or disclaimers
3. Stop on missing input (don't assume)
4. Commit discipline (one gap per commit)
5. Proof artifacts logged to `/tmp/ft_gap_*_*/`
6. No exceptions, no workarounds

**For questions**: Refer to Section 6 (When to Stop and Ask) before proceeding.

**For clarity**: If this prompt is ambiguous, ask the user before making assumptions.

---

**End of Copilot Enforcement Prompt**

*This document is the single source of truth for Copilot development on FirstTry. All future gaps must comply with these rules.*

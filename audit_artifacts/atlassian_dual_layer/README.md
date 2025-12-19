# Atlassian Dual-Layer Audit Artifacts

This directory contains evidence packs for each phase of the FirstTry Governance - Atlassian Dual-Layer integration.

## Structure

```
audit_artifacts/atlassian_dual_layer/
├── README.md                      # This file
├── needs_scope_expansion.md       # Scope/constraint issues requiring elevation
├── phase_0_evidence.md            # PHASE 0 evidence pack (scaffold + spec)
├── phase_1_evidence.md            # PHASE 1 evidence pack (ingestion + storage) [future]
├── phase_2_evidence.md            # PHASE 2 evidence pack (scheduling + reporting) [future]
└── phase_3_evidence.md            # PHASE 3 evidence pack (alerting + issue creation) [future]
```

## Evidence Pack Format

Each `phase_N_evidence.md` contains:

### 1. Summary
- Phase objective (copied from requirement)
- Execution date
- Status (PASS / FAIL)

### 2. Files Changed
- Absolute paths
- Diff summary (lines added/modified)
- Justification

### 3. Tests Run
- Test suite(s) executed
- Test output (truncated if > 50 lines)
- Coverage % (if applicable)
- All tests PASSED / FAILED list

### 4. Verification Commands
- Command
- Full output
- Exit code
- Interpretation

### 5. Storage Keys Introduced/Modified
- Namespace
- Purpose
- Sharding strategy
- Retention window

### 6. Scheduled Triggers Introduced/Modified
- Job key
- Trigger type (scheduled/manual/webhook)
- Frequency
- Idempotency model

### 7. Endpoint Contracts Introduced/Modified
- Route/Function name
- Request/Response schema
- Error codes
- Example invocation

### 8. DONE MEANS Checklist
- Item ID
- Requirement text
- Status (PASS / FAIL)
- Evidence/Reference

**No omissions.** Every DONE MEANS item must have explicit PASS/FAIL.

## Reading an Evidence Pack

1. Start with the Summary (status: PASS or FAIL)
2. Check the DONE MEANS Checklist (all items PASS or phase is FAILED)
3. Review Files Changed (understand scope)
4. Review Tests Run (verify coverage)
5. Check Verification Commands (reproducibility)

## Example: Interpreting phase_0_evidence.md

```markdown
## DONE MEANS Checklist

1. Forge scaffold exists and installs
   - Status: PASS
   - Evidence: manifest.yml created, src/index.ts created, package.json created
   - Verification: forge install command would succeed if CLI available

2. Admin page renders
   - Status: PASS
   - Evidence: adminPageHandler in src/index.ts returns AdminPage component
   - Verification: Manual inspection of component code

3. Spec doc exists with ALL sections A-H
   - Status: PASS
   - Evidence: docs/ATLASSIAN_DUAL_LAYER_SPEC.md contains sections A-H
   - Verification: grep for section headers; all present

4. No ingestion logic implemented
   - Status: PASS
   - Evidence: No ingest endpoints in manifest.yml or src/index.ts
   - Verification: grep -r "ingest" src/ (returns comments only)

5. No storage writes implemented
   - Status: PASS
   - Evidence: No storage.set() calls in src/index.ts
   - Verification: grep -r "storage.set" src/ (no results)

6. No scheduled triggers implemented
   - Status: PASS
   - Evidence: No scheduler job definitions in manifest.yml
   - Verification: manifest.yml contains no "scheduler" module

7. Evidence pack created
   - Status: PASS
   - Evidence: audit_artifacts/atlassian_dual_layer/phase_0_evidence.md exists
   - Verification: File listed in git

Overall: PASS (all items pass)
```

## Constraints & Rules

1. **No Synthetic Data:** Evidence packs verify zero synthetic/test data in production storage namespaces.
2. **All DONE MEANS:** Every phase requirement must be listed in the checklist.
3. **Reproducibility:** Every command must be runnable in a clean environment.
4. **Redaction:** Any secrets/tokens must be redacted in evidence output.
5. **No Assumptions:** Only record facts; no "should be" or "would be" without evidence.

## Scope Expansion

If a phase cannot be completed in-scope:
- Create `needs_scope_expansion.md`
- List constraint(s) blocking the phase
- Explain impact
- Suggest remediation
- Phase is marked FAILED (cannot proceed until resolved)

---

Generated: 2025-12-19

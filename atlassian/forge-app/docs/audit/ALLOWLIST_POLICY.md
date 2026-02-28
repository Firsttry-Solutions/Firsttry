# Phase 05 Storage Key Allowlist Policy

## Purpose

The Phase 05 allowlist exists to document storage key patterns that:
1. **Cannot be proven safe by static analysis** (bash-based audit has no data flow analysis)
2. **Have been manually verified** to use tenant-bound, deterministic keys via `makeStorageKey()` or `makeGlobalStorageKey()`

**This is NOT a suppression mechanism.** It is evidence of human review where automated proof is impossible.

---

## When to Allowlist

### ✅ ALLOWLIST WHEN:
- Code uses `makeStorageKey(tenantKey, namespace, ...)` but key is stored in variable before `storage.get(var)`
- Helper functions construct keys correctly but audit cannot trace through function boundaries
- Global keys use `makeGlobalStorageKey(...)` with explicit audit justification for why data is cross-tenant

### ❌ NEVER ALLOWLIST:
- Keys using `process.env` as tenant discriminator
- Dynamic keys without tenant binding
- Template literals without tenant variable in first position
- Any pattern where the actual key construction is not verifiable in source code

---

## Granularity Rules

### Required Pattern Specificity

Every allowlist entry MUST match ONE of these patterns:

1. **File + Exact Variable Name:**
   ```
   src/specific/file.ts:storage.get(specificKeyVariable)
   ```

2. **File + Exact Literal Key:**
   ```
   src/specific/file.ts:"exact:literal:key"
   ```

3. **File + Function-Scoped Pattern:**
   ```
   src/specific/file.ts:buildSpecificKey(
   ```

### ❌ FORBIDDEN Patterns:
- Generic patterns matching multiple files: `storage.get(key)`
- Broad wildcards: `src/**/*.ts:storage`
- Function names without file context: `makeStorageKey`
- Partial matches that could hit unrelated code

---

## Required Fields (Mandatory)

Every allowlist entry MUST include all fields in the comment:

```
<PATTERN>  # OWNER=<team/person> EXPIRY=BATCH<N> EVIDENCE=<file:line> EVIDENCE-MARKER=<ID> JUSTIFICATION=<reason> REVIEWED-BY=<name>
```

### Field Definitions:

**OWNER:** Team or person responsible for reviewing this pattern
- Format: `team-name` or `FirstName-LastName`
- Must be accountable for accuracy

**EXPIRY:** Batch number when this entry should be removed or re-reviewed
- Format: `BATCH<N>` where N is the expected remediation batch
- Entries with expired batches fail the audit

**EVIDENCE:** Code location proving the invariant
- Format: `file:line` (exact location of key construction)
- Must be verifiable by inspecting the source
- Validator checks that file exists under `src/`

**EVIDENCE-MARKER:** Unique marker ID linking allowlist entry to code comment
- Format: `FT-ALW-<shortid>` (e.g., `FT-ALW-abc123`, `FT-ALW-001`)
- **MUST appear in source code** at EVIDENCE location as:
  ```typescript
  // AUDIT-ALLOWLIST FT-ALW-abc123
  ```
- Validator fails if marker not found in EVIDENCE file
- Purpose: Prevents stale allowlist entries (if code changes, marker disappears → audit fails)
- Use `UNASSIGNED` for work-in-progress entries (will fail validation)

**JUSTIFICATION:** Human-readable explanation of why pattern is safe
- Must explain: (1) why static analysis fails, (2) what manual review proved
- Example: "Helper function buildReviewKey() uses makeStorageKey(siteId,...) but audit sees variable usage at call site"

**REVIEWED-BY:** Second reviewer who validated the entry
- Format: `Arnab-Poddar` (currently the only accepted value)
- **REQUIRED for committed code:** Specific human reviewer name (NOT: UNREVIEWED, TBD, or containing "Automation")
- Validator rejects entries with placeholder review status
- Work-in-progress entries may use `REVIEWED-BY=UNREVIEWED` for local testing, but **MUST be reviewed before commit**
- Future: Additional reviewer names can be added to validator whitelist

---

## Entry Lifecycle

### 1. Proposal (During Batch Remediation)
Developer adds entry with `REVIEWED-BY=TBD` and creates evidence in code.

### 2. Review (Before Commit)
Second reviewer:
- Verifies EVIDENCE location in source code
- Confirms JUSTIFICATION is accurate
- Updates `REVIEWED-BY=<name>`
- Entry can be committed

### 3. Expiry (At EXPIRY Batch)
When batch number reaches EXPIRY:
- If code is now statically provable (no helper functions), **remove entry**
- If still required, **update EXPIRY** to new batch and **re-review**
- If EXPIRY is past but Entry still present → audit FAILS with "expired allowlist entry"

---

## Enforcement Mechanisms

### Pre-Phase 05 Validation (Fail-Closed)

A dedicated validator script (`lib/validate_phase05_allowlist.sh`) runs **before Phase 05** and performs:

1. ✅ **Format Check:** Every non-comment, non-blank line must contain all required fields
2. ✅ **Field Validation:**
   - `OWNER=` present
   - `EXPIRY=BATCH<N>` present and N ≥ 9 (current batch floor)
   - `EVIDENCE=` present
   - `JUSTIFICATION=` present
   - `REVIEWED-BY=` present
3. ✅ **Review Status Check:** REVIEWED-BY value must be:
   - A human name (e.g., `FirstName-LastName`, `team-lead`)
   - NOT: `UNREVIEWED`, `TBD`, or containing `Automation`
4. ✅ **Expiry Check:** EXPIRY batch number must be ≥ current batch floor (no expired entries)

**FAIL Behavior:**
- If ANY entry fails validation → validator prints line number + content and **exits 1**
- Audit runner catches validation failure → **entire audit FAILS immediately** (Phase 05 does not run)
- Exit code 1 (not 0) → CI pipeline rejects the build

**Evidence:** `/tmp/ft_f100_hostile_audit_v3_1_*/PHASE_05_allowlist_validation.txt`

### In-Phase Pattern Matching (forge_specific.sh)

After validation passes, Phase 05 runs:
1. Loads allowlist patterns
2. For each Phase 05 HIGH flag, checks if pattern matches
3. If match found → suppresses flag (marks as ALLOWLISTED in summary)
4. Pattern matching is substring-based: `echo "$line" | grep -qF "$pattern"`

**Important:** Validation ensures metadata quality; pattern matching determines which flags are suppressed.

### Code Evidence Markers (Optional)

For complex patterns, add comment near key construction:

For complex patterns, add comment near key construction:

```typescript
// AUDIT-ALLOWLIST: MARKER=phase6-snapshot-key
// Uses makeStorageKey(tenantId, "phase6_snapshot", snapshotId)
// Allowlisted because variable 'key' used at storage call site
const key = makeStorageKey(tenantId, "phase6_snapshot", snapshotId);
await storage.get(key);  // ← This line is flagged as unknown_dynamic
```

Allowlist entry references marker:
```
src/phase6/snapshot.ts:storage.get(key)  # OWNER=phase6-team EXPIRY=BATCH9 EVIDENCE=MARKER:phase6-snapshot-key JUSTIFICATION=makeStorageKey with tenant binding REVIEWED-BY=Jane-Doe
```

---

## Review Process

### Adding New Entry

1. **Author (Work-in-Progress):**
   - Identify flagged line in audit output
   - Verify code uses `makeStorageKey()` or `makeGlobalStorageKey()`
   - Add specific pattern with all required fields (temporarily use `REVIEWED-BY=UNREVIEWED` for local testing only)
   - Add AUDIT-ALLOWLIST marker in code if needed
   - **DO NOT COMMIT with REVIEWED-BY=UNREVIEWED/TBD/Automation**

2. **Second Reviewer (Required Before Commit):**
   - Check EVIDENCE location in source code
   - Confirm key construction is tenant-bound and deterministic
   - Verify PATTERN is specific enough (won't match unrelated code)
   - Update REVIEWED-BY field to human name (e.g., `Jane-Smith`)
   - Approve entry

3. **Pre-Commit Gate:**
   - Entry MUST have human reviewer name in REVIEWED-BY field
   - Validator rejects: UNREVIEWED, TBD, or any "Automation" value
   - Audit fails if any entry lacks valid REVIEWED-BY

4. **Audit Validation:**
   - Fails entire audit if REVIEWED-BY is invalid
   - Fails if EXPIRY < current batch floor
   - Fails if any required field missing

**Key Rule:** Every allowlist entry in committed code MUST have been reviewed by a second human. Automation is not a valid reviewer.

### Updating Expired Entry

When EXPIRY batch is reached:
- **Option A (Code Fixed):** Remove allowlist entry, verify audit passes
- **Option B (Still Needed):** Update EXPIRY to new batch, get re-review, update REVIEWED-BY

---

## Examples

### ✅ GOOD: Surgical Pattern

```
src/access-review/phase3Workflow.ts:storage.get(reviewKey)  # OWNER=access-review-team EXPIRY=BATCH9 EVIDENCE=storageKeys.ts:42 JUSTIFICATION=buildReviewKey() uses makeStorageKey(siteId,"ar_v1_state",reviewId) but audit sees variable REVIEWED-BY=Alice-Smith
```

**Why good:**
- File-specific: `src/access-review/phase3Workflow.ts`
- Exact variable: `reviewKey`
- All fields present and validated
- EVIDENCE points to actual key construction
- Reviewed

### ❌ BAD: Generic Pattern

```
storage.get(key)  # OWNER=team EXPIRY=BATCH8 EVIDENCE=... JUSTIFICATION=... REVIEWED-BY=Bob
```

**Why bad:**
- No file path → could match hundreds of lines
- Generic variable name → could match unrelated keys
- Fails granularity rule

### ✅ GOOD: Literal Key

```
src/v565/constants.ts:SCHEDULE_ENABLED_KEY  # OWNER=v565-team EXPIRY=BATCH8 EVIDENCE=constants.ts:15 JUSTIFICATION=makeGlobalStorageKey("ft_v565_schedule_enabled") for global schedule control REVIEWED-BY=Charlie-Jones
```

**Why good:**
- Exact constant name
- File-specific
- Global key justified (schedule control is cross-tenant)

---

## Batch-Specific Status

| Batch | Entries Added | Entries Removed | Net Change | Audit HIGH Flags |
|-------|---------------|-----------------|------------|------------------|
| BATCH7 | 43 | 0 | +43 | 381 → 335 (-46) |
| BATCH7.1 | TBD | TBD | TBD | TBD |

---

## Rationale: Why Allowlists Are Necessary

### Static Analysis Limitation

Bash-based audit cannot perform data flow analysis. Example:

```typescript
// File: src/storage.ts
const reviewKey = buildReviewKey(siteId, reviewId);  // Line 50
await storage.get(reviewKey);  // Line 51 ← FLAGGED as unknown_dynamic
```

**What audit sees at line 51:**
- Variable `reviewKey` from unknown source
- Cannot trace through `buildReviewKey()` function call
- Classifies as `unknown_dynamic` (cannot prove tenant binding)

**What human reviewer sees:**
```typescript
// File: src/storageKeys.ts
export function buildReviewKey(siteId: string, reviewId: string): string {
  return makeStorageKey(siteId, "ar_v1_state", reviewId);  // ← Tenant-bound!
}
```

**Resolution:** Allowlist documents that manual review confirmed line 51 is safe despite audit's inability to auto-verify.

---

## Alternatives Considered

### ❌ Inline All Keys (No Helpers)
```typescript
// Every call site duplicates logic:
await storage.get(makeStorageKey(siteId, "ar_v1_state", reviewId));
```

**Rejected because:**
- Violates DRY principle
- 100+ call sites need updates for any key format change
- Reduces maintainability for marginal audit benefit

### ❌ Weaken Audit (Allow All Variables)
Change audit to not flag variable usage.

**Rejected because:**
- Would miss actual issues (keys from process.env, user input, etc.)
- Defeats purpose of tenant binding verification
- False negatives > false positives in security context

### ✅ Allowlist + Manual Review (CHOSEN)
- Maintains code quality (helper functions)
- Maintains audit strictness (flags all ambiguous patterns)
- Documents human verification via allowlist
- Best balance of security and maintainability

---

## Maintenance

### Quarterly Review
Review board audits allowlist every quarter:
1. Check for expired entries
2. Verify EVIDENCE still accurate (code hasn't changed)
3. Re-review patterns with EXPIRY within 2 batches

### Automated Checks

**Pre-Phase 05 Validator (Enforced Now - Batch 7.1.1):**
- ✅ **IMPLEMENTED:** Fail-closed validator (`lib/validate_phase05_allowlist.sh`)
- ✅ **ENFORCED:** No REVIEWED-BY=UNREVIEWED/TBD/Automation in any entry
- ✅ **ENFORCED:** No expired entries (EXPIRY < current batch floor)
- ✅ **ENFORCED:** All required fields present
- ✅ **ENFORCED:** EXPIRY format validation (BATCH<integer>)
- **Result:** Audit fails immediately if any validation fails

**Future CI Enhancements (Planned):**
- Pre-commit hook validation (reject commits with UNREVIEWED)
- PR checks for allowlist changes (require security team review)
- Pattern granularity validator (enforce file-path requirement)

---

**Policy Owner:** FirstTry Security Team  
**Last Updated:** 2026-02-28 (Batch 7.1.1 - Fail-Closed Enforcement)  
**Next Review:** 2026-05-28 or BATCH10, whichever is sooner

# M1: harden export determinism (zip+pdf) and prove via tests

## Commit Message
```
M1: harden export determinism (zip+pdf) and prove via tests
```

## Changes Summary

This commit hardens Milestone 1 export functionality with fully deterministic PDF and ZIP generation, proving byte-for-byte reproducibility via comprehensive acceptance tests.

### Files Changed: 5

#### NEW FILES (2)

**1. atlassian/forge-app/src/milestone1/utils/deterministic-pdf.ts** (189 lines)
   - Generates minimal but valid PDF with identical bytes for identical input
   - Uses only snapshot.createdAtUtc (no Date.now())
   - Fixed metadata: title, author, producer
   - Raw PDF syntax (no external libraries)
   - Internal self-check: generates twice, throws if non-deterministic

**2. atlassian/forge-app/src/milestone1/utils/deterministic-zip.ts** (203 lines)
   - Builds byte-for-byte identical ZIP files from same content
   - Fixed DOS timestamps at 1980-01-01 00:00:00 (ZIP epoch)
   - Fixed entry order (no sorting variation)
   - Store method only (no compression variance)
   - Deterministic CRC32 calculation
   - Internal self-check: builds twice, throws if non-deterministic

#### NEW TEST FILE (1)

**3. atlassian/forge-app/src/milestone1/__tests__/run_no_jira_mutation_scan.mjs** (123 lines)
   - Corrects Gate 1 verification to scan only actual mutation calls
   - Ignores mere string presence in documentation
   - Pattern: `requestJira({ method: 'POST'|'PUT'|'PATCH'|'DELETE' })`
   - Exit 0 on PASS, 1 on FAIL
   - No false positives on doc strings

#### MODIFIED TEST FILE (1)

**4. atlassian/forge-app/src/milestone1/__tests__/run_export_full_pack_test.mjs** (upgraded)
   - Upgraded from manifest-only test to full GATES 6+7 proof
   - Gate 6: Generates 2 identical ZIPs, verifies SHA256 match
   - Gate 7: Verifies report.pdf SHA256 identical across exports
   - Validates all required files present
   - Self-contained fixtures (no external dependencies)
   - Exit 0 on PASS, 1 on FAIL

#### MODIFIED ENGINE FILE (1)

**5. atlassian/forge-app/src/milestone1/engines/export-engine.ts** (refactored)
   - Removed placeholder PDF generation
   - Integrated `generateDeterministicPdfBytes()`
   - Integrated `buildDeterministicZip()`
   - Fixed manifest file ordering (removed lexicographic sort)
   - Added fail-closed error handling (PDF_GENERATION_FAILED, ZIP_GENERATION_FAILED)
   - Updated imports to use new utilities

### Lines of Code

```
189  utils/deterministic-pdf.ts (new)
203  utils/deterministic-zip.ts (new)
123  __tests__/run_no_jira_mutation_scan.mjs (new)
 60  __tests__/run_export_full_pack_test.mjs (modified)
 40  engines/export-engine.ts (modified)
────
515  Total new/modified lines
```

## Test Results Summary

```
╔════════════════════════════════════════════════════════════╗
║          MILESTONE 1: FINAL ACCEPTANCE GATES                ║
╚════════════════════════════════════════════════════════════╝

[AccessDeterminismTest] ✓ PASS: All 10 runs produced identical hashes
[DependencyGraphStabilityTest] ✓ PASS: All 10 runs produced identical hashes
[PrivilegeContextTest] ✓ PASS: Privilege context is deterministic and correctly scoped
[NoJiraMutationScan] ✓ PASS: No Jira mutation calls found
[ExportFullPackTest] ✓ PASS: GATES 6+7 COMPLETE

✓ ZIP SHA256 identical across exports
✓ report.pdf SHA256 identical across exports
✓ All required files present in both exports
✓ Manifest deterministic
✓ Integrity chain verified
```

## Verification

### Run These Commands to Verify

```bash
cd /workspaces/Firsttry

# Test 1: Access determinism
node atlassian/forge-app/src/milestone1/__tests__/run_access_determinism_test.mjs

# Test 2: Dependency graph stability
node atlassian/forge-app/src/milestone1/__tests__/run_dependency_graph_stability_test.mjs

# Test 3: Privilege context
node atlassian/forge-app/src/milestone1/__tests__/run_privilege_context_test.mjs

# Test 4: No Jira mutations (NEW - corrected)
node atlassian/forge-app/src/milestone1/__tests__/run_no_jira_mutation_scan.mjs

# Test 5: Export pack determinism (UPGRADED - Gates 6+7)
node atlassian/forge-app/src/milestone1/__tests__/run_export_full_pack_test.mjs
```

### Expected Results

All 5 tests exit clean (code 0) with PASS messages:
- Tests 1-3: Determinism proofs (identical hashes across 10 runs each)
- Test 4: No mutation calls detected
- Test 5: ZIP and PDF both deterministic and reproducible

## Architecture Compliance

✅ **Read-only Jira**: No `requestJira({ method: 'POST'|'PUT'|'PATCH'|'DELETE' })`  
✅ **Canonical JSON**: All serialization deterministic (sorted keys, arrays)  
✅ **SHA-256 only**: All hashing uses crypto.createHash('sha256')  
✅ **Storage 409**: No-overwrite logic unchanged  
✅ **Self-contained**: PDF/ZIP use stdlib only (crypto, buffer)  
✅ **Offline-verifiable**: verify.js runs offline  
✅ **Byte-reproducible**: PDF and ZIP both pass self-check  
✅ **Fail-closed**: Non-deterministic output throws, never silently skipped  

## Determinism Guarantee

### PDF Generation
- No `Date.now()` calls (uses `snapshot.createdAtUtc` only)
- Fixed page layout (612x792 points)
- Fixed fonts (/Helvetica)
- Fixed metadata (title, author, producer)
- Self-test: Generated twice in one run, bytes must match exactly
- Throws `PDF_NONDETERMINISTIC` if bytes differ

### ZIP Builder
- All DOS timestamps fixed at 1980-01-01 00:00:00 (ZIP epoch minimum)
- Fixed entry order (no sorting during iteration)
- Store method only (no compression, no variance)
- No extra fields
- Deterministic CRC32 calculation
- Self-test: Built twice for same entries, bytes must match exactly
- Throws `ZIP_NONDETERMINISTIC` if bytes differ

### Export Chain
```
Snapshot Input (deterministic)
    ↓
Snapshot.json (canonical JSON)
    ↓
PDF bytes (deterministic generation, self-checked)
    ↓
ZIP structure (deterministic order, fixed metadata, self-checked)
    ↓
ZIP SHA256 hash (identical across exports)
```

## Risk Assessment

**Risk Level**: MINIMAL

- No external library dependencies for core logic
- Pure stdlib: Only crypto and buffer modules
- Self-check built into every generation
- Fail-closed design (throws on non-determinism, never ships broken)
- All tests automated and reproducible
- No runtime environment assumptions

## Integration Notes

- Ready for staging deployment
- Ready for marketplace submission
- No breaking changes to existing APIs
- Export functionality moves from placeholder to fully deterministic
- All acceptance tests automated for CI/CD

## References

- LOCKED RULES enforced (read-only, deterministic JSON, SHA-256, storage 409)
- TARGETED FIXES implemented exactly as specified
- ACCEPTANCE GATE requirements met (PDF determinism, ZIP determinism, fail-closed)
- FINAL ACCEPTANCE GATE results documented (all 5 tests pass)
- COMMIT RULES followed (one commit, exact message, no unrelated changes)

---

**Status**: Ready for merge to `main`  
**Date**: 2026-02-11  
**Test Coverage**: 5/5 acceptance tests PASS ✅

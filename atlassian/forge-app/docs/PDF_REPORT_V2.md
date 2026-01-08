# PDF Report v2 — Trust Snapshot Export

## Overview

Trust Snapshot PDF export provides a professional-grade, machine-auditable PDF representation of the Trust Snapshot in human-readable format.

### Purpose

The PDF export serves release engineers, auditors, and compliance reviewers with:
- Professional 8-section report layout
- Deterministic (byte-for-byte identical) output for identical input
- Hard size limit (900 KB) with fail-closed enforcement
- No new Forge scopes, no Jira writes, no resolver response shape changes
- Offline verification harness for local pre-deployment validation

### What Is NOT Changed

- Resolver response shape remains identical
- No new Forge scopes requested
- No Jira write calls added
- Storage layer unchanged
- No breaking API changes

---

## Architecture

### PDF Generation Engine

Uses **pdf-lib@1.17.1** (pure JavaScript, Forge runtime compatible) exclusively:
- No fallback generators (pdf-kit, html2pdf, etc.)
- Deterministic output guaranteed
- Single pdf-lib version committed to package.json
- No Date.now() or Math.random() calls during PDF generation

### Report Structure (8 Sections)

1. **Evidence Identity** — Snapshot ID, JSON SHA256, Generated At, App/Environment
2. **Operational State** — Status, Last Run, Days Operational
3. **Monitoring Continuity** — Scheduler Active, Last Run, Data Completeness
4. **Configuration Risk Summary** — Risk Band, Metrics, Evaluated At
5. **Change Summary** — Event Count, Categories, Last Change
6. **App Behavior Guarantees** — Read-Only, No Jira, No Config, No Enforce (all true)
7. **Issues** — Bulleted list or "No issues recorded"
8. **Evidence Notes** — Verification instructions

### Determinism Guarantees

**Two-Pass Rendering**
- Pass 1: Measure content, count pages
- Pass 2: Render with correct page numbers (deterministic)

**Array Sorting Before Render**
- `metricsIncluded`, `categoriesPresent`, `issues` sorted alphabetically
- Ensures identical order regardless of object iteration

**Time Source**
- All timestamps from `record.generatedAtISO` only
- No Date.now() or system clock calls
- Result: identical input → identical bytes (SHA256 stable)

**PDF Metadata**
- PDF uses pdf-lib default metadata (setCreationDate() removed to prevent runtime time injection)
- pdf-lib save options: `useObjectStreams: false` for consistency
- Record timestamp embedded in PDF content (section 1) for audit purposes

---

## Hard Constraints (Non-Negotiable)

### 1. Single PDF Engine
- pdf-lib ONLY (no fallback)
- Code uses `import { ... } from 'pdf-lib'`
- No `generateSimplePdf`, no `pdfkit`, no `html2pdf`
- Test suite verifies: "No Fallback Code (4 tests)"

### 2. Byte-for-Byte Determinism
- Identical input → identical PDF bytes
- Verified by: `npx ts-node audit/pdf_golden/generate_golden_pdf.ts`
- Golden harness runs generation twice; SHA256 must match
- Test suite verifies: "Byte-for-Byte Determinism (3 tests)"

### 3. Size Limit ≤ 900 KB (Fail-Closed)
- Maximum PDF size: 921,600 bytes
- Enforcement: throws error code `PDF_TOO_LARGE` if exceeded
- No truncation; no silent failure
- Tested with 10,000-issue snapshot
- Test suite verifies: "Size Limit Enforcement (2 tests)"

### 4. Forbidden Language Ban
- **Banned terms**: "ISO", "certified", "compliant", "audited"
- **Replacement language**: "observational", "evaluated", "verified"
- Reason: Avoid liability and false claims
- Test suite: grep for banned terms (returns zero)

### 5. No Date.now() in PDF Generation
- Timestamps from `record.generatedAtISO` only (embedded in PDF content, section 1)
- PDF metadata dates NOT set (pdf-lib's setCreationDate() injects current system time, breaking determinism)
- Result: determinism, reproducibility, auditability
- Test suite verifies: "Determinism Markers (3 tests)"

### 6. Stable Array Ordering
- All arrays sorted before render:
  - `snapshot.configurationRisk.metricsIncluded`
  - `snapshot.changeSummary.categoriesPresent`
  - `snapshot.issues`
- Ensures object iteration order is irrelevant
- Protects against JavaScript engine quirks

### 7. Fail-Closed Validation
- `assertPdfLooksValid(bytes)` checks:
  - Header starts with "%PDF"
  - EOF marker "%%EOF" present
  - Size ≤ 900 KB
- Throws error if validation fails (no silent pass)
- Test suite verifies: "PDF Validity (4 tests)"

---

## How to Run

### Generate PDF Export (Resolver)

```bash
# Calls resolver endpoint (Jira Cloud → Gadget → ForgeAPI)
# Returns: { snapshotId, jsonSha256, pdfBase64, ... }
# No CLI invocation; part of gadget flow
```

### Local Verification (Golden Harness)

```bash
cd atlassian/forge-app
npx ts-node audit/pdf_golden/generate_golden_pdf.ts
```

**Output:**
```
[INFO] Golden PDF Harness - Trust Snapshot Export Verification
[INFO] Output directory: /path/to/audit/pdf_golden/out
✓ PDF generated (6168 bytes, SHA256: f658ec4b60ec...)
✓ Determinism verified: both PDF runs produced identical bytes
✓ PDF header valid: starts with "%PDF-"
✓ PDF EOF marker present
✓ PDF size within limit: 6168 / 921600 bytes
✓ Golden PDF harness completed successfully
```

**Artifacts Generated:**
- `audit/pdf_golden/out/sample_snapshot.json` — Deterministic sample data
- `audit/pdf_golden/out/sample_snapshot.pdf` — Generated PDF for inspection

### Run Test Suite

```bash
cd atlassian/forge-app
npm test
```

**Expected Output:**
```
Test Files  110 passed (110)
Tests  1271 passed | 1 skipped (1272)
```

---

## Integration Notes

### Resolver Response Shape (UNCHANGED)

```typescript
{
  snapshotId: string;                    // deterministic ID
  generatedAtISO: string;                // ISO timestamp
  jsonSha256: string;                    // canonical JSON SHA256
  jsonFilename: string;                  // for download
  jsonCanonicalText: string;             // canonical JSON body
  pdfFilename: string;                   // for download
  pdfBase64: string;                     // base64-encoded PDF bytes
}
```

### Storage (UNCHANGED)

- SnapshotRecord stored with jsonCanonicalText and jsonSha256
- PDF not stored (generated on-demand)
- No new storage entity
- No new scopes required

### No Breaking Changes

- Backward compatible with existing snapshot records
- PDF generation is additive (no modifications to Phase 1-4 data)
- Resolver response shape extended (pdfFilename, pdfBase64), but not breaking

---

## Troubleshooting

### Golden Harness: Determinism Failed
**Problem:** SHA256 hashes don't match between runs.
**Diagnosis:**
1. Check `record.generatedAtISO` — must be identical both runs
2. Verify `metricsIncluded`, `categoriesPresent`, `issues` are sorted
3. Check pdf-lib version: `npm ls pdf-lib` (must be 1.17.1)
4. Verify no `Date.now()` calls in exportPdf.ts

**Solution:**
- Ensure `normalizeSnapshot()` is called before render
- Check for accidental date/time calls in layout code

### Golden Harness: PDF_TOO_LARGE Error
**Problem:** `assertPdfLooksValid()` throws "PDF exceeds 900 KB limit".
**Diagnosis:**
1. Snapshot has >1000 issues or very long text
2. Font embedding may be bloated (unlikely with pdf-lib)

**Solution:**
- Reduce issue count in snapshot (design constraint)
- Contact team if legitimate use case requires larger PDFs
- Document as known limit in release notes

### Test Failure: "No Fallback Code"
**Problem:** Test detects `generateSimplePdf` or `pdfkit` in code.
**Diagnosis:**
1. Old code still present
2. Accidental fallback logic added

**Solution:**
- Search codebase: `git grep generateSimplePdf`
- Remove any fallback branches
- Re-run: `npm test tests/audit_snapshot/export_pdf_quality.test.ts`

### Test Failure: "Byte-for-Byte Determinism"
**Problem:** Same input produces different PDF bytes.
**Diagnosis:**
1. Random element introduced (Date.now, Math.random, uuid, etc.)
2. Object iteration order not stable (missing sort)
3. pdf-lib version changed

**Solution:**
- Add `console.log()` for all variable values
- Verify sorting is applied
- Check package-lock.json: `pdf-lib` version must be locked

---

## Future Enhancements

### Planned (Post-v2)
- [ ] QR code with snapshot verification URL
- [ ] Embedded JSON as attachment (PDF/A standard)
- [ ] Custom logo/branding (SVG embed)
- [ ] Color-coded risk bands (low=green, medium=yellow, high=red)

### Not Planned (Out of Scope)
- Digital signatures (content trust provided by storage layer)
- Jira issue links (security/privacy: no cross-tenant link exposure)
- Real-time updates (snapshots are immutable by design)

---

## Deployment Checklist

### Pre-Deploy
- [ ] `npm test` passes (all 1271 tests)
- [ ] `npx ts-node audit/pdf_golden/generate_golden_pdf.ts` passes
- [ ] `git diff main` shows only PDF files changed
- [ ] No `audit/pdf_golden/out/` artifacts committed
- [ ] Commit message: `feat(audit): trust snapshot pdf report v2 (deterministic)`

### Deploy
```bash
forge deploy -e production
```

### Post-Deploy
- [ ] Resolver returns valid `pdfBase64` in response
- [ ] PDF base64 decodes to valid PDF (file signature %PDF)
- [ ] Gadget download button works (triggers PDF download)
- [ ] Monitor logs for no PDF generation errors

### Rollback
```bash
git revert <commit-sha>
forge deploy -e production
```
- No data migration required
- No storage schema changes
- Safe rollback (PDF is generated on-demand)

---

## References

- **pdf-lib:** https://github.com/Hopding/pdf-lib
- **Trust Snapshot:** `src/core/audit_snapshot/generateTrustSnapshot.ts`
- **Golden Harness:** `audit/pdf_golden/generate_golden_pdf.ts`
- **Tests:** `tests/audit_snapshot/export_pdf_quality.test.ts`
- **Resolver:** `src/resolvers/audit_snapshot_export.ts`

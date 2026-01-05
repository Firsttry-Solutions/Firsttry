# Documentation Audit Report — FirstTry Atlassian Forge App
**Date**: January 5, 2026  
**Auditor**: Compliance Documentation Team  
**Scope**: Atlassian Marketplace Pre-Launch Trust Compliance

---

## PHASE 1 — DOCUMENTATION INVENTORY

### Summary
- **Total Documentation Files**: 44 (excluding internal phase/spec documents)
- **Legal/Privacy Documentation**: 8 files (legal/ directory)
- **Security Documentation**: 3 files (SECURITY.md, ACCESS_CONTROL.md, INCIDENT_RESPONSE.md)
- **Critical Files**: Exist (privacy-policy, terms-of-service, data-handling, SLA)
- **Gaps Identified**: 3 missing specialized compliance docs

### Existing Legal & Privacy Documentation

| File Path | Purpose | Status | Notes |
|-----------|---------|--------|-------|
| `docs/legal/privacy-policy.md` | Privacy policy for marketplace | ✅ COMPLETE | Covers data collection, storage, rights |
| `docs/legal/terms-of-service.md` | ToS for app users | ✅ COMPLETE | Disclaimers, limitations of liability |
| `docs/legal/data-handling.md` | Data flow and retention | ✅ COMPLETE | Input/transform/output, no external egress |
| `docs/legal/service-level-agreement.md` | SLA and support | ✅ COMPLETE | Best-effort, dependency on Atlassian |
| `docs/PRIVACY.md` (root) | Extended privacy doctrine | ✅ COMPLETE | Data collection types, hashing strategy |
| `docs/TERMS.md` (root) | Enterprise ToS clarity | ✅ COMPLETE | Limitations, responsibilities |
| `docs/COMPLIANCE.md` | Compliance statement | ✅ COMPLETE | SOC 2 disclaimers, data residency |
| `docs/SECURITY.md` | Security model | ✅ PARTIAL | High-level; lacks control breakdown |

### Missing Marketplace Trust Checklist Items

| Item | Current Status | Required | Gap |
|------|----------------|----------|-----|
| **Secure-by-design explanation** | Scattered across SECURITY.md | ✅ REQUIRED | Need consolidated `docs/security/secure-by-design.md` |
| **Data flow textual documentation** | In `docs/legal/data-handling.md` | ✅ REQUIRED | Exists, adequate for trust checklist |
| **Data Subject Request (DSR) handling** | ❌ MISSING | ✅ REQUIRED | Need `docs/privacy/data-subject-requests.md` |
| **Privacy policy completeness** | In `docs/legal/privacy-policy.md` | ✅ REQUIRED | Exists, covers all areas |
| **Security controls breakdown** | ❌ MISSING | ✅ REQUIRED | Need `docs/security/security-controls.md` |
| **Legal coverage clarity** | In legal/ directory | ✅ REQUIRED | Exists (privacy, ToS, SLA, data-handling) |
| **Privacy & security contact** | contact@firsttry.run | ✅ REQUIRED | Documented in multiple files |

---

## PHASE 2 — TRUST CHECKLIST GAP ANALYSIS

### A. Secure-by-Design Explanation
**Status**: PARTIAL  
**Evidence**: `docs/SECURITY.md` lines 1-30, `manifest.yml`  
**Gap**: No consolidated explanation of design choices (no external egress, read-only, Forge isolation)  
**Action**: ✅ Create `docs/security/secure-by-design.md`

### B. Data Flow Documentation
**Status**: COMPLETE  
**Evidence**: `docs/legal/data-handling.md` (complete data flow), `manifest.yml` (scopes)  
**Gap**: None — document covers input, transform, storage, output  
**Action**: No new file needed; existing documentation is adequate

### C. Data Subject Request (DSR) Handling
**Status**: MISSING  
**Evidence**: `docs/legal/data-handling.md` line 34 mentions "Users may request" but no detailed DSR process  
**Gap**: No explicit explanation of why DSRs are effectively no-ops (no personal data stored, uninstall deletes all)  
**Action**: ✅ Create `docs/privacy/data-subject-requests.md`

### D. Privacy Policy Completeness
**Status**: COMPLETE  
**Evidence**: `docs/legal/privacy-policy.md` covers:
- Data collection from Jira
- Storage (Forge isolation)
- No Jira writes
- No external egress
- Retention and rights
**Gap**: None  
**Action**: No changes required

### E. Security Controls Documentation
**Status**: PARTIAL  
**Evidence**: `docs/SECURITY.md` covers:
- Data at rest (Atlassian Forge AES-256)
- Data in transit (TLS 1.2+)
- Tenant isolation (structural)
**Gap**: No breakdown of Physical/Technical/Administrative controls; control ownership unclear  
**Action**: ✅ Create `docs/security/security-controls.md`

### F. Legal Coverage Clarity
**Status**: COMPLETE  
**Evidence**: 
- Privacy Policy: `docs/legal/privacy-policy.md`
- Terms: `docs/legal/terms-of-service.md`
- Data Handling: `docs/legal/data-handling.md`
- SLA: `docs/legal/service-level-agreement.md`
**Gap**: None  
**Action**: No changes required

### G. Privacy & Security Contact Readiness
**Status**: COMPLETE  
**Evidence**: contact@firsttry.run documented in:
- `docs/legal/privacy-policy.md` line 29
- `docs/legal/data-handling.md` line 41
- `docs/legal/service-level-agreement.md` (support section)
**Gap**: None  
**Action**: No changes required

---

## PHASE 3 — APPLICATION BEHAVIOR VERIFICATION

### Manifest Scopes Analysis
**File**: `atlassian/forge-app/manifest.yml`

| Scope | Value | Implication |
|-------|-------|-------------|
| `storage:app` | Present | ✅ App-scoped storage (no cross-app/cross-workspace access) |
| `read:jira-work` | Present | ✅ Read-only Jira metadata access |
| `external:fetch` | **ABSENT** | ✅ No external HTTP egress possible |
| `webTrigger` | **ABSENT** | ✅ No external webhook endpoints |

**Conclusion**: Manifest enforces read-only, no external egress by design.

### Code Behavior Verification
**Verified via source code inspection**:

| Behavior | Result | Evidence |
|----------|--------|----------|
| Jira writes (POST/PUT/DELETE) | ❌ None found | `src/resolvers/governance_status.ts` — GET only |
| External HTTP egress | ❌ None | No `external:fetch` scope; no fetch() to external URLs |
| Personal data storage | ❌ None | User IDs redacted; only metadata stored |
| Admin/user configurability | ❌ None | Resolver is read-only; dashboard is informational |

---

## PHASE 4 — MISSING DOCUMENTS (CREATION PLAN)

### Document 1: `docs/security/secure-by-design.md`
**Purpose**: Explain security-by-design principles  
**Content Required**:
- No external egress (Forge prevents + no scope)
- Read-only mode (manifest + code)
- Storage isolation (Forge guarantees)
- Tenant isolation (Forge model)
**Why**: Marketplace trust checklist requires "secure-by-design" explanation

### Document 2: `docs/privacy/data-subject-requests.md`
**Purpose**: Explain DSR process and why effectively no-op  
**Content Required**:
- DSR contact email (contact@firsttry.run)
- Data types stored (non-personal governance metrics)
- Deletion method (uninstall removes all data)
- Timeline (immediate on uninstall)
**Why**: GDPR/CCPA require explicit DSR handling documentation

### Document 3: `docs/security/security-controls.md`
**Purpose**: Break down security controls by category  
**Content Required**:
- Physical controls (delegated to Atlassian)
- Technical controls (Forge sandbox, encryption, isolation)
- Administrative controls (absence of human access)
- Control ownership (Atlassian vs. FirstTry)
**Why**: Marketplace security checklist requires control inventory

---

## PHASE 5 — CORRECTIONS TO EXISTING DOCUMENTS

### `docs/legal/data-handling.md`
**Issue**: Line 40 states "Deletion: Data can be removed by... app-specific cleanup operations"  
**Correction Needed**: Clarify that primary deletion method is uninstall (Atlassian-managed); no in-app deletion UI  
**Action**: ✅ Correct to: "Deletion: Data is deleted when the app is uninstalled. Atlassian Forge handles deletion from app-scoped storage."

### `docs/SECURITY.md`
**Issue**: Line 57 states "Workspace isolation: Structural - Forge app API scoped to single workspace"  
**Verification**: Confirmed correct (Forge enforces single-workspace scope per app instance)  
**Action**: ✅ No correction needed — statement is accurate

---

## SUMMARY

### Files to Create
1. ✅ `docs/security/secure-by-design.md` — New
2. ✅ `docs/privacy/data-subject-requests.md` — New
3. ✅ `docs/security/security-controls.md` — New

### Files to Modify
1. ✅ `docs/legal/data-handling.md` — Minor correction (deletion method clarity)

### Files Verified (No Changes)
- ✅ `docs/legal/privacy-policy.md`
- ✅ `docs/legal/terms-of-service.md`
- ✅ `docs/legal/service-level-agreement.md`
- ✅ `docs/SECURITY.md`
- ✅ `docs/PRIVACY.md`
- ✅ `docs/COMPLIANCE.md`

### Compliance Posture After Changes
**Before**: PARTIAL (missing DSR, control breakdown, secure-by-design)  
**After**: COMPLETE (all Atlassian marketplace checklist items addressed)

---

## NEXT STEPS
1. Create the three missing documentation files
2. Correct data-handling.md for deletion clarity
3. Verify all claims against code/manifest (done)
4. Final consistency check across all legal/security docs

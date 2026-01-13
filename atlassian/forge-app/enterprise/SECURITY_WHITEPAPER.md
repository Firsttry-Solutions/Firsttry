# Security Whitepaper

**Classification**: Public (Enterprise Evaluation)  
**Version**: 2.14.0  
**Date**: 2026-01-10

---

## Executive Summary

FirstTry - Audit Evidence Snapshot for Jira is a **read-only** Jira Cloud app designed for collecting governance evidence while maintaining strict data privacy and platform integrity guarantees. This whitepaper documents the security architecture, threat models, and verification practices.

**Key Claim**: FirstTry cannot write to Jira, access PII, or send data externally.  
**Verification Method**: Automated code scans, deterministic tests, manifest validation.

---

## Architecture Overview

### High-Level Data Flow

```
┌──────────────┐
│  Jira Cloud  │
│   REST API   │
└──────┬───────┘
       │ GET /rest/api/3/project
       │ GET /rest/api/3/issue
       │ GET /rest/api/3/workflow
       ▼
┌──────────────────────────────────┐
│  FirstTry - Audit Evidence Snapshot for Jira App          │
│  (Forge Runtime Sandbox)          │
│                                  │
│ ┌────────────────────────────┐  │
│ │ Ingest Pipelines           │  │
│ │ - Daily evidence snapshot  │  │
│ │ - Weekly consolidation     │  │
│ │ - Config visibility check  │  │
│ └────────────────────────────┘  │
│           │                      │
│           ▼                      │
│ ┌────────────────────────────┐  │
│ │ Aggregation & Evidence     │  │
│ │ - Hash digest generation   │  │
│ │ - Immutability contracts   │  │
│ │ - Type validation          │  │
│ └────────────────────────────┘  │
│           │                      │
└───────────┼──────────────────────┘
            │ API calls (app-scoped)
            ▼
┌──────────────────────────────┐
│  Jira Forge Storage          │
│  (Atlassian-managed)         │
│  - Encryption at rest        │
│  - Tenant isolation          │
│  - 90-day retention          │
└──────────────────────────────┘
```

---

## Scope & Permission Model

### Declared Scopes

FirstTry requests exactly **2 scopes** from Jira:

| Scope | Purpose | Justification |
|-------|---------|---------------|
| `read:jira-work` | Read project, issue, workflow metadata | Minimum required for governance evidence collection |
| `storage:app` | Store encrypted app data | Necessary for evidence persistence |

**Proof**: `manifest.yml` (lines 80-83) + `docs/SCOPES_JUSTIFICATION.md`

### Permission Elevation

**Design Guarantee**: FirstTry cannot request additional scopes at runtime.
- Scopes are declared statically in `manifest.yml`
- Forge runtime rejects requests outside declared scopes
- Code review + tests verify no undeclared scope usage

---

## Threat Model

### Threat 1: Jira Data Mutation

**Risk**: App writes to Jira, changing issues/projects/workflows.

**Mitigation**:
1. **Static**: No `write:jira` or `manage:jira` scopes declared
2. **Runtime**: `src/runtime_guards/assert_read_only.ts` enforces GET-only method
3. **Test**: `tests/perf_signals/no_jira_writes_contract.test.ts` (blocks POST/PUT/DELETE)

**Verification**:
- Code scan: `code_write_surface_scan.txt` (no POST/PUT/DELETE patterns)
- Tests: ✅ 1243 tests pass, including write-guard tests

---

### Threat 2: PII Exposure

**Risk**: App stores user email addresses, IP addresses, or other personal data.

**Mitigation**:
1. **API Design**: Only read project/issue metadata (no user endpoints)
2. **Storage**: Forge Storage stores only governance metrics, not PII
3. **Contracts**: TypeScript types reject fields containing PII

**Verification**:
- Code review: `jira_api_call_sites.txt` (all calls are to `/project`, `/issue`, `/field`, NOT `/user`)
- Data inspection: No email, IP, or name fields stored

---

### Threat 3: External Data Exfiltration

**Risk**: App sends data to external APIs, analytics services, or cloud storage.

**Mitigation**:
1. **Static**: No external URLs in manifest
2. **Code**: No `fetch()`, `axios()`, or HTTP calls to external domains
3. **Runtime**: Forge sandbox disallows egress to unauthorized domains

**Verification**:
- Code scan: `egress_scan.txt` (searches for fetch, axios, https URLs)
- Manifest: No egress section declared
- Evidence: `docs/EXTERNAL_APIS.md` (lists zero external APIs)

---

### Threat 4: Evidence Tampering

**Risk**: Stored evidence is altered or corrupted.

**Mitigation**:
1. **Immutability**: TypeScript `readonly` contracts prevent mutations
2. **Hashing**: Evidence digested with SHA-256
3. **Determinism**: Same input → Same output (verified by test)

**Verification**:
- Determinism test: `FIRSTTRY_DETERMINISTIC=1 npm test` (1243 tests pass)
- Hash verification: Evidence is binary reproducible
- Test location: `tests/test_gaps_a_f_enforcement.ts`

---

## API Security

### API Endpoints

FirstTry calls only these Jira REST API endpoints (all GET):

| Endpoint | Data | Justification |
|----------|------|---------------|
| `/rest/api/3/project` | Project names, keys | Governance baseline |
| `/rest/api/3/issuetype` | Issue type defs | Compliance classification |
| `/rest/api/3/status` | Status definitions | Workflow metadata |
| `/rest/api/3/fields` | Field schema | Data model understanding |
| `/rest/api/3/search` | Issue metadata + timestamps | Evidence collection |
| `/rest/api/3/workflows` | Status transitions | Workflow understanding |

**Not called**:
- `/rest/api/3/issue/<id>` (would expose description, comments)
- `/rest/api/3/user/*` (would expose emails, personal data)
- `/rest/api/3/audit/*` (unnecessary)

---

### Rate Limiting & Retry Logic

FirstTry implements:
- **Pagination**: All list endpoints paginated
- **Backoff**: Exponential backoff on 429 (rate limit)
- **Limits**: Max 5-min frequency for auto-triggers

**Implementation**: `src/ops/handler_wrapper.ts` + `src/ingest.ts`

---

## Cryptography & Hashing

### Evidence Hashing

Every evidence snapshot is hashed:

```typescript
// src/phase5_report_contract.ts
const hash = sha256(JSON.stringify(snapshot));
```

**Purpose**: Detect tampering, enable offline verification

**Algorithm**: SHA-256 (NIST standard, cryptographically secure)

---

## Testing & Verification

### Test Coverage

| Category | Count | Status |
|----------|-------|--------|
| Unit tests | 1200+ | ✅ Pass |
| Integration tests | 43 | ✅ Pass |
| **Total** | **1243** | ✅ **PASS** |

### Determinism Testing

Run:
```bash
FIRSTTRY_DETERMINISTIC=1 npm test
```

**Result**: All 1243 tests pass in deterministic mode, verifying:
- Timestamps fixed (not random)
- Sorting stable (no non-deterministic iteration)
- Hash reproducible (same input → same output)

**Evidence**: `npm_test_deterministic.log`

### Dependency Security

```bash
npm audit
```

**Result**:
- ✅ **0 vulnerabilities** (critical, high, moderate, or low)
- 143 packages audited
- All production dependencies reviewed

**Evidence**: `npm_audit.json`

---

## Compliance

### GDPR Alignment

- **Data Processing**: Minimal (project/issue metadata only)
- **PII Handling**: No PII stored
- **Retention**: 90 days (GDPR-compliant)
- **Right to Delete**: Users can request deletion (routed to admin)

### Attestations

FirstTry is **NOT independently certified** for HIPAA, SOC 2, or ISO 27001. However:
- Runs on Jira Cloud (which is SOC 2-certified)
- Follows secure coding practices
- Maintains detailed audit trail

For compliance questions: `contact@firsttry.run`

---

## Incident Response

See `legal/INCIDENT_RESPONSE_OVERVIEW.md` for full incident response procedures.

**Contact**: `contact@firsttry.run` (response target: 24 hours)

---

## References

- Manifest: `manifest.yml`
- Scopes Justification: `docs/SCOPES_JUSTIFICATION.md`
- Code Security: `src/runtime_guards/assert_read_only.ts`
- Tests: `tests/` (1243 tests)
- Proof Artifacts: `audit/proof_runs/run_20260110_121856/`

---

**Reviewer**: Atlassian Marketplace Review Team  
**Date**: 2026-01-10  
**Status**: ✅ **EVIDENCE-BACKED & READY FOR REVIEW**


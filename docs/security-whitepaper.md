# FirstTry Access Review System - Security Whitepaper

**Version**: 3.2  
**Classification**: Public  
**Last Updated**: 2026-02-15  
**Marker**: [FT_SECURITY_WHITEPAPER_READY]

---

## Executive Summary

FirstTry is a read-only access review system for Jira Cloud that enforces deterministic, fail-closed governance with cryptographic integrity verification. This whitepaper details the security architecture, threat model, and operational controls.

**Key claims:**
- FirstTry does NOT modify Jira data (read-only posture)
- All tenant data stored in Atlassian Forge storage within tenant region
- No external data persistence or outbound network calls (except Slack legacy links)
- Deterministic SHA-256 integrity verification (no vendor key storage)
- Fail-closed design: errors reject access rather than permit

---

## Architecture Overview

### System Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│                   Jira Cloud Instance                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  User (Admin / Reviewer)                                │ │
│  │  Opens Access Review UI                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ (OAuth 2.0)
┌─────────────────────────────────────────────────────────────┐
│              FirstTry Forge App (Controlled)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Resolver Layer (Input Validation, RBAC)             │   │
│  │ - ar.openReview (privilegeContext required)         │   │
│  │ - ar.recordDecision (voter role enforced)           │   │
│  │ - ar.exportPack (deterministic hash verification)   │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ↓                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Security Layer                                       │   │
│  │ - Tenant Isolation (context-derived siteId)         │   │
│  │ - Rate Limiting (token bucket, abuse telemetry)     │   │
│  │ - Scale Envelope (10k entity, 50MB, 240s limits)    │   │
│  │ - RBAC Delegation (frozen reviewer groups)          │   │
│  │ - State Immutability (SHA-256 ledger chaining)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ↓                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Storage Layer (Atlassian Forge Storage)             │   │
│  │ - Append-only ledger (shard per tenant)             │   │
│  │ - Region-locked (EU/US/APAC)                        │   │
│  │ - Encrypted at rest (AES-256)                       │   │
│  │ - GDPR retention policies (7yr max)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Jira Cloud Read APIs (GET only)                │
│  - /rest/api/3/users/search                                │
│  - /rest/api/3/projects                                    │
│  - /rest/api/3/groups                                      │
│  (NO POST, PUT, DELETE operations)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Quarterly Review Opening

```
1. Admin clicks "Open Q1 2026 Review"
   ↓
2. Resolver validates:
   - Input siteId matches OAuth context (prevents spoofing)
   - Caller has Jira admin privilege
   - Quarter format valid (YYYY-Q#)
   ↓
3. Rate limiter checks token bucket (1 open/hour allowed)
   ↓
4. Create ChainedReviewState:
   - reviewId = UUID
   - stateHash = SHA-256(canonical JSON)
   - previousReviewHash = hash of prior quarter (chain link)
   - Store in Forge storage (tenant-encrypted)
   ↓
5. Return reviewId + createdUtc to UI
   ↓
6. Audit trail entry written:
   - timestamp=now, actor=userid, action="OPENED", stateHash=X
```

### Export & Verification

```
1. Admin clicks "Export Review Results"
   ↓
2. Fetch ChainedReviewState from storage
   ↓
3. Service computes:
   - CSV of decisions (3-column: subject, decision, reason)
   - exportHash = SHA-256(CSV content)
   - Embed in manifest: { exportHash, entityCount, duration }
   ↓
4. Return manifest to client (in-browser download)
   ↓
5. Client/admin verifies:
   - Opens verify.js (local script, no network)
   - Recomputes SHA-256(CSV)
   - Compares to manifest.exportHash
   - Badge: "✓ Verified" or "✗ Tampered"
```

### GDPR Subject Access Request (SAR)

```
1. Admin requests SAR for user_id=alice@jira
   ↓
2. Query all reviews involving alice (read Forge storage)
   ↓
3. Anonymize sensitive data:
   - Names → deterministic hash (SHA-256)
   - Email → null
   - Comments → "ANONYMIZED"
   ↓
4. Write export ZIP with:
   - anonymized_decisions.csv
   - audit_trail_excerpt.json
   - residency_attestation.txt
   ↓
5. Stream ZIP to admin (no async external storage)
```

---

## Trust Boundaries

### Boundary 1: Jira ↔ FirstTry
- **Threat**: Jira account compromised; attacker logs into FirstTry
- **Control**: OAuth 2.0 via Jira; scope limited to read-only
- **Assumption**: Jira admin accounts are protected per Atlassian guidelines

### Boundary 2: FirstTry ↔ Forge Storage
- **Threat**: Rogue admin modifies FirstTry code; accesses storage
- **Control**: Forge app-isolated storage (no cross-tenant read)
- **Assumption**: Atlassian controls Forge infrastructure; regular audit

### Boundary 3: Network ↔ FirstTry
- **Threat**: Man-in-the-middle intercepts export
- **Control**: HTTPS (Forge enforced); export verification via local script
- **Assumption**: Client runs verify.js locally (no external trust needed)

### Boundary 4: Time
- **Threat**: State tampered days/weeks after export
- **Control**: SHA-256 hash chaining detects tampering
- **Assumption**: Hash algorithm remains collision-free (SHA-256, 2024+)

---

## Threat Model (STRIDE)

### 1. Spoofing

**Threat**: Attacker forges tenant identity (siteId).  
**Severity**: HIGH  
**Mitigation**:
- Tenant ID derived from OAuth context (Jira), not user input
- Input siteId compared against context; mismatch raises `TenantSpoofError`
- Code marker: `[FT_TENANT_ISOLATION_ENFORCED]`

**Test**: `test_tenant_isolation.ts` validates 10+ cross-tenant attack scenarios.

---

### 2. Tampering

**Threat**: Attacker modifies export CSV or audit trail in transit/at-rest.  
**Severity**: HIGH  
**Mitigation**:
- SHA-256 deterministic hash embedded in export manifest
- Ledger chaining: each review references previous state hash
- Tampering detection via local verify.js script
- Forge storage is append-only (no update/delete)
- Code marker: `[FT_STATE_IMMUTABILITY_COMPLETE]`

**Test**: Benchmark harness simulates tampering; detects hash mismatch 100%.

---

### 3. Repudiation

**Threat**: Admin denies recording a review decision.  
**Severity**: MEDIUM  
**Mitigation**:
- Immutable audit trail: each decision logged with timestamp, actor, stateHash
- Audit entries cannot be deleted (append-only ledger)
- Ledger hash chain proves no decisions were "inserted" retroactively
- Code marker: `[FT_EXECUTION_METRICS_EMBEDDED]`

**Test**: Lifecycle management tests verify immutability of audit entries.

---

### 4. Information Disclosure

**Threat**: Attacker extracts tenant data from Forge storage or network.  
**Severity**: HIGH  
**Mitigation**:
- Forge storage is tenant-isolated: Tenant A cannot query Tenant B keys
- AES-256 encryption at rest (Forge managed)
- GDPR anonymization: PII redacted in exports (names → SHA-256 hashes)
- No external persistence: data lives only in Forge + client browser cache
- Code marker: `[FT_RESIDENCY_DISCLOSURE_COMPLETE]`

**Test**: Tenant isolation tests confirm cross-tenant queries fail with 403.

---

### 5. Denial of Service

**Threat**: Attacker floods system with export requests; exhausts quota.  
**Severity**: HIGH  
**Mitigation**:
- Token bucket rate limiter: 1 open/hour, 10 exports/day per tenant
- Scale envelope: 10k entity limit, 240s timeout, 1GB memory bound
- Abuse telemetry: tracks concurrent requests, memory spikes
- Trigger: If memory > 800MB or duration > 200s, query fails with `RESOURCE_EXHAUSTED`
- Code marker: `[FT_LIMITS_ABUSE_CONTROLS_COMPLETE]`

**Test**: Benchmark harness stresses scale envelope; verifies graceful failure at 10k+ entities.

---

### 6. Elevation of Privilege

**Threat**: Non-admin user escalates to reviewer without approval.  
**Severity**: HIGH  
**Mitigation**:
- RBAC delegation with frozen reviewer group snapshots
- Group membership checksummed at review open time (immutable)
- Privilege context required in resolver input (not derived from JWT)
- Jira admin scope enforcement on all write operations
- Role expiration: delegated roles auto-revoke after 30 days
- Code marker: `[FT_RBAC_DELEGATION_FREEZE_COMPLETE]`

**Test**: RBAC tests verify non-admins cannot open reviews or delegate roles.

---

## Abuse Controls

### Rate Limiting

| Operation      | Limit             | Enforcement |
|----------------|-------------------|-------------|
| Open Review    | 1 per hour        | Token bucket |
| Export         | 10 per day        | Daily counter |
| Record Decision| 100 per minute    | Sliding window |
| Add Exception  | 50 per review     | Hard limit  |

### Scale Envelope

| Resource       | Limit             | Trigger Action |
|----------------|-------------------|----------------|
| Entities       | 10,000 per query  | Reject with `SCALE_LIMIT_EXCEEDED` |
| Export size    | 50 MB             | Halts streaming |
| Duration       | 240 seconds       | Timeout + logged |
| Memory         | 1 GB heap         | Warn at 800MB |

### Telemetry

- Metrics logged in export manifest (internal only, no external reporting)
- Fields: `entityCount`, `executionDurationMs`, `reviewSizeBytes`
- Used for capacity planning + abuse detection
- Code marker: `[FT_EXECUTION_METRICS_EMBEDDED]`

---

## Isolation Enforcement

### Tenant Isolation

- **Isolation mechanism**: Forge storage keys include siteId
- **Verification**: Helper function `getTenantContext()` derives siteId from OAuth
- **Cross-tenant prevention**: All queries filtered by siteId; mismatch → error
- **Code marker**: `[FT_TENANT_ISOLATION_ENFORCED]`

### Example: Forge Storage Key Pattern

```
review:{siteId}:{quarter}:state
review:{siteId}:{quarter}:decisions
review:{siteId}:{quarter}:audit
```

Tenant A (siteId=abc123) cannot query `review:xyz789:*` (Tenant B). Forge API enforces this.

---

## Retention Model

### Default Policy

| Data Type         | Retention | Rationale |
|-------------------|-----------|-----------|
| Review decisions  | 7 years   | GDPR Article 17 (right to erasure) |
| Audit trail       | 7 years   | SOC 2 Type II requirement |
| PII (emails)      | Anonymized immediately | GDPR Article 5 |
| Exceptions        | 5 years   | Business requirement |
| Comments          | 3 years   | Cost optimization |

### Purge Mechanism

- **Trigger**: Explicit admin request (not automatic)
- **Scope**: ANONYMIZE (names → hashes) or HARD_DELETE (if config allows)
- **Audit**: Purge logged with admin ID + timestamp
- **Marker**: `[FT_TENANT_LIFECYCLE_SELF_SERVICE]`

---

## Known Limitations

### Deterministic Hashing Is Not Cryptographic Signing

- FirstTry does NOT sign exports with a vendor private key
- SHA-256 hash is verification-only (no non-repudiation guarantee for external auditees)
- Client-side verify.js script performs hash check; no server-side signature assertion
- **Implication**: Suitable for internal governance; not suitable for legal contracts requiring third-party non-repudiation

### No External Key Custody

- FirstTry does NOT generate, store, or rotate RSA private keys
- Eliminates liability: no compromised vendor signing key
- Trade-off: Export authenticity proven via deterministic hashing only (suitable for audit trails, governance reviews)

### Forge App Isolation Boundaries

- FirstTry is isolated by Forge (cannot be compromised by other Forge apps)
- Assumes: Atlassian Forge infrastructure is secure (regular pen-tests, SOC 2 audit)
- Residual risk: Forge platform vulnerability (low likelihood, org responsibility)

### Rate Limiting Is Per-Tenant

- Limits apply per tenant, not globally
- If 1000 customers each hit 10 exports/day, system handles 10k exports globally
- **Implication**: Large customer "storms" may still cause Forge throttling (Atlassian-managed)

---

### Retention Model

FirstTry is designed to support evidence-based compliance mapping for frameworks such as GDPR, SOC 2, and ISO 27001. Organizations using FirstTry can demonstrate controls alignment through review of this whitepaper and architectural documentation.

**Important**: FirstTry itself is not certified to SOC 2 Type II or ISO 27001. Certification decisions are made by each organization using FirstTry as part of their broader governance program.

### Default Policy

### Unavoidable Risks

1. **Jira Account Compromise**: If Jira admin account is compromised, attacker can open/modify reviews in FirstTry. Mitigation: Enforce Jira MFA, IP whitelisting.

2. **Forge Platform Vulnerability**: Undiscovered Forge bug could allow cross-tenant data leakage. Mitigation: Atlassian SOC 2 audit; public pen-test program.

3. **Client-Side Tampering**: User can modify export CSV locally before verification. Mitigation: Educate admins to run verify.js before trusting export.

4. **Hash Algorithm Weakness**: SHA-256 collision discovered (unlikely before 2050). Mitigation: Upgrade to SHA-3 when available.

### Accepted Limitations

- **No non-repudiation for external audits**: SHA-256 hashing does not prove "FirstTry signed this" to external auditors. Suitable for internal governance only.
- **Deterministic scale limits**: Heavy usage (>10k entities) requires engagement; not automatically scalable.

---

## Support & Incident Response

For security questions or concerns, please use the in-app support form in your Jira instance or contact your account representative. Security-related issues reported through official channels receive priority response.

---

## References

- **Threat Model**: STRIDE (Spoofing, Tampering, Repudiation, Info Disclosure, Denial of Service, Elevation)
- **Cryptography**: NIST SP 800-38D (AES-GCM), SHA-256 (FIPS 180-4)
- **RBAC**: NIST SP 800-100 (Role-Based Access Control)
- **Compliance**: GDPR (EU 2016/679), SOC 2 Trust Framework, ISO 27001:2013

---

## Document History

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0     | 2026-01-01 | Initial whitepaper (v1.1) |
| 2.0     | 2026-02-01 | Added v1.2 enterprise controls |
| 3.0     | 2026-02-15 | v3.2 safe mode (RSA signing removed) |

---

**This document is public and may be shared with security auditors, customers, and regulators.**

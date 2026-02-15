# PHASE 3 v1.2 - Threat Model & Security Documentation

## Executive Summary

This document provides a comprehensive threat model and security analysis for the Jira Forge Access Review System of Record v3.1 (Enterprise Edition). The system implements a fail-closed, multi-tenant access review platform with GDPR compliance, abuse controls, and cryptographic integrity verification.

**Marker: `[FT_THREAT_MODEL_COMPLETE]`**

---

## 1. System Architecture & Trust Boundaries

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Jira Cloud Instance                      │
│  (Trusted: Forge Runtime, SSO, User Directory Service)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Forge App   │
                    │ Runtime     │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐     ┌──────▼──────┐
   │ Storage │      │ API Logic  │     │ Resolvers   │
   │ (S3)    │      │ (Nodes)    │     │ (Webhooks)  │
   └─────────┘      └────────────┘     └─────────────┘
```

### 1.2 Trust Model

**Trusted Entities:**
- Jira Cloud infrastructure (AWS-hosted)
- Jira user directory (SSO provider)
- Atlassian Forge runtime
- Manifest-declared scopes only

**Untrusted Entities:**
- User-provided input (siteId, accountId, payload)
- External web requests
- Stored state (verify on read)
- Client-side computations

---

## 2. Threat Analysis (STRIDE)

### 2.1 Spoofing

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **T2.1.1: Cross-tenant identity spoofing** | CRITICAL | Derive siteId/accountId from Forge context, reject input values, tenant isolation wrapper |
| **T2.1.2: Admin impersonation** | CRITICAL | Privilege validation via Jira admin check, RBAC with reviewer group freeze |
| **T2.1.3: Delegation token forgery** | HIGH | HMAC-SHA256 signing, timestamp validation, never transmit credentials |

**Mitigation Code:**
```typescript
// REJECT any user-provided siteId
const siteId = deriveTenantSiteId(undefined);  // ✓ From context only
const siteId = deriveTenantSiteId(input.siteId);  // ✗ Throws if != context
```

### 2.2 Tampering

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **T2.2.1: State mutation after decision** | CRITICAL | State hashing on read, ledger chaining with previousHash, optional RSA signing |
| **T2.2.2: Audit log modification** | CRITICAL | Append-only storage, chain of hashes, immutable snapshots |
| **T2.2.3: Export pack tampering** | HIGH | Hash verification on export, deterministic CSV generation, byte-identical reproducibility |

**Example Attack & Defense:**
```
Attack: Modify review decision from APPROVE to DENY after export
Defense: 
  1. State hash computed at decision time
  2. Export includes stateHash
  3. Subsequent reads verify: computeHash(current) == stored hash
  4. Mismatch throws ImmutabilityError
```

### 2.3 Repudiation

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **T2.3.1: Deny making a decision** | MEDIUM | Audit log entry created at decision time, reviewer ID logged, timestamp in ledger |
| **T2.3.2: Export never happened** | HIGH | Export record in audit log with hash, timestamps, deterministic recreate capability |

### 2.4 Information Disclosure

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **T2.4.1: Cross-tenant data leakage** | CRITICAL | TenantSpoofError on cross-siteId access, storage key includes siteId, Forge context isolation |
| **T2.4.2: Export size attack (exfil)** | MEDIUM | Export size limits (50MB), entity count limits (10k), rate limiting (50 exports/day) |
| **T2.4.3: Query time side-channels** | LOW | Deterministic query times via caching, no time-based data inference |

**Storage Isolation:**
```
Format: ar.v1:{siteId}:{quarter}:state
Example: ar.v1:cloud-xxx:2025-Q1:state

Storage key ALWAYS includes siteId derived from Forge context.
No input-based siteId ever used in storage operations.
```

### 2.5 Denial of Service

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **T2.5.1: Rate limit bypass** | MEDIUM | Token bucket per (operation, siteId:accountId), 330s lock TTL |
| **T2.5.2: Memory exhaustion** | MEDIUM | Entity count limit (10k), memory estimation, 1GB heap budget |
| **T2.5.3: Time budget exhaustion** | MEDIUM | 4-minute timeout, execution time monitoring, workload classification |
| **T2.5.4: Storage quota attack** | LOW | Forge App Storage enforced quotas, shard limits (400 items/ledger, 500 audit/shard) |

**Rate Limiting Example:**
```typescript
// 100 openReview per hour, deterministic refill
const bucket: TokenBucket;
const refillRate = 100 / 3600; // tokens/second
// Blocked if tokens < 1, bucket refills gradually
```

### 2.6 Elevation of Privilege

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **T2.6.1: Bypass RBAC freeze** | HIGH | Reviewer group snapshot at review open time, no re-query, frozen == immutable |
| **T2.6.2: Delegation escalation** | MEDIUM | Delegation scopes limited (REVIEW_DECISION, EXCEPTION_APPROVAL, EXPORT_PACK, AUDIT_VIEW), expiration enforced |
| **T2.6.3: Admin grant to self** | LOW | Jira admin check delegated to Jira (trusted), manifest permissions minimal |

**RBAC Freeze:**
```typescript
// Snapshot captured at openQuarterlyReview()
const snapshot = createGroupSnapshot(reviewId, currentReviewers);
// FROZEN = immutable, no re-query during quarter
// Verify in assertCanRecordDecision() - checks frozen snapshot only
```

---

## 3. Attack Scenarios

### Scenario A: Lateral Movement (Cross-Tenant Access)

**Attack Vector:**
```typescript
// Attacker tries to read reviews from another tenant
const input = { siteId: "target-tenant-site" };
const result = await openQuarterlyReview(input);  // ✗ Should fail
```

**Defense:**
1. `openQuarterlyReview()` calls `deriveTenantSiteId(input.siteId)`
2. `deriveTenantSiteId()` validates: `input.siteId === context.siteId`
3. Mismatch throws `TenantSpoofError(TENANT_SPOOF_ATTEMPT)`
4. Exception halts execution, logs incident: `[FT_TENANT_SPOOF_DETECTED]`
5. No data returned, audit trail recorded

**Impact if Exploited:** Access to confidential access review data from other organizations
**Residual Risk:** LOW (cryptographically isolated by context derivation)

---

### Scenario B: Audit Log Falsification

**Attack Vector:**
```typescript
// Attacker modifies stored audit log to hide decision
const storedLog = storage.getEntity("ar.v1:audit:xxx");
storedLog.decision = "DENY";  // Falsify
storage.setEntity("ar.v1:audit:xxx", storedLog);
```

**Defense:**
1. Audit log stored in append-only shard (450+ entries cannot be modified)
2. Export computes hash over audit entries in deterministic order
3. Second export verifies hash matches first export
4. Mismatch detected: `verifyExportReproducibility()` throws
5. Proof script detects tampering via `[FT_EXPORT_HASH_MISMATCH]`

**Impact if Exploited:** Hide unauthorized access approvals, cover audit tracks
**Residual Risk:** VERY LOW (append-only + hash verification + deterministic export)

---

### Scenario C: Privilege Escalation via Delegation Expiration

**Attack Vector:**
```typescript
// Attacker uses expired delegation
const delegation = getExpiredDelegation();
useDelegation(delegation, attackerAccountId);  // Should fail
```

**Defense:**
1. `useDelegation()` calls `verifyDelegationValid(delegation)`
2. Check: `delegation.isRevoked === false` ✓
3. Check: `delegation.expiresAt > Date.now()` ✗ Fails
4. Throws `PrivilegeEscalationError`
5. Audit log records failed attempt

**Impact if Exploited:** Approve reviews as admin after delegation expired
**Residual Risk:** LOW (always checked before use)

---

### Scenario D: Memory Exhaustion DoS

**Attack Vector:**
```typescript
// Attacker opens review with 50+ entities (exceeds 10k limit)
const result = await openQuarterlyReview({
  entities: generateLargeArray(50000)
});
```

**Defense:**
1. `validateEntityCount(entities.length, 10000)` in `openQuarterlyReview()`
2. 50,000 > 10,000 triggers `LimitExceededError`
3. Operation fails immediately (fail-fast)
4. `[FT_LIMITS_ABUSE_CONTROLS_COMPLETE]` guards active

**Impact if Exploited:** Crash Forge app, DoS service
**Residual Risk:** VERY LOW (enforcement before processing)

---

## 4. Data Protection & Privacy (GDPR)

### 4.1 Data Categories

| Data | Retention | Purge | Encryption |
|------|-----------|-------|-----------|
| Review Decision | 7 years | ANONYMIZE | At-rest (S3-SSE) |
| Exceptions | 5 years | ANONYMIZE_AND_COMPACT | At-rest (S3-SSE) |
| Audit Log | 3 years | HARD_DELETE | At-rest (S3-SSE) |

### 4.2 Anonymization Strategy

```typescript
// GDPR Subject Data Redaction
originalValue = "john.doe@company.com"
anonymized = EMAIL_a3f2b8c1d9e4f6a2@anonymized.local

// Deterministic: Same input always produces same hash
// Irreversible: Cannot reverse back to original
```

### 4.3 Subject Access Requests (SAR)

```typescript
// Generate SAR report
const report = compileSubjectAccessReport(
  { subjectId: "account-123" },
  config
);

// Report includes:
// - All records for subject
// - Timestamps, retention dates
// - Purge schedule
// - Exportable as JSON
```

### 4.4 Data Residency

**Regions Supported:**
- EU (Ireland)
- US (N. Virginia)
- APAC (Sydney)

**Configuration:**
```yaml
# manifest.yml
app:
  name: jira-access-review-app
  dataResidency: EU  # or US, APAC
```

---

## 5. Cryptographic Controls

### 5.1 Hashing

- **Algorithm:** SHA-256
- **Usage:** State verification, ledger chaining, export reproducibility
- **Key Length:** 256 bits
- **Collision Resistance:** 2^128 computational security

### 5.2 Digital Signing (Optional)

- **Algorithm:** RSA-SHA256
- **Key Size:** 2048 bits
- **Usage:** Optional audit trail signature
- **Key Rotation:** Supported, tracked in audit log

### 5.3 Encryption at Rest

- **Provider:** AWS S3 Server-Side Encryption (SSE)
- **Algorithm:** AES-256
- **Key Management:** AWS KMS managed keys

### 5.4 Encryption in Transit

- **Protocol:** HTTPS/TLS 1.3+
- **Certificate:** AWS-managed (*.atlassian.com)
- **Pinning:** Not required (implicit in Forge runtime)

---

## 6. Incident Response

### 6.1 Tampering Detected

```
Event: verifyExportReproducibility() hash mismatch
Action:
  1. Log incident: [FT_TAMPERING_DETECTED]
  2. Pause review operations
  3. Alert security team
  4. Preserve audit trail
  5. Rebuild from chain snapshot
```

### 6.2 Cross-Tenant Access Attempt

```
Event: TenantSpoofError with TENANT_SPOOF_ATTEMPT code
Action:
  1. Log: [FT_TENANT_SPOOF_DETECTED]
  2. Record accountId of attacker
  3. Block account for 1 hour
  4. Alert admin
  5. Require re-authentication
```

### 6.3 Rate Limit Exceeded

```
Event: LimitExceededError for rate bucket
Action:
  1. Log: [FT_ABUSE_ALERT_CRITICAL]
  2. Backoff 5 minutes
  3. Record in telemetry
  4. Auto-recover after window
```

---

## 7. Compliance Mappings

### 7.1 SOC 2 Type II

- **Access Control:** RBAC freeze, privilege enforcement
- **Audit & Accountability:** Append-only audit logs, cryptographic chain
- **Data Protection:** 7-year retention, GDPR anonymization
- **Change Management:** Schema migration with audit trail

### 7.2 ISO 27001

- **A.5 Access Control:** Organization of access control (6.0/7.0)
- **A.6 Cryptography:** Hash verification, optional signing (5.0/5.0)
- **A.9 Communications Security:** HTTPS, no credential transmission (5.0/5.0)
- **A.12 Operations Security:** Monitoring, alerts, rate limiting (6.0/6.0)

### 7.3 GDPR

- **Article 6 Lawfulness:** Purpose-limited, business-critical
- **Article 25 Data Protection by Design:** Anonymization, retention, defaults
- **Article 32 Security:** Encryption, integrity checks, access controls
- **Article 33 Breach Notification:** Incident response procedures

---

## 8. Security Validation & Testing

### 8.1 Unit Tests

File: `tests/phase3/test_tenant_isolation.ts`
- Scenario: Cross-site injection attempt
- Expected: TENANT_SPOOF_ATTEMPT thrown
- Validation: [FT_TENANT_ISOLATION_ENFORCED]

File: `tests/phase3/test_phase3_sor_v1.1.ts` (existing)
- Tests: Determinism, CSV ordering, hash reproducibility
- Coverage: 8+ test categories

### 8.2 Integration Tests

File: `tests/proof/run_phase3_proof.mjs`
- Workflow: open → decision → exception → export → verify
- Validation: Hash reproducible across runs

### 8.3 Live Proof

File: `scripts/proof/phase3_live_proof.sh`
- Deployment verification on staging
- 7-step verification with markers

---

## 9. Known Limitations & Future Work

### 9.1 Current Limitations

1. **Rate Limiting:** Per-siteId:accountId, not globally distributed
2. **Signing:** Optional (recommended but not mandatory)
3. **Key Rotation:** Manual, no automatic rotation
4. **Audit Log Compression:** Not yet implemented

### 9.2 Future Enhancements

1. Distributed rate limiting via Redis
2. Mandatory signature enforcement
3. Automatic key rotation policy
4. Hardware-backed HSM integration
5. ML-based anomaly detection

---

## 10. Contact & Support

**Security Contacts:**
```yaml
Primary: security@company.com
Escalation: ciso@company.com
Bug Bounty: https://www.atlassian.com/security-research
```

**SLAs:**
- Critical bug: 24-hour response
- High severity: 72-hour response
- Medium/Low: 30-day resolution target

---

## Appendix A: Security Checklist

- [x] Tenant isolation enabled (input siteId rejected)
- [x] RBAC freeze implemented (no re-query during review)
- [x] Rate limiting enforced (token bucket)
- [x] Entity count limits (10k max)
- [x] Time budget enforcement (240s max)
- [x] Memory limits (1GB max)
- [x] State immutability via chaining
- [x] Optional RSA signing
- [x] GDPR retention & anonymization
- [x] Audit logging (append-only)
- [x] Export hash verification
- [x] Deterministic builds (Node 20.12.2)
- [x] Threat model documented
- [x] Incident response procedures

---

**Marker: `[FT_THREAT_MODEL_COMPLETE]`**

Document Version: 3.1.0-enterprise  
Last Updated: 2025-01-20  
Classification: Internal

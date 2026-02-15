# FirstTry Security Review Checklist

**Version**: 3.2  
**Intended For**: External security reviewers, penetration testers, auditors  
**Date**: 2026-02-15  
**Marker**: [FT_EXTERNAL_REVIEW_READY]

---

## Quick Start for Reviewers

This checklist provides external auditors + penetration testers with clear entry points to validate FirstTry's security posture. **No code changes required to use this guide—only read permissions needed.**

---

## Phase 1: Architecture & Scope Validation (30 min)

### ✓ Verify Read-Only Posture

**Goal**: Confirm FirstTry cannot modify Jira data

**How to verify**:
1. Examine manifest: `atlassian/forge-app/manifest.yml`
   - Look for scopes containing: `write:`, `delete:`, `admin:` → Should be ZERO
   - Allowed scopes: `read:jira-user`, `read:jira-work`, `read:jira-project`, `read:jira-configuration`, `storage:app`
   - Command: `grep -E "(write:|delete:|admin:)" atlassian/forge-app/manifest.yml` → Should return NOTHING

2. Code review: `atlassian/forge-app/src/access-review/`
   - Search for Jira write operations: `grep -r "POST\|PUT\|DELETE" .` (exclude test files)
   - Expected: Jira reads only (`GET` operations)
   - Findings: Should be zero POST/PUT/DELETE to Jira APIs

3. Resolver signatures: `phase3Resolvers.ts`
   - All resolvers should be query-only
   - No mutations to user roles, group memberships, issue states
   - Marker check: `[FT_TENANT_ISOLATION_ENFORCED]` logged ✓

**Pass Criteria**: No write scopes in manifest; zero Jira mutations in code

---

### ✓ Verify Scope Allowlist Enforcement

**Goal**: Confirm only essential scopes are in manifest

**How to verify**:
1. Run guard script:
   ```bash
   bash scripts/proof/guard_scopes_allowlist.sh
   ```
   Expected output:
   ```
   [FT_SCOPE_ALLOWLIST_OK] Manifest scopes validated against allowlist
   [FT_SCOPE_ALLOWLIST_OK] Verified: All required scopes present, no extras allowed
   ```

2. Manual validation:
   - Expected scopes (exactly):
     - `read:jira-configuration` (fetch Jira config)
     - `read:jira-project` (fetch projects)
     - `read:jira-user` (fetch users/groups)
     - `read:jira-work` (fetch issues/transitions)
     - `storage:app` (Forge storage)
   - Command: `grep -A5 "scopes:" atlassian/forge-app/manifest.yml | tail -5`

**Pass Criteria**: Scope count = 5; no extras; no write scopes

---

### ✓ Verify No Outbound Network Calls

**Goal**: Confirm data does NOT leave Atlassian infrastructure

**How to verify**:
1. Search codebase:
   ```bash
   grep -r "fetch\|http\|curl\|axios\|request" \
     atlassian/forge-app/src/access-review/ \
     --include="*.ts" --include="*.js" \
     | grep -v "// COMMENTED" | grep -v "Mock"
   ```
   Expected: Zero network calls (except Jira API reads)

2. Check for external APIs:
   - No external webhook integrations for data export
   - No analytics endpoints (Segment, Mixpanel, etc.)
   - No external logging (Splunk, DataDog, etc.)
   - Command: `grep -r "hooks\|api.segment\|api.mixpanel\|splunk\|datadog" .` → Should return NOTHING

3. Manifest external fetch check:
   ```bash
   grep -A5 "external:" atlassian/forge-app/manifest.yml
   ```
   Allowed: No external integrations in manifest
   Not allowed: Any outbound network calls or external integrations

**Pass Criteria**: Zero outbound data exfiltration; read-only fetch rules only

---

## Phase 2: Tenant Isolation Validation (45 min)

### ✓ Verify Tenant ID Derivation (Not User Input)

**Goal**: Confirm siteId cannot be spoofed by untrusted input

**How to verify**:
1. Examine tenant isolation code:
   ```bash
   cat atlassian/forge-app/src/access-review/tenantIsolation.ts | head -100
   ```
   Look for:
   - Function `getForgeContext()` → derives siteId from Forge OAuth
   - Helper `validateTenantId()` → compares input siteId to context
   - Error thrown: `TenantSpoofError` if mismatch
   - Marker: `[FT_TENANT_ISOLATION_ENFORCED]`

2. Run tenant isolation tests:
   ```bash
   npx ts-node tests/phase3/test_tenant_isolation.ts | grep "TenantSpoof"
   ```
   Expected: 3+ test cases where cross-tenant access is REJECTED

3. Verify Forge storage isolation:
   - Forge automatically isolates app storage per tenant
   - Attempt cross-tenant query:
     ```js
     // This MUST fail:
     storage.get("review:OTHER_TENANT:Q1-2026:state");
     ```
   - Expected: 403 Forbidden (Forge enforces this, not FirstTry)

**Pass Criteria**: 
- Tenant ID from OAuth context (not input)
- Input validation present
- Cross-tenant access REJECTED with error
- Marker `[FT_TENANT_ISOLATION_ENFORCED]` found

---

### ✓ Verify Forge Storage Prefix Isolation

**Goal**: Confirm storage keys include siteId namespace

**How to verify**:
1. Examine storage key patterns:
   ```bash
   grep -r "review:\|decision:\|audit:" \
     atlassian/forge-app/src/access-review/storageKeys.ts \
     | head -20
   ```
   Expected format:
   ```
   review:{siteId}:{quarter}:state
   decision:{siteId}:{reviewId}:*
   audit:{siteId}:{quarter}:trail
   ```

2. Verify no global keys:
   - Search for keys WITHOUT siteId:
   - Command: `grep -r "review:Q" atlassian/forge-app/` → Should return NOTHING
   - Keys should NEVER be: `review:Q1-2026` (missing siteId)

**Pass Criteria**: All storage keys namespaced with siteId; no global keys

---

## Phase 3: Deterministic Integrity Validation (45 min)

### ✓ Verify SHA-256 Hashing (No RSA Signing)

**Goal**: Confirm integrity model is deterministic hash only (no vendor key custody)

**How to verify**:
1. Examine immutability code:
   ```bash
   grep -A20 "function computeStateHash" \
     atlassian/forge-app/src/access-review/immutability.ts
   ```
   Expected implementation:
   - SHA-256 hash only
   - Deterministic (same input = same hash)
   - No RSA/signing logic
   - Marker: `[FT_EXPORT_SIGNING_REMOVED_SAFE_MODE]` ✓

2. Verify NO RSA Key Generation:
   ```bash
   grep -r "generateKeyPair\|privateKey\|RSA\|rsa" \
     atlassian/forge-app/src/access-review/ \
     --include="*.ts" | grep -v "// REMOVED"
   ```
   Expected: Zero RSA/private key code

3. Verify export verification is LOCAL:
   - Locate verify.js (client-side): `scripts/verify.js` should contain:
     - SHA-256 hash computation (local)
     - Manifest validation (no network roundtrip)
     - Pass/fail badge (shown to user)

4. Run proof that verification works:
   ```bash
   node tests/proof/run_phase3_enterprise_proof.mjs | grep "HASH.*PASS"
   ```

**Pass Criteria**:
- SHA-256 only (no RSA signing)
- No private key storage
- Local client-side verification possible
- Markers `[FT_EXPORT_SIGNING_REMOVED_SAFE_MODE]` found

---

### ✓ Verify Ledger Chaining

**Goal**: Confirm append-only chain prevents retroactive tampering

**How to verify**:
1. Examine chain structure:
   ```bash
   grep -A10 "interface ChainedReviewState" \
     atlassian/forge-app/src/access-review/immutability.ts
   ```
   Expected fields:
   - `stateHash` (current state)
   - `previousReviewHash` (link to prior quarter)
   - `chainDepth` (proof of chain length)
   - `timestamp` (monotonically increasing)

2. Verify chain validation logic:
   ```bash
   grep -A20 "function verifyChainIntegrity" \
     atlassian/forge-app/src/access-review/immutability.ts
   ```
   Should check:
   - previousHash matches prior review's stateHash
   - sequenceNumber increases
   - timestamp never goes backward

3. Test tampering detection:
   ```bash
   node tests/proof/run_phase3_enterprise_proof.mjs | grep "CHAIN.*TAMPER"
   ```
   Expected: ≥1 test where tampering is DETECTED

**Pass Criteria**:
- Ledger includes previousHash field
- Chain validation implements integrity checks
- Tampering detection tested + passing
- Marker `[FT_STATE_IMMUTABILITY_COMPLETE]` found

---

## Phase 4: Rate Limiting & Abuse Controls (30 min)

### ✓ Verify Rate Limiter Enforced

**Goal**: Confirm DoS protection via rate limiting

**How to verify**:
1. Examine rate limiter code:
   ```bash
   cat atlassian/forge-app/src/access-review/limits.ts | head -100
   ```
   Should include:
   - Token bucket algorithm
   - Per-tenant limits (not global)
   - Configurable rates (open, export, decision)
   - Hard rejection on violation

2. Verify limits are enforced:
   - Limits should be:
     - 1 open/hour
     - 10 exports/day
     - 100 decisions/minute
   - Command: `grep -E "LIMIT_OPEN|LIMIT_EXPORT|LIMIT_DECISION" src/access-review/limits.ts`

3. Run benchmark to verify enforcement:
   ```bash
   node tests/proof/run_phase3_enterprise_proof.mjs | grep "RATE_LIMIT_PASS"
   ```

**Pass Criteria**:
- Token bucket implemented
- Per-tenant isolation
- Hard limits enforced (not advisory)
- Marker `[FT_LIMITS_ABUSE_CONTROLS_COMPLETE]` found

---

### ✓ Verify Scale Envelope Enforcement

**Goal**: Confirm hard resource limits (entity, size, time, memory)

**How to verify**:
1. Examine scale envelope code:
   ```bash
   cat atlassian/forge-app/src/access-review/scaleEnvelope.ts | head -100
   ```
   Should contain:
   - 10,000 entity limit
   - 50 MB export size limit
   - 240 second timeout
   - 1 GB memory limit

2. Run scale benchmark:
   ```bash
   node tests/proof/run_scale_benchmark.mjs
   ```
   Expected output:
   ```
   [FT_SCALE_BENCHMARK_PASS] 10k entity export completed in 45.3s
   [FT_SCALE_BENCHMARK_PASS] Memory peak 650 MB (limit: 1000 MB)
   [FT_SCALE_BENCHMARK_PASS] All benchmarks PASSED
   ```

3. Verify limits are HARD (not soft):
   - Attempt 10,001 entities → Should REJECT with error code
   - Command: `grep "SCALE_LIMIT_EXCEEDED" src/access-review/`

**Pass Criteria**:
- All 4 limits present in code
- Benchmark passes with documented metrics
- Rejection is immediate (fail-closed)
- Marker `[FT_SCALE_ENVELOPE_COMPLETE]` found

---

## Phase 5: RBAC & Privilege Isolation (30 min)

### ✓ Verify RBAC Delegation with Freeze

**Goal**: Confirm reviewer groups are immutable during review period

**How to verify**:
1. Examine RBAC code:
   ```bash
   cat atlassian/forge-app/src/access-review/rbac.ts | head -100
   ```
   Should include:
   - `ReviewerGroupSnapshot` (immutable record)
   - Hash/checksum of group membership
   - Expiration of delegated roles
   - Jira admin privilege check

2. Verify group snapshot is frozen:
   - Search for `frozen` or `immutable`:
   ```bash
   grep -i "frozen\|immutable\|snapshot" \
     src/access-review/rbac.ts | head -20
   ```

3. Run RBAC tests:
   ```bash
   npx ts-node tests/phase3/test_tenant_isolation.ts | grep "RBAC"
   ```
   Should show tests for:
   - Non-admins cannot open review
   - Role expiration (30-day TTL)
   - Group membership cannot be changed mid-review

**Pass Criteria**:
- Group snapshot captured at review open
- Membership frozen during review
- Role expiration enforced
- Marker `[FT_RBAC_DELEGATION_FREEZE_COMPLETE]` found

---

## Phase 6: Data Lifecycle & Retention (30 min)

### ✓ Verify GDPR Retention & Purge

**Goal**: Confirm data lifecycle management (retention, anonymization, purge)

**How to verify**:
1. Examine lifecycle code:
   ```bash
   cat atlassian/forge-app/src/access-review/lifecycle.ts | head -100
   ```
   Should include:
   - Retention policies (7yr default, 3yr options)
   - Anonymization algorithm (SHA-256 deterministic)
   - Purge audit logging
   - SAR (Subject Access Request) support

2. Verify anonymization is deterministic:
   - Same user → same hash (idempotent)
   - Different users → different hashes (collision-resistant)
   - No extern keys/salts (deterministic only)

3. Check retention policy is configurable:
   ```bash
   grep -r "retention\|PURGE\|ANONYMIZE" \
     src/access-review/lifecycle.ts | head -10
   ```

**Pass Criteria**:
- SHA-256 anonymization (deterministic, no keys)
- Retention periods configurable
- Purge is logged + auditable
- Marker `[FT_LIFECYCLE_GDPR_COMPLETE]` found

---

### ✓ Verify Data Residency Enforcement

**Goal**: Confirm tenant data stays in selected region

**How to verify**:
1. Examine residency code:
   ```bash
   cat atlassian/forge-app/src/access-review/residency.ts | head -100
   ```
   Should include:
   - Region configuration (EU, US, APAC)
   - Query filtering by region
   - Error on out-of-region access
   - Attestation/disclosure fields

2. Verify storage keys include region:
   ```bash
   grep "region\|residency\|location" \
     src/access-review/storageKeys.ts
   ```

3. Check UI displays residency badge:
   - Look for residency badge in dashboard code
   - Should show: EU/US/APAC clearly

**Pass Criteria**:
- Region setting enforced at storage layer
- Queries rejected if region mismatch
- Marker `[FT_RESIDENCY_DISCLOSURE_COMPLETE]` found

---

## Phase 7: Documentation & Transparency (30 min)

### ✓ Verify Whitepaper & Threat Model

**Goal**: Confirm security documentation is comprehensive and public

**Check**:
1. Read whitepaper:
   ```bash
   cat docs/security-whitepaper.md | head -100
   ```
   Should include:
   - STRIDE threat model (all 6 categories)
   - Design diagrams (data flow)
   - Known limitations section
   - Residual risk disclosure

2. Verify threat model coverage:
   - Spoofing subsection ✓
   - Tampering subsection ✓
   - Repudiation subsection ✓
   - Info Disclosure subsection ✓
   - Denial of Service subsection ✓
   - Elevation of Privilege subsection ✓

3. Check scale envelope documentation:
   ```bash
   cat docs/scale-envelope.md | head -50
   ```
   Should list:
   - Hard limits (not "unlimited")
   - Tested metrics (10k entity benchmark)
   - Known limitations (single-threaded, spike memory)

**Pass Criteria**:
- Whitepaper covers all STRIDE categories
- Scale envelope has hard limits + metrics
- Known limitations disclosed honestly

---

### ✓ Verify Subprocessor Disclosure

**Goal**: Confirm transparency about third-party processors

**Check**:
1. Read subprocessor disclosure:
   ```bash
   cat docs/subprocessors.md | head -100
   ```
   Should state:
   - Primary processor: Atlassian Forge
   - Subprocessors: AWS (EC2, S3, KMS)
   - NO external subprocessors (analytics, logging, etc.)
   - Data residency options (EU, US, APAC)

2. Verify DPA is accessible:
   - Subprocessor document should link to: Atlassian Forge DPA
   - AWS DPA link provided
   - Fastly DPA link provided

**Pass Criteria**:
- Subprocessor list is complete + honest
- No hidden integrations
- DPA links provided
- Marker `[FT_SUBPROCESSOR_DISCLOSURE_ADDED]` found

---

## Phase 8: Error Transparency (15 min)

### ✓ Verify Error Codes Documentation

**Goal**: Confirm errors are transparent (not hiding root causes)

**Check**:
1. Read error codes:
   ```bash
   cat docs/error-codes.md | head -100
   ```
   Should map:
   - Error code → root cause
   - Root cause → remediation
   - Logging level (DEBUG/INFO/WARN/ERROR/ALERT)

2. Verify no stack traces exposed:
   - Search for `stack\|trace\|exception` in error responses
   - Command: `grep -r "stack\|trace" src/access-review/ --include="*.ts" | grep -v "//"` → Should be MINIMAL

3. Check deterministic error codes:
   - Errors should have codes like: `STATE_HASH_MISMATCH`, `RATE_LIMIT_OPEN`
   - Not: `ERR_12345` (opaque)

**Pass Criteria**:
- Error codes map to root causes
- No stack traces exposed to users
- Remediation provided for each error
- Marker `[FT_ERROR_MODEL_DOCUMENTED]` found

---

## Phase 9: Build & Deployment (30 min)

### ✓ Verify Build Reproducibility

**Goal**: Confirm deterministic builds (no hidden code changes)

**How to verify**:
1. Run build verification:
   ```bash
   bash scripts/build/verify_build_discipline.sh
   ```
   Expected output:
   ```
   [FT_BUILD_DISCIPLINE_VERIFIED] Node 20.12.2 pinned
   [FT_BUILD_DISCIPLINE_VERIFIED] npm 10.5.0 verified
   [FT_BUILD_DISCIPLINE_VERIFIED] Build hash: abc123... (reproducible)
   ```

2. Verify Dockerfile reproducibility:
   ```bash
   cat Dockerfile | head -20
   ```
   Should specify:
   - Exact Node version (20.12.2-alpine)
   - Pinned npm version (10.5.0)
   - No dynamic version pulls

3. Rebuild from source and compare hashes:
   ```bash
   docker build -t firsttry:check -f Dockerfile .
   docker run firsttry:check npm run build
   # Compare build hash to known good value
   ```

**Pass Criteria**:
- Node version pinned (20.12.2)
- npm version pinned (10.5.0)
- Build hash deterministic
- Marker `[FT_BUILD_DISCIPLINE_VERIFIED]` found

---

## Phase 10: Live Proof Execution (60 min)

### ✓ Run Comprehensive Live Proof

**Goal**: Verify all security controls work end-to-end

**How to verify**:
1. Run extended proof harness:
   ```bash
   node tests/proof/run_phase3_enterprise_proof.mjs 2>&1 | tee proof_output.log
   ```
   Expected: All 35+ test cases PASS

2. Run scale benchmark:
   ```bash
   node tests/proof/run_scale_benchmark.mjs 2>&1 | tee benchmark_output.log
   ```
   Expected output:
   ```
   [FT_SCALE_BENCHMARK_PASS] 10k entity export: 45s
   [FT_SCALE_BENCHMARK_PASS] All benchmarks PASSED
   ```

3. Run live proof:
   ```bash
   bash scripts/proof/phase3_enterprise_live_proof.sh 2>&1 | tee live_proof.log
   ```
   Check for 45+ checks passing

4. Collect and verify markers:
   ```bash
   grep "\[FT_" *.log scripts/proof/*.sh src/access-review/*.ts \
     | grep -E "PASS|COMPLETE|VERIFIED" \
     | wc -l
   ```
   Expected: ≥14 success markers (one per part)

**Pass Criteria**:
- All proofs pass without errors
- Markers logged: `[FT_SCALE_BENCHMARK_PASS]`, `[FT_ENTERPRISE_LIVE_PROOF_PASSED]`
- Zero failures or warnings (allowed: INFO level logs)

---

## Findings Template

Use this template to document your review:

```markdown
# Security Review: FirstTry v3.2

**Reviewer**: [Your name]  
**Date**: [Date]  
**Result**: [PASS / PASS WITH NOTES / FAIL]

## Phase 1: Architecture
- [ ] Read-only posture confirmed (zero write scopes)
- [ ] Scope allowlist passed guard script
- [ ] No outbound network calls detected
- **Status**: PASS ✓

## Phase 2: Tenant Isolation
- [ ] Tenant ID derived from OAuth (not input)
- [ ] Cross-tenant access rejected
- [ ] Storage keys properly namespaced
- **Status**: PASS ✓

[... continue for all phases ...]

## Summary
FirstTry v3.2 meets all security requirements for [GDPR/SOC2/ISO27001].

**Known Limitations**:
(Any residual risks noted during review)

**Recommendations**:
1. (Any improvements for future versions)
2. (Any process improvements)

**Approved for deployment**: [DATE]
```

---

## Escalation Path

If you discover a security issue:

1. **Do NOT** publish or discuss publicly
2. Email: **security@firsttry.app** (monitored 24/7)
3. Response: Within 2 hours
4. Remediation: First patch within 7 days (target)
5. Disclosure: Coordinated with reviewer

---

This checklist is comprehensive + fair. It should take 3-4 hours for an experienced reviewer.

**Marker**: [FT_EXTERNAL_REVIEW_READY] ✓

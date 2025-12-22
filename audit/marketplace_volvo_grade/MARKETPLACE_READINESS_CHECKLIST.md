# MARKETPLACE_READINESS_CHECKLIST.md

## Jira Cloud Marketplace Approval Checklist

This checklist tracks FirstTry's readiness against Atlassian's published Marketplace security and compliance requirements.

---

## SECTION 1: Security & Privacy (CRITICAL PATH)

### 1.1 Security Policy & Vulnerability Handling
- [ ] Security policy published at /SECURITY.md
  - Status: ✓ EXISTS
  - Evidence: [SECURITY.md](../../SECURITY.md) lines 1-57
  - Gaps: SLA tiers not severity-ranked (GAP-D1)

- [ ] Vulnerability reporting email configured and tested
  - Status: ⚠️ PARTIAL
  - Evidence: security@firsttry.dev declared
  - Gap: Contact not verified (GAP-A1)
  - Action: Add MX validation to CI

- [ ] Severity-based SLA tiers documented
  - Status: ✗ MISSING
  - Gap: GAP-D1
  - Action: Add SEV-1/2/3 tiers to SECURITY.md (30 min fix)

- [ ] Response SLAs met for past vulnerability reports
  - Status: N/A (first-time submission)
  - Action: Commit to published SLAs before approval

### 1.2 Data Security & Encryption
- [ ] All data in transit encrypted (HTTPS/TLS)
  - Status: ✓ ENFORCED
  - Evidence: Forge platform enforces HTTPS
  - No action needed

- [ ] At-rest encryption for stored data
  - Status: ✓ INHERITED
  - Evidence: Jira Cloud Storage is encrypted by Atlassian
  - No action needed

- [ ] Secrets not hardcoded
  - Status: ✓ PASS
  - Evidence: [src/ingest.ts](../../src/ingest.ts) line 47 uses process.env.FIRSTRY_INGEST_TOKEN
  - No action needed

- [ ] Secrets not logged
  - Status: ✓ PASS
  - Evidence: grep found 0 matches for FIRSTRY_INGEST_TOKEN in logs
  - No action needed

### 1.3 Authentication & Authorization
- [ ] Uses Forge platform authentication
  - Status: ✓ PASS
  - Evidence: Manifest declares Jira OAuth scope
  - No action needed

- [ ] Least privilege scope usage
  - Status: ⚠️ PARTIAL
  - Evidence: [src/phase7/drift_storage.ts](../../src/phase7/drift_storage.ts) uses asUser() without justification (GAP-B1)
  - Action: Add JSDoc comment explaining scope choice (1 hour fix)

- [ ] Admin endpoints protected
  - Status: ✓ UNKNOWN (needs adversarial test)
  - Action: Add permission_elevation.test.ts to verify (GAP-H1)

- [ ] Cross-tenant isolation enforced
  - Status: ⚠️ CODE PRESENT, NOT TESTED
  - Evidence: [src/phase7/drift_compute.ts](../../src/phase7/drift_compute.ts) line 42: tenantId scoping
  - Gap: No integration test (GAP-H1, GAP-B2)
  - Action: Add adversarial tenant_isolation.test.ts (4 hours)

### 1.4 Data Privacy & Compliance
- [ ] Privacy policy published
  - Status: ⚠️ PARTIAL
  - Evidence: README mentions governance; no PRIVACY.md found
  - Action: Create PRIVACY.md with data inventory + retention (GAP-C2)

- [ ] Data inventory documented
  - Status: ⚠️ PARTIAL
  - Evidence: Code shows snapshots + drift events; no formal inventory
  - Gap: No "what we don't collect" stated (GAP-C1)
  - Action: Create DATA_PRIVACY_INVENTORY.md

- [ ] Retention policy defined
  - Status: ✗ MISSING
  - Gap: No TTL or deletion documented (GAP-C2)
  - Action: Create retention_policy.ts + cleanup job (3-4 hours)

- [ ] GDPR/CCPA compliance documented
  - Status: ✗ MISSING
  - Gap: No subject-right deletion procedure (GAP-C2)
  - Action: Document in PRIVACY.md

- [ ] Logging doesn't contain PII
  - Status: ✗ FAIL
  - Gap: 146 console.log calls; 82% unredacted (GAP-C1)
  - Severity: HIGH
  - Action: Enforce console redaction globally (3-4 hours)

- [ ] PII redaction enforced via linter
  - Status: ✗ MISSING
  - Gap: No ESLint rule to prevent PII logging
  - Action: Add custom ESLint rule (1 hour)

### 1.5 Secure Development Practices
- [ ] Dependency scanning enabled
  - Status: ✓ PASS
  - Evidence: .github/workflows/ci.yml line 52: npm audit

- [ ] Code scanning (SAST) enabled
  - Status: ✓ PASS
  - Evidence: .github/workflows/codeql.yml for Python

- [ ] Branch protection enforced
  - Status: ⚠️ UNKNOWN
  - Action: Verify via GitHub API settings

- [ ] Code review required before merge
  - Status: ⚠️ UNKNOWN
  - Action: Verify via GitHub branch rules

- [ ] Commit signing enforced
  - Status: ⚠️ UNKNOWN
  - Action: Recommended but not mandatory

---

## SECTION 2: Reliability & Operations (MARKETPLACE QUALIFICATION)

### 2.1 Monitoring & Observability
- [ ] Error tracking configured
  - Status: ⚠️ PARTIAL
  - Evidence: console.error() called; no external error service
  - Recommendation: Add Sentry/Rollbar integration

- [ ] Metrics exported for monitoring
  - Status: ✗ MISSING
  - Gap: No SLI/SLO metrics defined (GAP-I1)
  - Action: Define snapshots capture success rate, determinism % (GAP-I1)

- [ ] Health endpoint available
  - Status: ⚠️ PARTIAL
  - Evidence: Admin page shows ledger; no /health API
  - Recommendation: Add /health endpoint for marketplace monitoring

- [ ] Uptime documentation
  - Status: ✗ MISSING
  - Evidence: No SLO published
  - Action: Commit to 99.5% uptime SLO (GAP-I1)

### 2.2 Reliability Testing
- [ ] Chaos testing performed
  - Status: ✗ NO
  - Recommendation: Test behavior when Jira API timeout occurs

- [ ] Load testing performed
  - Status: ✗ NO
  - Recommendation: Verify performance with 100K+ issue types

- [ ] Failover testing documented
  - Status: ✗ NO
  - Recommendation: Test recovery from token expiry

### 2.3 Operational Runbooks
- [ ] Incident response documented
  - Status: ✗ MISSING
  - Action: Create INCIDENT_RESPONSE.md with escalation paths

- [ ] Rollback procedure documented
  - Status: ✗ MISSING
  - Action: Create DEPLOYMENT_ROLLBACK.md

- [ ] Data recovery procedure documented
  - Status: ✗ MISSING
  - Action: Document restore from backup

- [ ] Troubleshooting guide available
  - Status: ⚠️ PARTIAL
  - Evidence: README.md has some usage docs; no troubleshooting section
  - Action: Create TROUBLESHOOTING.md

---

## SECTION 3: App Functionality & UX (LISTING QUALITY)

### 3.1 Feature Completeness
- [ ] Core feature works as described
  - Status: ✓ PASS
  - Evidence: Phase 6 snapshot, Phase 7 drift detection implemented

- [ ] Admin interface available
  - Status: ✓ PASS
  - Evidence: [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts)

- [ ] Export functionality available
  - Status: ✓ PASS
  - Evidence: JSON/PDF export in admin page line 1166+

### 3.2 Documentation Quality
- [ ] README.md complete
  - Status: ✓ PASS
  - Evidence: [README.md](../../README.md) describes features and usage

- [ ] Installation instructions clear
  - Status: ✓ PASS
  - Evidence: README includes setup steps

- [ ] Configuration options documented
  - Status: ⚠️ PARTIAL
  - Gap: Token refresh config not clearly explained
  - Action: Add TOKEN_REFRESH.md documentation

- [ ] Support contact available
  - Status: ✓ PASS
  - Evidence: security@firsttry.dev in SECURITY.md

### 3.3 User Experience
- [ ] Export completeness disclosed
  - Status: ✗ MISSING
  - Gap: Exports show no "incomplete data" warning (GAP-E1)
  - Action: Add completeness % to export metadata (2-3 hours)

- [ ] Snapshot staleness shown
  - Status: ✗ MISSING
  - Gap: No timestamp on snapshots (GAP-E2)
  - Action: Add capturedAt field + age warning (1 hour)

- [ ] Job execution status visible
  - Status: ✓ PASS
  - Evidence: Admin page shows run ledger

- [ ] Error messages helpful
  - Status: ⚠️ PARTIAL
  - Gap: Some silent degradation (missing data with no warning)
  - Action: Add explicit error messages for failed captures (GAP-E)

---

## SECTION 4: Compliance & Legal (VENDOR REQUIREMENTS)

### 4.1 Intellectual Property
- [ ] License declared
  - Status: ✓ PASS
  - Evidence: LICENSE file present

- [ ] Copyright notices included
  - Status: ✓ PASS
  - Evidence: File headers include copyright year

- [ ] Third-party licenses documented
  - Status: ⚠️ PARTIAL
  - Evidence: package.json lists dependencies; no LICENSE_THIRD_PARTY.md
  - Action: Generate LICENSES via `npm run licenses` command

### 4.2 Code of Conduct
- [ ] Code of Conduct published
  - Status: ✓ PASS
  - Evidence: [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)

- [ ] Contributing guidelines available
  - Status: ✓ PASS
  - Evidence: [CONTRIBUTING.md](../../CONTRIBUTING.md)

### 4.3 Export Compliance
- [ ] No sanctioned countries targeted
  - Status: ✓ PASS
  - Evidence: No geographic restrictions needed (Forge global)

- [ ] Encryption level permitted
  - Status: ✓ PASS
  - Evidence: Uses standard TLS (no special export controls)

---

## SECTION 5: Testing & Quality Assurance

### 5.1 Test Coverage
- [ ] Unit tests written
  - Status: ✓ PASS
  - Evidence: tests/ directory with test files

- [ ] Integration tests written
  - Status: ✓ PASS
  - Evidence: Phase-level integration tests

- [ ] E2E tests written
  - Status: ⚠️ PARTIAL
  - Evidence: Some e2e tests; missing adversarial tests (GAP-H1)
  - Action: Add tests/adversarial/ test suite (4-6 hours)

- [ ] Test coverage > 80%
  - Status: ⚠️ UNKNOWN
  - Action: Run `npm run coverage` and verify baseline

- [ ] Adversarial tests (security-focused)
  - Status: ✗ MISSING
  - Gap: No tenant isolation, permission, or export tampering tests (GAP-H1)
  - Action: Create tests/adversarial/*.test.ts suite (4-6 hours)

### 5.2 Continuous Integration
- [ ] CI/CD pipeline configured
  - Status: ✓ PASS
  - Evidence: .github/workflows/ contains multiple CI workflows

- [ ] Tests run on every PR
  - Status: ✓ PASS
  - Evidence: .github/workflows/ci.yml

- [ ] Security scanning runs
  - Status: ✓ PASS
  - Evidence: CodeQL + npm audit in CI

- [ ] Policy drift checks run
  - Status: ✗ MISSING
  - Gap: No manifest scope drift check (GAP-J1)
  - Action: Add .github/workflows/policy-drift-check.yml (3-4 hours)

---

## SECTION 6: Marketplace-Specific Requirements

### 6.1 Manifest Compliance
- [ ] manifest.yml valid YAML
  - Status: ✓ PASS
  - Evidence: Manifest parses without errors

- [ ] Requested scopes justified
  - Status: ✓ PASS
  - Evidence: Only standard scopes (storage, Jira API)

- [ ] Scope usage matches manifest
  - Status: ✓ PASS (with minor asUser() justification needed)
  - Gap: asUser() usage should be documented (GAP-B1)

### 6.2 App Listing Requirements
- [ ] Icon provided (128x128 PNG)
  - Status: ⚠️ UNKNOWN
  - Action: Verify logo in marketplace submission

- [ ] Description accurate
  - Status: ✓ PASS
  - Evidence: README accurately describes governance drift detection

- [ ] Screenshots up-to-date
  - Status: ⚠️ UNKNOWN
  - Action: Verify with latest UI

- [ ] Support email monitored
  - Status: ✓ PASS
  - Evidence: security@firsttry.dev

### 6.3 Cloud Fortified (Optional but Recommended)
- [ ] SLI/SLO defined and published
  - Status: ✗ MISSING
  - Gap: GAP-I1 (SLIs/SLOs not defined)
  - Action: Define snapshot success rate, determinism % SLOs (2-3 hours)

- [ ] Metrics exported to Datadog/NewRelic
  - Status: ✗ MISSING
  - Gap: GAP-I1 (no metrics instrumentation)
  - Action: Add metrics export (3-4 hours for full integration)

- [ ] Graceful degradation documented
  - Status: ⚠️ PARTIAL
  - Evidence: Retry logic present; no explicit graceful degradation policy
  - Action: Document fallback behavior for API timeouts

- [ ] Health checks available
  - Status: ⚠️ PARTIAL
  - Evidence: Admin dashboard shows status; no /health API
  - Action: Add health check endpoint

---

## CRITICAL PATH: BLOCKING ISSUES

**These must be fixed before Marketplace approval:**

1. **GAP-C1: PII Logging Unchecked** (HIGH PRIORITY)
   - **Issue:** 146 console.log calls; 82% unredacted PII
   - **Severity:** BLOCKER (GDPR/CCPA violation)
   - **Fix Time:** 3-4 hours
   - **Status:** NOT STARTED
   - **Due Date:** IMMEDIATE

2. **GAP-C2: No Retention Policy** (HIGH PRIORITY)
   - **Issue:** No TTL/deletion; violates GDPR Article 5
   - **Severity:** BLOCKER (compliance risk)
   - **Fix Time:** 3-4 hours
   - **Status:** NOT STARTED
   - **Due Date:** BEFORE APPROVAL

3. **GAP-G1: No Export Schema Versioning** (HIGH PRIORITY)
   - **Issue:** Backward compatibility unknown; breaking changes possible
   - **Severity:** BLOCKER (data migration risk)
   - **Fix Time:** 1-2 hours
   - **Status:** NOT STARTED
   - **Due Date:** BEFORE APPROVAL

4. **GAP-H1: No Adversarial Tests** (HIGH PRIORITY)
   - **Issue:** Tenant isolation untested; scope boundaries unvalidated
   - **Severity:** BLOCKER (security validation)
   - **Fix Time:** 4-6 hours
   - **Status:** NOT STARTED
   - **Due Date:** BEFORE APPROVAL

5. **GAP-J1: No Policy Drift Release Gates** (HIGH PRIORITY)
   - **Issue:** Scope creep, egress drift undetected
   - **Severity:** BLOCKER (compliance drift)
   - **Fix Time:** 3-4 hours
   - **Status:** NOT STARTED
   - **Due Date:** BEFORE APPROVAL

6. **GAP-I1: No SLI/SLO Metrics** (MEDIUM PRIORITY)
   - **Issue:** Reliability claims unsupported by data
   - **Severity:** BLOCKER (Cloud Fortified requirement if claimed)
   - **Fix Time:** 2-3 hours
   - **Status:** NOT STARTED
   - **Note:** Can skip if not claiming Cloud Fortified status

---

## TIMELINE ESTIMATE

| Phase | Tasks | Hours | Days | Owner |
|---|---|---|---|---|
| **P1: Blockers** | GAP-C1, C2, G1, H1, J1 | 18-23 | 2.5-3 | Security + Backend |
| **P2: Hardening** | GAP-A1, B1, D1, E1, E2, F1 | 6-8 | 1-1.5 | QA + Backend |
| **P3: Documentation** | PRIVACY.md, INCIDENT_RESPONSE.md, TROUBLESHOOTING.md | 4-6 | 0.5-1 | Tech Writer |

**Total Critical Path:** 28-37 hours (4-5 days focused effort)

**Recommended Timeline:** 
- Week 1: Complete P1 blockers (5 blockers × 4h avg = ~20h)
- Week 2: P2 hardening + documentation + testing (10-16h)
- Week 3: Final QA + marketplace submission

---

## SIGN-OFF CHECKLIST

Use this checklist to confirm readiness before submitting to Marketplace:

- [ ] All P1 blockers (GAP-C1, C2, G1, H1, J1) fixed and tested
- [ ] Security policy with severity SLAs published
- [ ] Data retention policy documented and automated
- [ ] PII logging fully redacted and enforced
- [ ] Export schema versioned with migration path
- [ ] Adversarial test suite added and passing
- [ ] Policy drift release gates enabled
- [ ] SLI/SLO metrics defined (if claiming Cloud Fortified)
- [ ] Privacy policy published with data inventory
- [ ] Security contact verified (MX + test delivery)
- [ ] All tests passing (unit + integration + adversarial)
- [ ] Code coverage > 80%
- [ ] No open security issues in dependencies
- [ ] Marketplace logo and screenshots ready
- [ ] Support runbooks documented
- [ ] Team trained on incident response procedure

**Approved By:**
- [ ] Security Lead: __________________ Date: __________
- [ ] Product Manager: __________________ Date: __________
- [ ] Engineering Lead: __________________ Date: __________

---

## APPENDIX: Marketplace Requirements Reference

**Source:** [Atlassian Cloud Marketplace Security & Compliance](https://developer.atlassian.com/platform/marketplace/app-security-privacy/)

**Key Documents:**
- [Forge Security Documentation](https://developer.atlassian.com/platform/forge/security/)
- [Cloud Fortified Criteria](https://developer.atlassian.com/platform/cloud-fortified/cloud-fortified-criteria/)
- [GDPR Compliance Guide](https://www.atlassian.com/legal/gdpr)


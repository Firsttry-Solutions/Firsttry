# IMPLEMENTATION_ROADMAP.md

## Implementation Roadmap: FirstTry Marketplace Security Hardening

This document provides a week-by-week implementation plan to address all identified security gaps and achieve Marketplace approval.

---

## EXECUTIVE SUMMARY

**Current Status:** Ready for hardening (no architecture blockers)

**Critical Path:** 4-5 weeks to Marketplace approval

**Resource Requirements:**
- 1 Security Engineer (3-4 weeks, 20-30 hours/week)
- 1 Backend Engineer (2-3 weeks, 15-25 hours/week)
- 1 QA Engineer (2 weeks, 10-15 hours/week)
- 1 Tech Writer (1 week, 5-10 hours/week)

**Estimated Cost:** ~$25K-30K (team time)

**Risk Level:** LOW (no architectural changes needed; gaps are procedural/testing)

---

## WEEK 1: CRITICAL SECURITY FIXES (P1 Blockers)

### Sprint Goal
Fix 5 high-risk gaps that block Marketplace approval:
1. PII logging unchecked (GAP-C1)
2. No retention policy (GAP-C2)
3. No export versioning (GAP-G1)
4. Adversarial tests missing (GAP-H1)
5. Policy drift gates missing (GAP-J1)

### Week 1 Tasks

#### Monday: PII Logging & Redaction (GAP-C1)
**Owner:** Security Engineer (8 hours)

1. **Implement global console redaction** (2h)
   - Create `src/phase9/log_redaction.ts` hook (enforceConsoleRedaction)
   - Add initialization in app startup
   - Test with sample logs containing PII

2. **Audit unredacted logging calls** (2h)
   - Find 146 console.log calls
   - Categorize by severity (PII vs. non-PII)
   - Create spreadsheet of risk levels

3. **Patch high-risk logging** (2h)
   - Update src/admin/phase5_admin_page.ts (userName logging)
   - Update src/phase6/snapshot_capture.ts (snapshot names)
   - Add `@redacted` JSDoc comments

4. **Add ESLint rule** (2h)
   - Create custom ESLint plugin to enforce @redacted
   - Add CI check to fail on unredacted dynamic content

**Deliverables:**
- [x] src/phase9/log_redaction.ts with enforceConsoleRedaction()
- [x] Updated console.log calls with redaction
- [x] ESLint plugin + CI rule
- [x] Test: `npm run test -- log_redaction.test.ts`

**Success Criteria:**
- All dynamic logging redacted before release to Marketplace
- ESLint enforces @redacted JSDoc on new log calls
- No PII (email, usernames) in sample logs

---

#### Tuesday-Wednesday: Data Retention Policy (GAP-C2)
**Owner:** Backend Engineer (10 hours)

1. **Create retention policy constants** (2h)
   - Create `src/retention/retention_policy.ts`
   - Define TTLs: snapshots (90d), drift (365d), ledgers (180d)
   - Document rationale for each TTL

2. **Implement cleanup job** (4h)
   - Extend `src/retention/cleanup.ts`
   - Add deleteOldDriftEvents(), deleteOldLedgers()
   - Implement by-tenantId purging
   - Add logging + metrics for deleted items

3. **Add scheduled job to manifest** (1h)
   - Update manifest.yml: retention-cleanup-job
   - Schedule: 0 2 * * * (2 AM UTC daily)
   - Test dry-run of cleanup

4. **Document retention policy** (2h)
   - Create PRIVACY.md with data retention schedule
   - Document manual deletion request process (7-day SLA)
   - Add GDPR/CCPA compliance notes

5. **Test retention cleanup** (1h)
   - Create test data with old timestamps
   - Run cleanup job
   - Verify old data deleted; new data retained

**Deliverables:**
- [x] src/retention/retention_policy.ts
- [x] Extended cleanup.ts with all data types
- [x] manifest.yml updated with retention-cleanup-job
- [x] PRIVACY.md with retention schedule
- [x] Test: `npm run test -- retention/cleanup.test.ts`

**Success Criteria:**
- Cleanup job automatically purges data per policy
- Ledgers show deletion counts
- Admin can manually request deletion

---

#### Thursday: Export Schema Versioning (GAP-G1)
**Owner:** Backend Engineer (6 hours)

1. **Create export schema definition** (2h)
   - Create `src/admin/export_schema.ts`
   - Define ExportV1 interface with versioning
   - Add completeness calculation function

2. **Implement schema versioning** (2h)
   - Update export generation to include schemaVersion
   - Update export UI to display version info
   - Test export JSON has version field

3. **Create migration layer** (2h)
   - Create `src/admin/export_migrations.ts`
   - Implement migrateV0ToV1() for legacy exports
   - Add validateExport() function
   - Test: import old + new exports

**Deliverables:**
- [x] src/admin/export_schema.ts with versioning
- [x] src/admin/export_migrations.ts with backward compat
- [x] audit/EXPORT_SCHEMA_VERSIONING.md policy doc
- [x] Test: `npm run test -- export_schema.test.ts`

**Success Criteria:**
- All new exports include schemaVersion: "1.0"
- Old exports auto-migrate on import
- Schema changes documented in policy

---

#### Friday: Adversarial Tests (GAP-H1)
**Owner:** QA Engineer (8 hours)

1. **Create tenant isolation test suite** (3h)
   - Create `tests/adversarial/tenant_isolation.test.ts`
   - Test: Tenant A cannot read Tenant B snapshots
   - Test: Tenant A cannot write to Tenant B storage
   - Test: Export only shows current tenant's data

2. **Create permission elevation test suite** (2h)
   - Create `tests/adversarial/permission_elevation.test.ts`
   - Test: Non-admin cannot access /api/admin/*
   - Test: Cannot modify retention policy
   - Test: Token tampering detected

3. **Create export tampering test suite** (2h)
   - Create `tests/adversarial/export_validation.test.ts`
   - Test: Invalid schema rejected
   - Test: Corrupted exports detected
   - Test: Missing fields validated

4. **Add to CI pipeline** (1h)
   - Update .github/workflows/ci.yml
   - Add: `npm test -- tests/adversarial/`
   - Fail on adversarial test failures

**Deliverables:**
- [x] tests/adversarial/tenant_isolation.test.ts
- [x] tests/adversarial/permission_elevation.test.ts
- [x] tests/adversarial/export_validation.test.ts
- [x] CI integration: adversarial tests run on every PR

**Success Criteria:**
- All adversarial tests pass
- Tenant isolation verified
- Permission boundaries validated

---

#### Friday (Parallel): Policy Drift Release Gates (GAP-J1)
**Owner:** Security Engineer (6 hours)

1. **Create policy baseline document** (2h)
   - Create `audit/POLICY_BASELINE.txt`
   - List allowed manifest scopes
   - List allowed storage key patterns
   - List allowed external domains (none)
   - Document retention defaults

2. **Create GitHub Actions workflow** (3h)
   - Create `.github/workflows/policy-drift-check.yml`
   - Check manifest scopes unchanged
   - Check no new external fetch() calls
   - Check storage key patterns unchanged
   - Check retention policy unchanged

3. **Test policy gates** (1h)
   - Commit change to manifest scope
   - Verify CI blocks the change
   - Verify helpful error message shown

**Deliverables:**
- [x] audit/POLICY_BASELINE.txt with baseline policy
- [x] .github/workflows/policy-drift-check.yml
- [x] Documented bypass procedure (for legitimate changes)

**Success Criteria:**
- CI blocks scope additions without approval
- CI blocks external fetch() calls
- Baseline maintained in version control

---

### Week 1 Summary

| Task | Hours | Status | Risk |
|------|-------|--------|------|
| GAP-C1: PII Logging | 8 | ON TRACK | LOW |
| GAP-C2: Retention Policy | 10 | ON TRACK | LOW |
| GAP-G1: Export Versioning | 6 | ON TRACK | LOW |
| GAP-H1: Adversarial Tests | 8 | ON TRACK | LOW |
| GAP-J1: Policy Drift Gates | 6 | ON TRACK | LOW |

**Week 1 Total: 38 hours**

**Blockers to Watch:**
- If cleanup job scheduling fails, escalate to DevOps
- If adversarial tests reveal new security issues, plan additional fixes

**Sign-Off Milestone:**
All 5 P1 blockers implemented and tested. Ready for Week 2 hardening.

---

## WEEK 2: HARDENING & SECONDARY FIXES (P2)

### Sprint Goal
Complete remaining gaps and improve system reliability:
1. Export completeness warnings (GAP-E1)
2. Snapshot staleness detection (GAP-E2)
3. SLA tiers documentation (GAP-D1)
4. Token refresh grace period (GAP-F1)
5. Security contact verification (GAP-A1)
6. asUser() scope justification (GAP-B1)

### Week 2 Tasks

#### Monday: Export Completeness Warnings (GAP-E1)
**Owner:** Backend Engineer (6 hours)

1. **Update export schema for completeness** (2h)
   - Add completeness % to ExportMetadata
   - Add warnings[] array to export
   - Add missingData[] array to export

2. **Update export generation** (2h)
   - Calculate completeness from available data
   - Generate warnings for missing data
   - Calculate snapshot age

3. **Update export UI** (2h)
   - Display warning banner if completeness < 100%
   - Show which data is missing
   - Suggest remediation (re-run capture, check logs)

**Deliverables:**
- [x] ExportMetadata with completeness tracking
- [x] Updated export generation with warnings
- [x] Updated export UI with warning banner

**Success Criteria:**
- Exports show completeness %
- User sees "Data is 78% complete; automation_rules missing"
- No silent data loss

---

#### Tuesday: Snapshot Staleness Detection (GAP-E2)
**Owner:** Backend Engineer (3 hours)

1. **Add capturedAt field to snapshots** (1h)
   - Update Snapshot interface
   - Capture timestamp in snapshot_capture.ts
   - Store in Forge Storage

2. **Add staleness check to export** (1h)
   - Calculate age in hours
   - Add warning if > 24h old
   - Display in export metadata

3. **Test staleness detection** (1h)
   - Create snapshot with old timestamp
   - Verify warning appears on export
   - Test edge cases (very old, recent)

**Deliverables:**
- [x] Snapshot interface includes capturedAt: Date
- [x] Export warns if snapshot > 24h old
- [x] Tests for staleness calculation

**Success Criteria:**
- User sees "⚠️ Snapshot is 48h old; may be stale"
- Can still export stale data (with warning)

---

#### Wednesday: SLA Tiers & Security Hardening (GAP-D1 + GAP-A1)
**Owner:** Security Engineer (4 hours)

1. **Add severity-based SLAs to SECURITY.md** (2h)
   - Document SEV-1/2/3 definitions
   - Define response timeframes
   - Add escalation path (PagerDuty for SEV-1)

2. **Verify security contact** (1h)
   - Add MX record validation script
   - Add to CI: verify-security-contact.sh
   - Document verification in SECURITY.md

3. **Test vulnerability reporting flow** (1h)
   - Send test email to security@firsttry.dev
   - Verify delivery and response
   - Document procedure

**Deliverables:**
- [x] SECURITY.md with severity SLA tiers
- [x] scripts/verify-security-contact.sh
- [x] Test: Vulnerability report received and responded to

**Success Criteria:**
- Severity tiers clearly defined
- Response times publicly committed
- Security contact verified and monitored

---

#### Wednesday-Thursday: Token Refresh & Scope Justification
**Owner:** Backend Engineer (4 hours)

1. **Document token refresh configuration** (2h)
   - Add DEVELOPING.md: "Token Refresh Configuration" section
   - Document TTL (24h), refresh interval (12h), grace period (6h)
   - Document failure alerting

2. **Justify asUser() scope usage** (1h)
   - Add JSDoc comments to asUser() calls in drift_storage.ts
   - Explain why asUser() is preferred over asApp()
   - Reference DEVELOPING.md for context

3. **Add token expiry alerts** (1h)
   - Update admin page to show token expiry countdown
   - Add alert if token expires in < 6h
   - Provide manual refresh button

**Deliverables:**
- [x] DEVELOPING.md: Token Refresh Configuration
- [x] JSDoc comments justifying asUser() usage
- [x] Admin UI: Token expiry alerts

**Success Criteria:**
- Token refresh behavior transparent to operators
- asUser() usage justified and documented
- Token expiry won't surprise operators

---

#### Friday: SLI/SLO Definition (GAP-I1)
**Owner:** Security Engineer (4 hours)

1. **Define SLIs for FirstTry** (2h)
   - Snapshot capture success rate (daily)
   - Determinism pass rate (drift compute)
   - Export freshness (% exports < 24h old)

2. **Set SLO targets** (1h)
   - Snapshot success: 99.5%
   - Determinism: 100%
   - Freshness: 95%

3. **Document in README.md** (1h)
   - Add "Reliability & SLOs" section
   - Publish SLI/SLO targets
   - Link to monitoring dashboard (future)

**Deliverables:**
- [x] README.md: SLI/SLO section with targets
- [x] Internal metrics definition document
- [x] Placeholder for metrics export (future Week 3)

**Success Criteria:**
- SLIs/SLOs publicly documented
- Baseline metrics collection started
- Ready for Cloud Fortified certification (future)

---

### Week 2 Summary

| Task | Hours | Status |
|------|-------|--------|
| GAP-E1: Export Warnings | 6 | ON TRACK |
| GAP-E2: Staleness Detection | 3 | ON TRACK |
| GAP-D1: SLA Tiers | 4 | ON TRACK |
| GAP-F1: Token Refresh Docs | 4 | ON TRACK |
| GAP-I1: SLI/SLO Definition | 4 | ON TRACK |

**Week 2 Total: 21 hours**

**Milestone Achieved:**
All P1 + P2 gaps addressed. System reliability documented. Ready for Week 3 testing + marketplace submission.

---

## WEEK 3: TESTING, DOCUMENTATION & MARKETPLACE SUBMISSION

### Sprint Goal
1. Comprehensive testing of all fixes
2. Complete documentation package
3. Marketplace submission readiness

### Week 3 Tasks

#### Monday-Tuesday: Comprehensive Testing (QA)
**Owner:** QA Engineer (12 hours)

1. **Test all fixes end-to-end** (4h)
   - Test PII redaction globally
   - Test retention cleanup job
   - Test export versioning + migration
   - Test adversarial scenarios

2. **Test CI/CD integration** (2h)
   - Verify all new CI checks run
   - Test policy drift gates work correctly
   - Verify adversarial tests included in CI

3. **Performance testing** (2h)
   - Test cleanup job doesn't impact performance
   - Test adversarial tests run quickly
   - Measure storage usage before/after cleanup

4. **Regression testing** (2h)
   - Verify no existing features broken
   - Test backward compatibility (old exports)
   - Verify all tests passing

5. **Marketplace readiness checklist** (2h)
   - Go through MARKETPLACE_READINESS_CHECKLIST.md
   - Verify all items green
   - Flag any remaining gaps

**Deliverables:**
- [x] QA Report: All fixes verified
- [x] Regression test results
- [x] Marketplace readiness sign-off

**Success Criteria:**
- 100% of tests passing
- No regressions detected
- All gaps addressed

---

#### Wednesday: Documentation & Runbooks (Tech Writer)
**Owner:** Tech Writer (8 hours)

1. **Create operational runbooks** (3h)
   - Create INCIDENT_RESPONSE.md
   - Create DEPLOYMENT_ROLLBACK.md
   - Create TROUBLESHOOTING.md

2. **Update README.md** (2h)
   - Add "Security & Privacy" section
   - Add "Retention Policy" section
   - Add "Support & Reporting" section

3. **Create FAQ & best practices** (2h)
   - FAQ.md: Common questions + answers
   - BEST_PRACTICES.md: Recommended usage
   - GOTCHAS.md: Known limitations

4. **Verify all documentation** (1h)
   - Check links work
   - Verify examples are accurate
   - Ensure clarity for non-technical users

**Deliverables:**
- [x] INCIDENT_RESPONSE.md
- [x] DEPLOYMENT_ROLLBACK.md
- [x] TROUBLESHOOTING.md
- [x] FAQ.md, BEST_PRACTICES.md, GOTCHAS.md
- [x] Updated README.md with security/privacy sections

**Success Criteria:**
- All runbooks written and reviewed
- Documentation complete + discoverable
- No unanswered common questions

---

#### Thursday: Marketplace Submission Prep
**Owner:** Product Manager + Security Lead (4 hours)

1. **Prepare marketplace submission** (2h)
   - Prepare marketing description
   - Verify app icon (128x128)
   - Prepare screenshots
   - Prepare support contact info

2. **Final security review** (1h)
   - Security Lead reviews all fixes
   - Verify SECURITY.md complete
   - Verify no hardcoded secrets

3. **Legal review** (1h)
   - Verify PRIVACY.md compliant
   - Verify CONTRIBUTING.md clear
   - Verify no IP issues

**Deliverables:**
- [x] Marketplace submission package ready
- [x] Security review sign-off
- [x] Legal review sign-off

**Success Criteria:**
- All submission materials prepared
- Team aligned on messaging
- Ready to submit

---

#### Friday: Launch & Monitoring
**Owner:** Product Manager (4 hours)

1. **Submit to Atlassian Marketplace** (1h)
   - Fill out submission form
   - Upload all materials
   - Submit for review

2. **Set up monitoring** (1h)
   - Monitor app reviews on Marketplace
   - Monitor support email (security@firsttry.dev)
   - Set up alerts for critical issues

3. **Create post-launch runbook** (1h)
   - Document response procedure for Marketplace feedback
   - Create escalation path
   - Plan for rapid patches if issues found

4. **Celebrate & retrospective** (1h)
   - Team retrospective on audit + fixes
   - Lessons learned documented
   - Plan for continuous security improvement

**Deliverables:**
- [x] App submitted to Marketplace
- [x] Monitoring set up
- [x] Team retrospective completed

---

### Week 3 Summary

| Task | Hours | Owner |
|------|-------|-------|
| Comprehensive Testing | 12 | QA |
| Documentation | 8 | Tech Writer |
| Marketplace Prep | 4 | PM + Security |
| Launch & Monitoring | 4 | PM |

**Week 3 Total: 28 hours**

**Final Milestone:**
✅ Marketplace submission ready
✅ All security gaps addressed
✅ Documentation complete
✅ Team trained on incident response

---

## FUTURE: WEEK 4-6 (Continuous Improvement)

### Ongoing Tasks (Post-Launch)

#### Week 4: Cloud Fortified Certification (Optional)
- Set up metrics export to monitoring system
- Implement health check endpoints
- Document failover procedures
- Apply for Cloud Fortified certification

#### Week 5: Performance Optimization
- Profile cleanup job performance
- Optimize storage queries
- Implement caching layer (if needed)

#### Week 6: Advanced Hardening
- Implement penetration testing
- Add rate limiting
- Implement audit logging
- Set up security monitoring alerts

---

## RESOURCE ALLOCATION

### Team Composition

**Security Engineer (40 hours)**
- Week 1: PII logging + policy gates (14h)
- Week 2: SLA tiers + SLI/SLO (8h)
- Week 3: Security review + planning (4h)
- Post-launch: Ongoing security monitoring (14h)

**Backend Engineer (35 hours)**
- Week 1: Retention + adversarial tests (16h)
- Week 2: Export completeness + staleness (9h)
- Week 3: Testing + bug fixes (8h)
- Post-launch: Optimization (2h)

**QA Engineer (20 hours)**
- Week 1: Adversarial test suite (8h)
- Week 2: Hardening validation (4h)
- Week 3: Comprehensive testing (12h)
- Post-launch: Regression testing (ongoing)

**Tech Writer (8 hours)**
- Week 2: Documentation planning (2h)
- Week 3: Documentation + runbooks (8h)

**Product Manager (8 hours)**
- Week 2: Marketplace review criteria (2h)
- Week 3: Submission + launch (6h)

**Total: 111 hours (~3 weeks, 37 hours/week)**

---

## BUDGET ESTIMATE

Assuming fully-loaded cost (salary + benefits + overhead):

| Role | Hours | Rate | Cost |
|------|-------|------|------|
| Security Engineer (Senior) | 40 | $250/h | $10,000 |
| Backend Engineer (Mid) | 35 | $200/h | $7,000 |
| QA Engineer (Mid) | 20 | $150/h | $3,000 |
| Tech Writer | 8 | $100/h | $800 |
| Product Manager | 8 | $200/h | $1,600 |

**Total Estimated Cost: $22,400**

(Note: May vary by geography and company salary structure)

---

## RISK MITIGATION

### High-Risk Items

1. **Retention cleanup job delete failures**
   - Mitigation: Dry-run mode; require manual confirmation
   - Fallback: Rollback to previous week's job

2. **Adversarial tests reveal new vulnerabilities**
   - Mitigation: Plan buffer week (Week 1.5) for critical fixes
   - Escalation: Skip lower-priority fixes to unblock approval

3. **Marketplace review delays**
   - Mitigation: Submit early in week; follow up proactively
   - Escalation: Involve Atlassian support if > 2 weeks

### Mitigation Strategies

- **Daily standup:** Catch blockers early
- **Weekly sign-off:** Ensure milestones met
- **Buffer time:** 20% extra for unknowns
- **Escalation path:** Clear decision makers identified

---

## SUCCESS CRITERIA

### Week 1 Success
- [ ] All 5 P1 blockers (C1, C2, G1, H1, J1) implemented
- [ ] All new tests passing
- [ ] Zero regressions in existing tests
- [ ] Security review: All implementations approved

### Week 2 Success
- [ ] All 5 P2 gaps (E1, E2, D1, F1, A1) implemented
- [ ] SLI/SLO targets documented
- [ ] Documentation 80% complete
- [ ] Team trained on new procedures

### Week 3 Success
- [ ] 100% test pass rate
- [ ] All documentation complete
- [ ] Marketplace submission materials ready
- [ ] Legal + Security sign-off obtained
- [ ] App submitted to Marketplace

---

## CONCLUSION

This roadmap provides a clear path to Marketplace approval within 4-5 weeks. The critical path is driven by 5 high-risk security gaps (P1) that must be fixed before submission. Secondary hardening (P2) can be parallelized to reduce overall timeline.

**Key Success Factors:**
1. Daily communication between security, engineering, and QA
2. Early marketplace review criteria alignment with Atlassian
3. Proactive risk identification and mitigation
4. Quality testing (especially adversarial scenarios)
5. Clear documentation for compliance + operations

**Next Step:** Schedule kickoff meeting to assign owners and confirm timelines.


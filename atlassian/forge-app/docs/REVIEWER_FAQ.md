# Marketplace Reviewer FAQ

**For**: Atlassian Marketplace Review Team  
**Updated**: 2026-01-10  
**App**: FirstTry Governance

---

## Q1: What does FirstTry do?

**A**: FirstTry collects Jira governance evidence (project metadata, issue timestamps, workflows) and displays it in a read-only admin dashboard. It helps Jira teams understand their compliance posture.

---

## Q2: Is the app read-only?

**A**: ✅ **YES, completely read-only**.

- No write scopes declared (no `write:jira` or `manage:jira`)
- All API calls use GET method (enforced by `src/runtime_guards/assert_read_only.ts`)
- Evidence: `tests/perf_signals/no_jira_writes_contract.test.ts` (test suite verifies this)

---

## Q3: What data does it access?

**A**: 
- ✅ **Yes**: Project names, issue keys, timestamps, assignee IDs, issue status, field schema
- ❌ **No**: Issue descriptions, comments, attachments, custom field values, user emails

All accessed via Jira's `read:jira-work` scope.

---

## Q4: Where is data stored?

**A**: In Jira's Forge Storage (encrypted, scoped to the app, managed by Atlassian). Data is stored for 90 days, then automatically deleted.

Evidence: `src/retention/cleanup.ts` + `docs/DATA_RETENTION_POLICY.md`

---

## Q5: Does FirstTry send data externally?

**A**: ✅ **NO external egress**.

- No third-party API calls
- No analytics, logging, or telemetry
- Data stays within Jira Cloud infrastructure

Evidence: `docs/EXTERNAL_APIS.md` (documents the zero external APIs)

---

## Q6: How was this verified?

**A**: Multiple verification methods:

1. **Code Scans** (`audit/proof_runs/run_20260110_121856/`):
   - `jira_api_call_sites.txt`: All Jira API calls (all GET)
   - `code_write_surface_scan.txt`: No POST/PUT/DELETE to Jira

2. **Tests** (1243 tests, all passing):
   - `npm test`: Normal mode ✅
   - `FIRSTTRY_DETERMINISTIC=1 npm test`: Deterministic mode ✅
   - Specific contract tests: `no_jira_writes_contract.test.ts`

3. **Manifest Validation**:
   - `forge lint`: Passes (no issues)
   - Scope declaration: Exactly 2 scopes (no extras)

---

## Q7: Is the app secure?

**A**: ✅ **Yes**.

- npm audit: 0 vulnerabilities
- Runtime guards enforce GET-only
- Type contracts prevent data leaks
- All tests pass (including determinism verification)

---

## Q8: What if there's a security issue?

**A**: See `legal/VULNERABILITY_DISCLOSURE.md` for responsible disclosure process.

- Email: `contact@firsttry.run`
- Response target: 24 hours

---

## Q9: Who owns FirstTry?

**A**: FirstTry Governance is developed by Arnab Poddar (contact@firsttry.run).

---

## Q10: What are the permissions requirements?

**A**: Jira admin permission required to install the app. Once installed, the app reads public metadata (projects, issues, statuses). Individual users see only what they have permission to see in Jira.

---

## Q11: Can admins control what data is collected?

**A**: ✅ **Yes**.

- Uninstall the app to stop data collection
- Trigger manual evidence deletion
- Automatic cleanup happens every 90 days

---

## Q12: What about compliance (SOC 2, HIPAA, ISO)?

**A**: FirstTry is **NOT independently certified** for HIPAA, SOC 2, or ISO 27001.

However:
- Runs on Jira Cloud (which is compliant)
- Uses only read-only APIs
- Stores data in Jira's encrypted storage
- Does not store PII or sensitive data

If your organization requires third-party certification, contact `contact@firsttry.run` for a custom compliance review.

---

## Q13: How often is data updated?

**A**: Scheduled pipelines run:
- **Every 5 minutes**: Auto-trigger pipeline (Phase 5)
- **Daily**: Evidence snapshot + config visibility
- **Weekly**: Evidence consolidation

Evidence: `manifest.yml` (lines 52-71, scheduled triggers)

---

## Q14: What about determinism?

**A**: FirstTry is deterministic by design:
- Same input (Jira state) → same output (evidence)
- Hash digests prove immutability
- Tests run in deterministic mode: `FIRSTTRY_DETERMINISTIC=1`

All tests pass in both modes.

---

## Q15: Can FirstTry scale to large Jira instances?

**A**: Yes.

- API calls paginate correctly
- Rate limiting with exponential backoff
- Scheduled jobs are single-threaded (no race conditions)

---

**More Questions?** Contact: `contact@firsttry.run`


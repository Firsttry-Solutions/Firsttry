# FirstTry Incident Response Policy

**Version**: 3.2  
**Effective Date**: 2026-02-15  
**Marker**: [FT_SUPPORT_POLICY_PUBLISHED]

---

## Overview

This policy establishes incident classification, response procedures, communication protocols, and postmortem practices for FirstTry operational incidents.

---

## Incident Classification

### Severity Matrix

| Severity     | Availability Impact | Data Impact | Customer Count | Response Time |
|--------------|-------------------|-------------|----------------|---------------|
| **P1-CRITICAL** | Entire service down (>30 min) | Data loss or corruption | >50 customers | 15 min |
| **P2-HIGH** | Feature unavailable | No data loss; degraded function | 10-50 customers | 30 min |
| **P3-MEDIUM** | Performance degraded >50% | Minor inconsistency | 1-10 customers | 1 hour |
| **P4-LOW** | Minor UX issue; no availability impact | None | <5 customers | Best effort |

### Incident Categories

- **Availability**: Service unreachable, timeouts, 5xx errors
- **Data Integrity**: Hash mismatch, corruption, unauthorized modifications  
- **Security**: Unauthorized access, data breach, vulnerability exploit
- **Performance**: Response time >3× normal baseline
- **Compliance**: Retention policy violation, audit trail loss, residency breach

---

## Incident Response Timeline

### Phase 1: Detection & Acknowledgement (T+0 to T+15 min)

**Trigger**: Alert fired (automated) or customer reports issue

**Actions**:
1. Page on-call engineer (P1/P2) or triage queue (P3/P4)
2. Create incident ticket (template below)
3. Standup customer internal communication channel
4. Acknowledge customer with ticket number + ETA

**Roles**:
- **Incident Lead**: Overall coordination + communication
- **Technical Lead**: Root cause analysis + debugging
- **Communications**: Customer updates + status page

**Template**:
```
Title: [INCIDENT] Service degradation in ap-south-1 region
Severity: P2-HIGH  
Affected: Export resolver (read impacted; write unaffected)
Customers: 12 of 45 (APAC region)
Started: 2026-02-15T14:23:00Z
Status: Investigation in progress
ETA Resolution: 2026-02-15T14:50:00Z +/- 10 min
```

---

### Phase 2: Investigation (T+15 min to T+60 min)

**Goal**: Confirm issue scope; identify root cause

**Actions**:
1. Check infrastructure health (Forge dashboard, AWS console)
2. Examine application logs (first 1000 errors)
3. Run diagnostics:
   - `scripts/build/verify_build_discipline.sh` (check build integrity)
   - `tests/proof/run_phase3_enterprise_proof.mjs` (smoke test all features)
4. Identify affected data/tenants
5. Notify Atlassian/AWS if infrastructure issue

**Diagnostic Commands**:
```bash
# Check Forge runtime health
forge logs --tail 100

# Verify app manifest integrity
grep -A5 "scopes:" atlassian/forge-app/manifest.yml

# Check rate limiter state
curl -H "Authorization: Bearer $TOKEN" \
  https://api.atlassian.com/site/{cloudId}/ext/firsttry-app/admin/limits

# Validate data consistency
node tests/proof/run_phase3_enterprise_proof.mjs
```

---

### Phase 3: Mitigation (T+60 min to T+120 min)

**Goal**: Restore service; minimize customer impact

**Options** (in priority order):

1. **Rollback** (fastest)
   - If caused by recent deploy: `git revert f23802b7` + redeploy
   - Time: ~5 min

2. **Configuration Fix** (quick)
   - Adjust rate limiter settings, scale envelope, TTL values
   - Time: ~10 min (deploy required)

3. **Workaround** (temporary)
   - Disable feature (e.g., disable exports; use read-only mode)
   - Notify customers of limitation
   - Time: Immediate

4. **Scalability** (if overload)
   - Request AWS capacity increase (Atlassian escalates)
   - Time: 15-30 min

5. **Code Fix** (complex issues)
   - Design fix, code review, test, deploy
   - Time: 60+ min

---

### Phase 4: Verification (T+120 min to T+135 min)

**Goal**: Confirm fix worked; no regression

**Actions**:
1. Re-run smoke tests (`run_phase3_enterprise_proof.mjs`)
2. Verify affected tenants can access service
3. Check metrics (export latency, error rate) back to baseline
4. Monitor for 15 min for secondary issues

**Success Criteria**:
- All smoke tests pass
- No new errors in logs
- Affected customers confirm service restored
- Metrics within 5% of baseline

---

### Phase 5: Communication (T+135 min to T+180 min)

**Goal**: Close incident; inform stakeholders

**Actions**:
1. Publish incident summary to status page:
   ```
   ✓ RESOLVED: 2026-02-15 14:45 UTC
   Root Cause: Rate limiter token bucket miscalculation (issue #12345)
   Impact: 12 customers; 22 min downtime; no data loss
   Prevention: Rate limiter unit tests added; CI check enabled
   ```

2. Send customer email:
   - Incident timeline + root cause explanation
   - What was affected + impact (data loss? No.)
   - What we did to fix
   - How to prevent in future

3. Publish postmortem summary to support page (P1/P2 only)

---

### Phase 6: Postmortem (T+24 hours)

**Goal**: Learn + prevent recurrence

**Attendees**:
- Incident Lead
- Technical Lead
- Product Manager
- Customer success (if multi-customer impact)

**Agenda** (60 min):
1. Timeline recap (10 min)
2. Root cause deep-dive (20 min)
3. Detection gaps (10 min)
4. Action items (15 min)
5. Publish findings (5 min)

**Output**: Public postmortem document
```
# Incident Postmortem: Rate Limiter Miscalculation (P2 / 12 customers)

## Timeline
- 14:23 UTC: Exports start failing with 429 Too Many Requests
- 14:38 UTC: Alert fired; incident response initiated
- 14:42 UTC: Root cause identified (off-by-one error in refill calculation)
- 14:45 UTC: Fix deployed; service restored
- Duration: 22 minutes

## Root Cause
Rate limiter token bucket refill logic had off-by-one error:
```js
// WRONG (incremented by 1 too many):
tokens =Math.min(capacity, tokens + (elapsed / period) + 1);

// FIXED:
tokens = Math.min(capacity, tokens + (elapsed / period));
```

## Why Not Caught?
- Unit tests existed but only tested happy path (100 concurrent exports)
- CI pipeline did not run stress tests by default
- Rate limiter logic not peer-reviewed during code merge

## Prevention
1. ✓ Added stress test to CI (1000 concurrent requests)
2. ✓ Mandatory peer review for all limits.ts changes
3. ✓ Added synthetic alert: if rejection rate >1%, page oncall

## Timeline to Prevention
- Code review: DONE (by 14:50 UTC same day)
- Stress test: DONE (by 15:30 UTC same day)
- CI integration: DONE (by 16:00 UTC same day)
- Deployment: v3.2.1-hotfix (2026-02-15 17:00 UTC)
```

**Distribution**: 
- Publish to /postmortems/ (public)
- Email all affected customers
- Distribute to engineering team (internal communication tool)

---

## Escalation Procedures

### Internal Escalation

```
P1 Critical
├─ Page Incident Lead (5 min)
├─ Page Technical Lead (5 min)
├─ Page On-Call (5 min)
├─ Escalate to VP Engineering if >30 min unresolved (30 min)
└─ Escalate to CTO if >1 hour unresolved (60 min)

P2 High
├─ Triage queue (15 min SLA)
├─ Assign to on-call + rotate if needed
└─ Escalate to Incident Lead if >2 hours unresolved

P3 Medium
├─ Add to backlog
└─ On-call owns within business hours

P4 Low
└─ Backlog; prioritize with product roadmap
```

### Customer Escalation

**P1/P2 (Major)**: 
- Initial notification via in-app alert
- Follow-up via customer's support ticket
- Update every 30 min
- Post-incident summary within 24 hours

**P3 (Medium)**:
- In-app notification
- Update every hour (if ongoing)
- Post-incident summary within 72 hours

**P4 (Low)**:
- In-app notification
- Response within business hours
- No specific update cadence

---

## Communication Template

### Initial Notification (T+15 min)

Subject: `[INCIDENT] FirstTry Service Alert - Ticket #INC-20260215-001`

```
Hi Customer,

We detected an issue with FirstTry access review exports starting at 2026-02-15 14:23 UTC.

IMPACT:
- Affected: Export feature (read access unaffected)
- Scope: APAC region 
- Status: Investigating

NEXT STEPS:
- Our team is investigating the root cause
- We will provide an update every 30 minutes
- ETA restoration: 2026-02-15 15:00 UTC (within 37 minutes)

Your ticket: #INC-20260215-001  
Real-time status: https://status.firsttry.app

Thank you for your patience.
```

### Resolution Notification (T+90 min)

Subject: `[RESOLVED] FirstTry Service Alert - Ticket #INC-20260215-001`

```
The issue has been resolved at 2026-02-15 14:45 UTC.

ROOT CAUSE:
Rate limiter token bucket miscalculation (off-by-one error in refill logic)

IMPACT:
- Duration: 22 minutes
- Customers affected: 12 of 45
- Data loss: None
- Audit trail: Preserved (all errors logged)

PREVENTION:
We've implemented:
1. Stress test in CI pipeline (1000 concurrent requests)
2. Mandatory code review for rate limiter changes
3. New synthetic alert if rejection rate >1%

Your exported data remains intact and verifiable via SHA-256 hash.

Postmortem: https://firsttry.app/postmortems/inc-20260215-001  
Next steps: Contact us if you experience any residual issues.
```

---

## Incident Metrics & Tracking

### Monthly Report

```
=== FirstTry Incident Report (February 2026) ===

Total Incidents: 8
- P1 CRITICAL: 0
- P2 HIGH: 2
- P3 MEDIUM: 3
- P4 LOW: 3

MTTR (Mean Time to Recovery):
- P1: N/A
- P2: 35 min (target: 120 min) ✓
- P3: 4 hours (target: 24 hours) ✓
- P4: N/A (no SLA)

MTTD (Mean Time to Detect):
- P1: N/A
- P2: 8 min (automated alert)
- P3: 2 hours (customer report)
- P4: 1+ weeks (customer report)

Root Causes:
- Configuration error: 3 incidents
- Code bug: 2 incidents
- Infrastructure: 2 incidents
- Customer error: 1 incident

Prevention Status:
- 6 of 8 incidents have action items
- 4 action items DONE
- 2 action items in progress (ETA 2026-02-28)

Trend:
- This month: 8 incidents (↓ 20% vs Jan)
- Most common: Rate limiting edge cases
- Improvement: Stress tests catching 2 issues before production
```

---

## Incident Severity Examples

### P1 CRITICAL Examples

- "FirstTry app missing from Jira marketplace; all orgs can't install"
- "Forge storage corrupted; all tenant data inaccessible for >30 min"
- "Security breach: unauthorized access to PII in audit trail"

### P2 HIGH Examples

- "Exports timing out for customers with >5000 entities"
- "RBAC delegation resolver down; admins can't add reviewers"
- "Rate limiter rejecting valid requests; false positives"

### P3 MEDIUM Examples

- "Dashboard takes 10s to load (normal: 1s)"
- "Reviewer group snapshot occasionally shows stale data"
- "Export CSV has minor formatting issue (data correct)"

### P4 LOW Examples

- "Typo in error message"
- "UI button color slightly off"
- "Feature request: Add dark mode"

---

## Appendix: Runbooks by Symptom

### Symptom: Exports Timing Out (>240s)

**Diagnosis**:
```bash
curl https://forge-app:3000/admin/metrics | jq '.exports[-5:]'
```

**If entity_count >9500**: Scale envelope triggered; expected  
**Action**: Advise customer to reduce date range

**If entity_count <5000**: Investigate performance regression  
**Action**: 
1. Roll back last deploy
2. Check Forge runtime CPU usage
3. Run benchmark harness

---

### Symptom: Hash Mismatch Detected

**Diagnosis**:
```bash
node tests/proof/run_phase3_enterprise_proof.mjs | grep "HASH_MISMATCH"
```

**P1 CRITICAL**: Data potentially tampered or corrupted  
**Action**:
1. Take service offline (fail-closed)
2. Contact Atlassian Security
3. Begin full forensic audit

**P4 LOW**: Likely client-side issue (user modified export)  
**Action**: Ask customer to re-download export

---

This policy is effective as of 2026-02-15 and reviewed quarterly.

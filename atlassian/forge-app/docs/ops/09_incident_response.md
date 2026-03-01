# Incident Response — Operator Steps, Evidence Capture, Communications

**Doc ID:** FT-OPS-009  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

On-call operators responding to production incidents.

## Prerequisites

- Access to production Jira site (firsttry.atlassian.net)
- Forge CLI authenticated
- Incident communication channel access

## What Success Looks Like

- Incident detected and categorized
- Evidence captured before remediation
- Issue resolved or escalated
- Incident documented

## Incident Severity Levels

### P0 — Critical

**Definition:** Production down, data integrity compromised, security breach.

**Response time:** Immediate (< 15 minutes)

**Examples:**
- App completely unavailable in production Jira
- Customer data visible across tenants (isolation breach)
- Active security exploit

**Escalation:** Immediate to security.contact@firsttry.run

### P1 — High

**Definition:** Major functionality broken, significant performance degradation.

**Response time:** < 1 hour

**Examples:**
- Core features non-functional (audit evidence export fails)
- App loads but major UI errors
- Performance degraded >50%

**Escalation:** Operations team, then maintainers

### P2 — Medium

**Definition:** Minor functionality broken, workarounds available.

**Response time:** < 4 hours

**Examples:**
- Non-critical feature broken
- UI cosmetic issues
- Slow but functional

**Escalation:** File GitHub issue, schedule fix

### P3 — Low

**Definition:** Cosmetic issues, no functional impact.

**Response time:** Next sprint

**Examples:**
- Documentation typos
- Minor UI alignment
- Non-blocking warnings

**Escalation:** file GitHub issue, backlog

## Incident Response Procedure

### Step 1: Detect and Confirm

**Detection sources:**
- User report
- Monitoring alert
- Log anomaly
- Automated health check

**Confirmation:**
```bash
# Check app status
curl -I https://firsttry.atlassian.net

# Check Forge logs
forge logs --tail --follow

# Verify in browser
# Navigate to app UI, attempt core functionality
```

**Categorize severity:** Use matrix above.

### Step 2: Capture Evidence (BEFORE fixing)

**Critical:** Evidence must be captured BEFORE any remediation attempts.

```bash
# Capture Forge logs
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
evidence_dir="/tmp/incident_${timestamp}"
mkdir -p "$evidence_dir"

forge logs --tail 1000 > "$evidence_dir/forge_logs_${timestamp}.txt"

# Capture deployment state
forge deploy history > "$evidence_dir/deploy_history.txt"
forge install --list > "$evidence_dir/install_list.txt"
forge whoami > "$evidence_dir/operator_identity.txt"

# Capture system state
cd /path/to/Firsttry
git log --oneline -10 > "$evidence_dir/git_recent_commits.txt"
git status > "$evidence_dir/git_status.txt"
cd atlassian/forge-app
jq '.version' package.json > "$evidence_dir/package_version.txt"

# Capture browser console (if UI issue)
# F12 > Console > Copy all to "$evidence_dir/browser_console.txt"

# Capture screenshots
# Save to "$evidence_dir/screenshot_${timestamp}.png"
```

**Preserve evidence:**
```bash
tar -czf "/tmp/incident_${timestamp}.tar.gz" "$evidence_dir"
echo "Evidence archived: /tmp/incident_${timestamp}.tar.gz"
```

### Step 3: Assess Impact

**Questions to answer:**
- How many users affected? (all, subset, single tenant)
- What functionality is broken? (complete outage, partial)
- Is data integrity compromised? (data loss, corruption, cross-tenant visibility)
- Is this a regression? (worked before, broke after deployment)

**Document answers:**
```bash
cat > "$evidence_dir/impact_assessment.txt" << EOF
Incident: [Brief description]
Detected: ${timestamp}
Severity: [P0/P1/P2/P3]
Affected users: [all / subset / single tenant]
Broken functionality: [list]
Data integrity: [ok / compromised / unknown]
Regression: [yes / no / unknown]
Last known good version: [version or deployment ID]
EOF
```

### Step 4: Communication

#### For P0/P1, notify immediately:

**Internal:**
```
[P0 INCIDENT] FirstTry production outage

Status: INVESTIGATING
Detected: 2026-03-01T12:00:00Z
Impact: [brief description]
Affected: [scope]

Investigating operator: [your name]
Evidence: /tmp/incident_20260301T120000Z.tar.gz

Updates every 15 minutes to this channel.
```

**External (if customer-facing):**
```
Subject: FirstTry Service Incident

We are investigating an issue affecting FirstTry on your Jira site.

Impact: [brief, non-technical description]
Status: Investigating
Expected resolution: [time estimate or "unknown, will update hourly"]

For questions: support@firsttry.run
Incident ID: INC-20260301-001
```

#### For P2/P3, file GitHub issue:

Title: `[P2] Brief description`  
Labels: `incident`, `priorit:high`  
Body: Link to evidence archive, impact assessment.

### Step 5: Remediation

**Decision matrix:**

| Scenario | Action |
|----------|--------|
| Known bug with fix ready | Apply fix, deploy |
| Recent deployment caused regression | Rollback to previous deployment |
| Configuration issue | Adjust configuration, verify |
| Unknown root cause | Escalate to maintainers |
| Data integrity compromised | DO NOT FIX, escalate to security immediately |

**Rollback procedure:**
```bash
# See 08_release_procedure.md for detailed steps
forge deploy history
forge deploy rollback --deployment-id PREVIOUS_DEPLOYMENT_ID
forge install --upgrade --site firsttry.atlassian.net
```

**Apply fix procedure:**
```bash
# Emergency hotfix (see 08_release_procedure.md)
git checkout -b hotfix/incident-fix
# ... make minimal fix ...
git commit -m "fix: incident resolution"
# Open PR, request expedited review
# After merge:
forge deploy
forge install --upgrade
```

### Step 6: Verification

After remediation, verify resolution:

```bash
# Check Forge logs for errors
forge logs --tail 100 | grep -i error

# Verify in browser
# Navigate to affected functionality, test end-to-end

# Monitor for 30 minutes
# Watch logs for anomalies
forge logs --tail --follow
# Ctrl+C after 30 min if stable
```

**Resolution criteria:**
- [ ] Primary functionality restored
- [ ] No errors in logs (30 min window)
- [ ] User confirmation (if customer-reported)
- [ ] Performance metrics normal

### Step 7: Post-Incident Review

Create incident report within 24 hours:

**File:** `atlassian/forge-app/docs/incidents/YYYY-MM-DD-brief-description.md`

**Template:**
```markdown
# Incident Report: [Brief Description]

**Incident ID:** INC-20260301-001  
**Severity:** P1  
**Detected:** 2026-03-01T12:00:00Z  
**Resolved:** 2026-03-01T14:30:00Z  
**Duration:** 2.5 hours  

## Summary

[1-2 sentence description]

## Timeline

- 12:00 UTC: Incident detected via user report
- 12:05 UTC: Evidence captured
- 12:15 UTC: Rollback initiated
- 12:30 UTC: Rollback completed, verification started
- 14:30 UTC: Incident resolved, monitoring continues

## Root Cause

[Technical analysis of what caused the incident]

## Impact

- Users affected: [number or "all"]
- Functionality impacted: [list]
- Data integrity: [ok / issues noted below]
- Customer-facing: [yes / no]

## Resolution

[What action was taken to resolve]

## Prevention

[Measures to prevent recurrence]

## Action Items

- [ ] [Specific action] (assigned to, due date)
- [ ] [Specific action] (assigned to, due date)

## Evidence

- Archive: /tmp/incident_20260301T120000Z.tar.gz
- Forge logs: Attached
- Commit: [git commit hash if fix deployed]
```

**Commit incident report:**
```bash
cd /path/to/Firsttry
git add atlassian/forge-app/docs/incidents/2026-03-01-*.md
git commit -m "docs: incident report INC-20260301-001"
git push origin main
```

## Escalation Contacts

| Severity | Contact | Response SLA |
|----------|---------|--------------|
| P0 (data integrity, security) | security.contact@firsttry.run | Immediate |
| P1 (production outage) | operations@firsttry.run | < 15 min |
| P2 (degraded) | GitHub issue + operations@firsttry.run | < 4 hours |
| P3 (cosmetic) | GitHub issue | Next sprint |

## Runbooks for Common Incidents

### Incident: App UI blank screen

**Symptoms:** White screen, no content, no errors in Network tab.

**Evidence:**
- Browser console errors
- Forge logs

**Likely cause:** JavaScript error, missing bundle.

**Fix:**
```bash
forge deploy history
# If recent deployment:
forge deploy rollback --deployment-id PREVIOUS_ID
forge install --upgrade
```

### Incident: "Storage quota exceeded"

**Symptoms:** Operations fail with storage error.

**Evidence:**
- Forge logs showing "quota exceeded"
- Affected tenant ID

**Likely cause:** Tenant exceeded 5 MB storage limit.

**Fix:**
1. Implement data cleanup (delete old audit evidence)
2. Or request quota increase from Atlassian
3. Notify customer of storage limits

### Incident: Backend function timeout

**Symptoms:** Operations slow or fail with timeout.

**Evidence:**
- Forge logs showing "function timeout"
- Slow API response times

**Likely cause:** Function exceeds 10s limit.

**Fix:**
1. Optimize function logic
2. Implement pagination
3. Cache results
4. Deploy optimized version

### Incident: Cross-tenant data visibility

**Symptoms:** User sees data from another installation.

**Evidence:**
- User report with screenshots
- Storage key inspection
- Tenant ID correlation

**Classification:** P0 — CRITICAL SECURITY ISSUE

**Fix:**
1. DO NOT attempt fix
2. Immediately escalate to security.contact@firsttry.run
3. Disable app installations (if confirmed)
4. Await maintainer guidance

## Troubleshooting

### Issue: Cannot capture Forge logs

**Cause:** Auth token expired.

**Fix:**
```bash
forge logout
forge login
forge logs --tail 1000
```

### Issue: Rollback fails

**Cause:** Deployment ID not found, or deployment corrupted.

**Fix:** Escalate to Forge support, cannot self-resolve.

### Issue: Evidence directory deleted accidentally

**Cause:** `/tmp` cleanup script.

**Fix:** Evidence is unrecoverable. Document in incident report, proceed with available information.

## Next Steps

- **For release procedures:** [08_release_procedure.md](08_release_procedure.md)
- **For known limits:** [10_known_limits.md](10_known_limits.md)

## Notes

- **Evidence first, fix second.** Never skip evidence capture.
- **Communication early and often.** Update stakeholders every 15 min for P0/P1.
- **Document everything.** Incident reports prevent recurrence.
- **P0 data integrity issues are STOP-THE-WORLD.** Escalate immediately, do not attempt fix.

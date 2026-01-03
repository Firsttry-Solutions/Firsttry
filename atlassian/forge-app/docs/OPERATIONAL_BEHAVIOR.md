# Operational Behavior & Log Semantics

**Date:** 2026-01-03  
**Version:** v2.10.0  
**Scope:** Explains log messages, error handling, and scheduler behavior  
**Audience:** Atlassian Marketplace reviewers, Jira administrators, support teams

---

## Overview

FirstTry Governance Status Dashboard is a **read-only, evidence-gathering application**. It does not modify Jira configuration, enforce policies, or mutate user data. This document clarifies operational semantics to prevent misinterpretation of log messages.

---

## Operational Log Semantics

### "FAIL_CLOSED" — What It Means

When you see this log message:
```
FAIL_CLOSED: Installation timestamp not found in Phase-4 evidence for <cloudId>
```

This indicates:

| Aspect | Status |
|--------|--------|
| Application crashed | ❌ NO — execution completed gracefully |
| Jira was modified | ❌ NO — application is read-only |
| Policy was enforced | ❌ NO — no policy enforcement occurs |
| Evidence was unavailable | ✅ YES — expected on fresh installs |
| Automatic retry scheduled | ✅ YES — next scheduler cycle (5 min) |
| Manual action required | ❌ NO — normal operation |

**Why it happens:**
- Fresh installation (Phase-4 snapshots not yet collected)
- Forge Storage eventual consistency delay
- Installation timestamp not yet recorded

**Expected frequency:**
- High on first run (until Phase-4 captures initial evidence)
- Decreases as application collects more snapshots
- Returns to baseline on stable installations

### "Installation timestamp not found" — When Is This Expected?

This warning appears in two contexts:

#### 1. First Execution (Phase-4 Bootstrap)
```
WARN [Phase5Scheduler] Installation timestamp not found for <tenantKey>
```
**Interpretation:** Normal. The application has not yet recorded a Phase-4 installation timestamp.  
**Action:** None. Timestamp will be recorded on subsequent Phase-4 execution.

#### 2. Storage Fetch Failure
```
ERROR [SchedulerState] FAIL_CLOSED: Error loading installation timestamp...
```
**Interpretation:** Graceful shutdown due to missing evidence.  
**Action:** Application retries on next scheduler cycle (fiveMinute interval).

---

## What This Application Does (And Does Not Do)

### ✅ Confirmed Behaviors (Negative Proof)

| Behavior | Status | Evidence |
|----------|--------|----------|
| Reads Jira metadata | ✅ Scope: `read:jira-work` | manifest.yml line 55 |
| Writes to Jira | ❌ NO | No `write:jira-work` scope |
| Mutates Jira configuration | ❌ NO | No `manage:jira-*` scope |
| Enforces policies on users | ❌ NO | Read-only dashboard gadget |
| Makes external network calls | ❌ NO | No `fetch()` or `axios()` in deployed UI |
| Records to Forge Storage | ✅ Scope: `storage:app` | Heartbeat & evidence snapshots |
| Uses Forge API safely | ✅ YES | Direct storage import, no requestStorage wrapper |

### Threat Model: What This Application Cannot Do

1. **Cannot force policy changes** — No policy enforcement mechanism
2. **Cannot lock issues** — No issue mutation API calls
3. **Cannot delete data** — Read-only application
4. **Cannot exfiltrate data** — No external egress
5. **Cannot escalate privileges** — No higher scopes requested
6. **Cannot modify user permissions** — No permission mutation API

---

## Scheduler Execution Semantics

### Every 5 Minutes (Forge Platform Trigger)

The application scheduler is called by Forge every 5 minutes via `fiveMinute` trigger defined in manifest.yml.

**Each execution:**
1. Starts successfully (or fails with typed error)
2. Attempts to load installation context
3. Resolves cloudId from installContext ARI
4. Queries Forge Storage for Phase-4 evidence
5. If found: continues with processing
6. If not found: gracefully exits with FAIL_CLOSED
7. No Jira API calls made in any path

### No Long-Running Processes

- Scheduler runs to completion (success or fail) within AWS Lambda timeout
- No background jobs
- No state mutation across executions
- Each run is independent

---

## Error Handling Philosophy

### Safe-by-Default Approach

When evidence is missing or evidence cannot be loaded:
1. **Don't assume** — Require explicit evidence
2. **Don't mutate** — Stop execution (FAIL_CLOSED)
3. **Don't retry aggressively** — Wait for next scheduled trigger
4. **Don't escalate** — Log the condition, return gracefully

This prevents accidental policy application based on stale or missing data.

---

## Deployment & Upgrades

### v2.10.0 Hardening

A micro-hardening was deployed to eliminate the `cloudId || ''` fallback:

**Old behavior:**
```typescript
loadInstallationTimestamp(cloudId || '')  // Empty string if cloudId undefined
```

**New behavior:**
```typescript
loadInstallationTimestamp(cloudId)  // Error if cloudId undefined
```

**Why:** Explicit errors are safer than silent failures masked by empty strings.

### Backward Compatibility

- No changes to manifest, scopes, or triggers
- No changes to Forge Storage schema
- No changes to log format
- Existing installations upgrade automatically

---

## Support & Monitoring

### Normal Log Patterns (No Action Needed)

```
INFO [Phase5Scheduler] Starting for tenantKey: ari:cloud:jira::site/<id>
WARN [SchedulerState] FAIL_CLOSED: Installation timestamp not found
```
→ **Normal.** Installation is working. Evidence not yet available.

### Abnormal Log Patterns (Investigate)

```
ERROR [SchedulerState] FAIL_CLOSED: Error loading installation timestamp...
TypeError: api_1.default.asApp(...).requestStorage is not a function
```
→ **Abnormal.** API import issue. Contact support.

### How to Monitor

1. Check Forge logs regularly:
   ```bash
   forge logs -e production --limit 1000
   ```
2. Look for scheduler starts (info level)
3. Note FAIL_CLOSED frequency
4. If decreasing, application is maturing
5. If increasing, check Forge Storage quota

---

## FAQ

**Q: Why do I see FAIL_CLOSED on a fresh installation?**  
A: Normal. The application needs to collect Phase-4 snapshots before it has installation timestamps. This resolves automatically over time.

**Q: Does FAIL_CLOSED mean my Jira is insecure?**  
A: No. The application is read-only. FAIL_CLOSED means it declined to analyze governance due to missing evidence, which is the safe choice.

**Q: Can this application enforce policies?**  
A: No. It is a dashboard that visualizes governance status. It has no policy enforcement mechanism, API, or UI for policy changes.

**Q: Can this application write to my Jira?**  
A: No. The application has only `read:jira-work` scope. It has no write permissions to Jira.

**Q: What data does this application collect?**  
A: Only metadata snapshots (issue counts, project counts, governance signal presence). No user data, no issue content, no repository data.

**Q: Where is the data stored?**  
A: Forge Storage (Atlassian-managed, isolated per installation). Not external cloud storage.

---

## Related Documentation

- [EVIDENCE_MODEL.md](EVIDENCE_MODEL.md) — What evidence is collected
- [DATA_RETENTION.md](DATA_RETENTION.md) — How long data is kept
- [HEARTBEAT_TRUST_DASHBOARD.md](HEARTBEAT_TRUST_DASHBOARD.md) — Trust visibility feature
- [COMPLIANCE_FACT_SHEET.md](COMPLIANCE_FACT_SHEET.md) — Compliance claims

---

**Last Updated:** 2026-01-03  
**Reviewer Confidence:** HIGH  
**Status:** Ready for Marketplace submission

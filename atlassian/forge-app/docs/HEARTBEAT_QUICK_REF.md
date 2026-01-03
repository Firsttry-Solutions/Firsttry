# Heartbeat Trust Dashboard - Quick Reference

## What Is This?

A read-only Jira dashboard gadget that displays **operational proof** of FirstTry's monitoring activities.

**Not a control panel. Not admin UI. Not a feature surface.**

Just transparency—with both timing layers disclosed for complete honesty.

## Two-Layer Timing Model

**Layer 1: Platform Trigger**  
- Fires every **5 minutes** (Forge limit)
- Shown as "Platform pings"

**Layer 2: Meaningful Check Cadence**  
- Runs every **15 minutes** (FirstTry policy, enforced by gate)
- Shown as "Meaningful checks"  
- Staleness computed from this layer (30 min threshold)

Both are displayed so you know exactly what's happening and why.

---

## What Does It Show?

| Metric | Meaning | Updates |
|--------|---------|---------|
| **Status** | RUNNING / INITIALIZING / DEGRADED / DEGRADED (STALE) | Per meaningful check |
| **Last Successful Run** | Timestamp of last successful meaningful check | Per successful check |
| **Last Meaningful Check** | Timestamp of last meaningful check (success/failure) | Every 15 minutes |
| **Last Platform Trigger Ping** | Timestamp of last platform scheduler ping | Every 5 minutes |
| **Platform Pings Observed** | Count of platform trigger pings | Every 5 minutes |
| **Meaningful Checks Completed** | Count of actual cadence checks executed | Every 15 minutes |
| **Snapshot Count** | Count of snapshot artifacts created | Per snapshot |
| **Days Since First Run** | Duration since first successful check | Calculated |
| **Platform Trigger Interval** | 5 minutes (Forge platform limit) | Fixed |
| **Meaningful Check Cadence** | 15 minutes (FirstTry policy) | Fixed |
| **Staleness Threshold** | 30 minutes (2 × 15 min cadence) | Fixed |
| **Version** | 0.1.0 | Fixed |
| **Environment** | From FIRSTTRY_ENV var or UNKNOWN | Fixed |

---

## What Do The Fields Mean?

### Status Values

- **INITIALIZING** – No heartbeat recorded yet (first run)
- **RUNNING** – Last meaningful check succeeded
- **DEGRADED** – Last meaningful check failed OR no check in 2 × cadence interval (30 min)
- **DEGRADED (STALE)** – No meaningful check for > 30 minutes (based on 15-min cadence)

### UNKNOWN Reasons

- **STORAGE_EMPTY** – No record created yet
- **NOT_YET_OBSERVED** – Event hasn't occurred
- **NOT_DECLARED** – Environment variable missing
- **NOT_AVAILABLE_IN_CONTEXT** – Forge can't identify tenant
- **NOT_IMPLEMENTED_IN_CODEBASE** – Feature doesn't exist

---

## How To Read It

1. **Check the Status** – Is FirstTry running?
2. **Check Last Successful Run** – How long ago did a check succeed?
3. **Check Data Availability** – Which fields are UNKNOWN and why?
4. **Read Disclosure** – Understand the limitations

**If something is UNKNOWN, it's listed in "Data Availability" with a reason.**

---

## Key Guarantees (Trust Boundaries)

✓ **Read-only operation**  
✓ **No Jira writes**  
✓ **No configuration changes**  
✓ **No policy enforcement**  
✓ **No recommendations**  
✓ **No external network calls / no data egress**  
✓ **No admin actions required**  

These are **always true**. The dashboard cannot violate them.

---

## Important Limitations

### Counters Are Best-Effort

Due to Forge Storage eventual consistency:
- **Checks Completed** count may lag
- **Snapshot Count** may lag
- They eventually converge, but may be slightly off during concurrent updates

**Not for precise auditing.** This is a transparency dashboard, not an audit log.

### No Precision Guarantees

- This dashboard proves **checks are happening**, not **what the checks are doing**
- It does not prove compliance
- It does not prove data accuracy
- It does not recommend actions

### Staleness Detection

If **no meaningful check has occurred in 30 minutes** (2× the 15-min cadence interval), status shows `DEGRADED (STALE)`.

**Note:** Platform trigger pings occur every 5 minutes, but staleness is based on MEANINGFUL CHECKS, which occur every 15 minutes.

This is a signal that the scheduler may have stopped or meaningful checks are blocked. Check Forge logs.

### Timezone Display

Timestamps show in your browser's local timezone if available. Otherwise, they show UTC with a `UTC` label.

---

## When To Worry

| Situation | Action |
|-----------|--------|
| Status is `INITIALIZING` | Wait ~5 minutes for first check |
| Status is `RUNNING` with recent timestamp | Everything good |
| Status is `DEGRADED` with an error message | Check the error (truncated, secrets redacted) |
| Status is `DEGRADED (STALE)` for > 30 min | Scheduler may have stopped; check Forge logs |
| A field shows `UNKNOWN` | It's listed in "Data Availability" with a reason |
| Data Availability is empty | All metrics are available; system is fully observable |

---

## How It Works (Brief)

```
Scheduled Triggers (5 min, daily, weekly)
    ↓
Handlers execute checks/snapshots
    ↓
recordHeartbeatCheck() / recordSnapshot()
    ↓
Forge Storage: firsttry:heartbeat:<tenant>
    ↓
Dashboard gadget reads and displays
```

The heartbeat record is **never** modified by you. It's updated automatically by the handlers.

---

## Storage Key

```
firsttry:heartbeat:<cloudId>
```

Where `<cloudId>` is your Jira tenant ID. Each tenant has its own heartbeat record.

---

## What Happens After Install?

| Time | Status | Notes |
|------|--------|-------|
| 0 min | INITIALIZING | First scheduler run hasn't happened yet |
| 5 min | RUNNING | First check succeeded |
| 5 - 24 hr | RUNNING | Regular checks happening |
| 12 hr | AUTO_12H trigger fires | Phase 5 report generated (if due) |
| 24 hr | AUTO_24H trigger fires | Another phase 5 report generated |
| 1 day | RUNNING + 1 snapshot | Daily snapshot created |
| 7 days | RUNNING + snapshots | Weekly snapshot created |

---

## FAQ

**Q: Does this gadget write to Jira?**  
A: No. It's read-only. It only reads from Forge Storage.

**Q: Does it enforce policies?**  
A: No. It displays metrics only.

**Q: Can I configure it?**  
A: No. It displays what's in Forge Storage, nothing more.

**Q: Why does it say UNKNOWN?**  
A: The data hasn't been recorded yet, or a required environment variable is missing. Check "Data Availability" for details.

**Q: Why are the counters approximate?**  
A: Forge Storage eventual consistency. Updates may lag during concurrent operations, but converge over time.

**Q: How often does it update?**  
A: When you reload the page. It reads from current Forge Storage state.

**Q: What if the gadget shows DEGRADED (STALE)?**  
A: No meaningful check has occurred in 30 minutes. The scheduler may have stopped or meaningful checks are blocked. Check Forge function logs.

**Q: Can I manually trigger a check?**  
A: No. The dashboard is read-only observation only.

---

## Integration (For Developers)

The heartbeat recorder is called by existing handlers:

```typescript
import { recordHeartbeatCheck, recordSnapshot } from '../ops/heartbeat_recorder';

// In phase5_scheduler.run():
await recordHeartbeatCheck(cloudId, { success: checkPassed, error: errorMsg });

// In snapshot handlers:
await recordSnapshot(cloudId);
```

See `HEARTBEAT_INTEGRATION.md` for full details.

---

## Storage Limits

- **Key size:** ~50-100 bytes
- **Record size:** ~500 bytes (with error message)
- **Writes per day:** ~290 per tenant (manageable)

No quota concerns.

---

## Marketplace Submission

When submitting to Atlassian Marketplace:

1. Screenshots must be captured manually from a running instance
2. No mock data or fabricated screens
3. Gadget displays real heartbeat data
4. Describe what metrics mean (see documentation)
5. Highlight the trust boundaries

---

## Troubleshooting

**Gadget won't load:**
- Check browser console for errors
- Verify cloudId is available in Forge context
- Verify `src/gadget-ui` resource is deployed

**Status shows INITIALIZING:**
- Normal after first install
- Wait ~5 minutes for scheduler to run
- Check manifest triggers are enabled

**Status shows DEGRADED without error:**
- Last check may have failed silently
- Check Forge function logs
- Wait for next scheduled check

**Counters not increasing:**
- May be Forge Storage eventual consistency lag
- Reload the gadget
- Check that handlers are calling recordHeartbeatCheck()

**All fields show UNKNOWN:**
- cloudId not available in Forge context
- No heartbeat record created yet
- Check Forge logs for errors

---

## Files

| File | Purpose |
|------|---------|
| `src/gadget-ui/index.html` | Gadget UI (HTML + inline React) |
| `src/gadget-ui/heartbeat.tsx` | Gadget UI (TypeScript React component) |
| `src/ops/heartbeat_recorder.ts` | Storage recorder API |
| `docs/HEARTBEAT_TRUST_DASHBOARD.md` | Full documentation |
| `docs/HEARTBEAT_INTEGRATION.md` | Developer integration guide |
| `docs/HEARTBEAT_VERIFICATION.md` | Completion checklist |

---

## Version

**Heartbeat Dashboard Version:** 1.0  
**Gadget Version:** 0.1.0 (from package.json)  
**Last Updated:** 2025-01-03  

---

## Support

For issues or questions:
1. Check "Data Availability" for UNKNOWN fields
2. Review HEARTBEAT_TRUST_DASHBOARD.md
3. Review Forge function logs
4. Check manifest.yml trigger definitions

The gadget cannot be misconfigured—it's static. All issues are in the data source (storage or context).

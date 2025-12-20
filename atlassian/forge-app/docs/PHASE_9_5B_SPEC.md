# PHASE 9.5-B SPECIFICATION: HISTORICAL BLIND-SPOT MAP

**Version:** 1.0  
**Status:** Complete (with test fixes pending)  
**Key Invariant:** Visually expose unknown time ranges WITHOUT inferring causes.

---

## OVERVIEW

Phase 9.5-B automatically derives and visualizes historical periods where governance evidence is **missing**, and honestly explains why (using only factual reason codes).

The blind-spot map answers: **"When was governance evidence unavailable, and for what specific reason?"**

---

## CORE CONCEPTS

### Blind Spot

A continuous time period with **NO governance evidence**. Caused by:
1. **not_installed** - FirstTry not yet installed
2. **permission_missing** - Insufficient Jira permissions
3. **snapshot_failed** - Snapshot execution failed
4. **unknown** - No evidence, reason not determined

### Severity Level

How significant the gap is:
- **critical** - Multi-week pre-install gaps, complete failures
- **high** - Week-long failures or permission issues
- **medium** - Days-long gaps in evidence

### Coverage Percentage

```
coverage = ((total_days - blind_days) / total_days) * 100
```

Example: 80% coverage = 20% of time period has blind spots.

---

## BLIND-SPOT DERIVATION RULES

### Rule 1: Pre-Install Period

**Trigger:** `first_install_date` provided AND before analysis window start

**Action:** Create blind spot for entire pre-install period
- Reason: `not_installed`
- Severity: `critical` (no governance possible)
- Duration: Start of window until install date

**Example:**
```
Analysis window: Jan 1 - Jan 31
Install date: Jan 15 at 10:00 AM
→ Blind spot: Jan 1 00:00 - Jan 15 10:00 (not_installed, critical)
```

### Rule 2: Execution Failures

**Trigger:** Snapshot run exists but `success == false`

**Action:** Create blind spot covering period when failure occurred
- Reason: Map `failure_reason` to reason code
  - `permission_denied` → `permission_missing`
  - `timeout`, `error`, etc. → `snapshot_failed`
  - Unknown → `snapshot_failed`
- Severity: Duration-dependent
- Duration: From last successful until failure point

**Example:**
```
Jan 10 10:00 - successful snapshot
Jan 12 10:00 - permission denied failure
Jan 15 10:00 - next attempt (failed)
→ Blind spot: Jan 10 10:00 - Jan 12 10:00 (permission_missing, high)
→ Blind spot: Jan 12 10:00 - Jan 15 10:00 (snapshot_failed, high)
```

### Rule 3: Execution Gaps

**Trigger:** No snapshot runs for > 12 hours between last success and next attempt

**Action:** Create blind spot for gap
- Reason: `unknown` (reason not determined from metadata)
- Severity: Duration-dependent
  - > 7 days: `high`
  - ≤ 7 days: `medium`
- Duration: Last successful until next run starts

**Example:**
```
Jan 10 10:00 - successful snapshot
Jan 13 10:00 - next successful snapshot (3 day gap)
→ Blind spot: Jan 10 10:00 - Jan 13 10:00 (unknown, high)
```

### Rule 4: Post-Analysis Period

**Trigger:** Last successful snapshot before analysis window end

**Action:** Create blind spot after last success
- Reason: `unknown`
- Severity: Duration-dependent
- Duration: Last successful until analysis window end

**Example:**
```
Jan 25 10:00 - successful snapshot (last one)
Analysis window ends: Jan 31 23:59
→ Blind spot: Jan 25 10:00 - Jan 31 23:59 (unknown, high)
```

### Rule 5: No Snapshot Runs in Window

**Trigger:** Zero snapshot runs in entire analysis window

**Action:** Entire window is blind spot
- Reason: `unknown`
- Severity: `critical`
- Duration: Entire analysis window

**Example:**
```
Analysis window: Jan 1 - Jan 31
Snapshot runs: none
→ Blind spot: Jan 1 00:00 - Jan 31 23:59 (unknown, critical)
```

---

## CRITICAL RULE: NO INFERENCE

**PROHIBITED:**
- ❌ Guessing why failures occurred
- ❌ Inferring permission vs. permission issues
- ❌ Suggesting root causes
- ❌ Recommending fixes
- ❌ Labeling as "good" or "bad"

**ALLOWED:**
- ✅ Reporting factual periods with missing evidence
- ✅ Using only stated reason codes
- ✅ Static text descriptions
- ✅ Visual highlighting (red = gap, green = evidence)
- ✅ Timestamp precision (ISO 8601 UTC)

---

## DATA MODEL

### BlindSpotPeriod

```typescript
{
  start_time: string,              // ISO 8601 UTC
  end_time: string,                // ISO 8601 UTC
  reason: 'not_installed'          // Factual reason code only
        | 'permission_missing'
        | 'snapshot_failed'
        | 'unknown',
  reason_description: string,      // Static text, no inference
  duration_days: number,           // (end_time - start_time) in days
  severity: 'critical'             // How significant
           | 'high'
           | 'medium'
}
```

### BlindSpotMap

```typescript
{
  tenant_id: string,
  computed_at: ISO 8601,           // When map was derived
  analysis_start: ISO 8601,        // Analysis window start
  analysis_end: ISO 8601,          // Analysis window end
  blind_spot_periods: BlindSpotPeriod[],
  total_blind_days: number,        // Sum of all durations
  coverage_percentage: number,     // % of time with evidence
  canonical_hash: SHA-256,         // Integrity verification
  schema_version: '1.0'
}
```

---

## UI COMPONENTS

### 1. Timeline View

Visual representation of blind spots over analysis window:

```
Coverage: 75%
├─────────────────────────────────────────────────┤
│🟩 Evidence │🟥 Blind │🟩 Evidence │🟨 Blind │🟩 Evidence│
├─────────────────────────────────────────────────┤
Jan 1                                           Jan 31
```

**Colors:**
- 🟩 Green = Evidence exists
- 🟥 Red = Critical blind spot
- 🟧 Orange = High severity blind spot
- 🟨 Yellow = Medium severity blind spot
- ⬜ Grey = Not installed (pre-install)

**Interactions:**
- Hover: Show tooltip with reason code and description
- Click: Scroll to table row with details

### 2. Table View

Detailed listing of all blind spots:

| Start Time | End Time | Duration | Reason | Severity | Description |
|-----------|----------|----------|--------|----------|------------|
| Jan 1, 12:00 | Jan 15, 10:00 | 13.92 | Not Installed | Critical | FirstTry not installed |
| Jan 20, 10:00 | Jan 25, 10:00 | 5.00 | Snapshot Failed | High | Execution failed: timeout |
| Jan 28, 15:00 | Jan 31, 23:59 | 3.42 | Unknown | High | No evidence after last snapshot |

**Features:**
- Sortable columns
- Filterable by reason/severity
- Tooltip on reason code
- Export to CSV

### 3. Summary Card

Statistics at top:

```
┌──────────────────────────────────────────────┐
│ Coverage: 75%  │  Blind Days: 22.34  │  Periods: 3  │
│ ● Critical: 1  │  ● High: 2  │  ● Medium: 0  │
│ Computed at: Dec 20, 2024 3:45 PM            │
└──────────────────────────────────────────────┘
```

### 4. Legend

Explanation of reason codes:

```
Reason Codes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟥 not_installed
   FirstTry not installed yet. No governance possible.

🟧 permission_missing
   Insufficient Jira permissions. Snapshots cannot run.

🟩 snapshot_failed
   FirstTry snapshot execution failed. No evidence captured.

🟨 unknown
   No evidence available. Reason not explicitly determined.
```

---

## INTEGRATION POINTS

### 1. Snapshot Job Integration

```typescript
// After computing snapshot reliability (Phase 9.5-C):
const blindSpots = deriveBlindSpots({
  tenant_id: ctx.tenant,
  first_install_date: tenantInstallDate,
  snapshot_runs: allSnapshots,  // From Phase 9.5-C
  analysis_window: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z'
  }
});

// Store and display
await db.storeBlindSpotMap(blindSpots);
```

### 2. Admin Dashboard Integration

```typescript
// Add to admin page routing:
const blindSpots = await db.getBlindSpotMap(tenantId);
return (
  <BlindSpotAdminPage blindSpotMap={blindSpots} />
);
```

### 3. Procurement Packet Integration

Include blind-spot summary in procurement data:
```typescript
{
  blind_spots: {
    coverage_percentage: 75,
    total_blind_days: 22.34,
    blind_spot_count: 3,
    critical_count: 1
  }
}
```

---

## DERIVATION ALGORITHM (PSEUDOCODE)

```
function deriveBlindSpots(input):
  blind_spots = []
  
  // 1. Pre-install period
  if input.first_install_date before input.analysis_window.start:
    blind_spots.append({
      reason: 'not_installed',
      period: [window.start, install_date],
      severity: 'critical'
    })
  
  // 2. Gaps in snapshot execution
  last_success = first_install_date or analysis.start
  for each snapshot_run in chronological_order:
    gap = snapshot_run.scheduled_at - last_success
    
    if gap > 12 hours:
      if snapshot_run.success:
        blind_spots.append({
          reason: 'unknown',
          period: [last_success, snapshot_run.scheduled_at],
          severity: gap > 7 days ? 'high' : 'medium'
        })
      else:
        reason = map_failure_reason(snapshot_run.failure_reason)
        blind_spots.append({
          reason: reason,
          period: [last_success, snapshot_run.scheduled_at],
          severity: gap > 7 days ? 'high' : 'medium'
        })
    
    if snapshot_run.success:
      last_success = snapshot_run.completed_at
  
  // 3. Post-analysis period
  if last_success before analysis.end:
    gap = analysis.end - last_success
    if gap > 12 hours:
      blind_spots.append({
        reason: 'unknown',
        period: [last_success, analysis.end],
        severity: gap > 7 days ? 'high' : 'medium'
      })
  
  // 4. No runs in window
  if blind_spots is empty and no snapshot_runs:
    blind_spots.append({
      reason: 'unknown',
      period: [analysis.start, analysis.end],
      severity: 'critical'
    })
  
  // 5. Merge adjacent periods (< 1 hour gap)
  blind_spots = merge_adjacent(blind_spots)
  
  // 6. Compute hash
  return BlindSpotMap with hash
```

---

## TEST COVERAGE

### Test Categories

1. **Pre-Install Blind Spots (TC-9.5-B-1)**
   - Blind spot created for pre-install period
   - No blind spot if install before window
   - Pre-install marked as `critical` severity

2. **Execution Failures (TC-9.5-B-2)**
   - Permission failure → `permission_missing` reason
   - Timeout/error → `snapshot_failed` reason
   - Gap between failure and next attempt detected

3. **No Fabrication (TC-9.5-B-3)**
   - No blind spots fabricated without evidence
   - Small gaps (< 12h) don't create blind spots
   - Complete coverage shows 100% (no blind spots)

4. **Reason Codes (TC-9.5-B-4)**
   - All 4 reason codes used correctly
   - No inference beyond stated reasons
   - Static descriptions only

5. **Timeline Integrity (TC-9.5-B-5)**
   - Blind spots in chronological order
   - No overlapping periods
   - Periods merge when adjacent (< 1h gap)
   - Hash verification detects changes

6. **Coverage Calculation (TC-9.5-B-6)**
   - Coverage formula: `(1 - blind_days / total_days) * 100`
   - Total blind days = sum of all durations
   - Coverage between 0-100%

---

## EXAMPLE: REAL-WORLD SCENARIO

### Scenario: Migration from Manual to Automated Governance

```
Timeline:
─────────────────────────────────────────────────

Jan 1: Organization tracking governance manually
       (no automation)

Jan 15: FirstTry installed
        ✓ Automated governance begins

Jan 20 10:00: First successful snapshot
              ✓ Evidence starts

Jan 25: Permission change (accidentally locked out)
        ✗ Snapshots fail with permission_denied

Jan 28: Permissions fixed
        ✓ Snapshots resume (successful)

Jan 31: End of analysis period

Analysis Result:
────────────────────────────────────────────────

Blind Spot 1: Jan 1-15 (not_installed, critical)
  Reason: FirstTry not yet installed
  Duration: 14 days

Blind Spot 2: Jan 15-20 (unknown, high)
  Reason: No evidence available
  Duration: 5 days

Blind Spot 3: Jan 25-28 (permission_missing, high)
  Reason: Insufficient permissions
  Duration: 3 days

Coverage: (31 - 22) / 31 = 29%
```

---

## DEPLOYMENT CHECKLIST

- [x] Derivation engine (blind_spot_map.ts)
- [x] Core logic implemented
- [ ] Tests fixed and passing
- [x] Admin UI (blind_spot_page.tsx)
- [ ] Specification complete
- [ ] Integration guides
- [ ] Database storage layer
- [ ] Scheduler integration

---

## RELATED PHASES

- **Phase 9.5-A:** Counterfactual Proof Ledger (what knowledge only exists because FirstTry exists)
- **Phase 9.5-B:** Historical Blind-Spot Map (when was evidence missing) ← **YOU ARE HERE**
- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry's snapshot capability reliable)
- **Phase 10:** Enterprise Monitoring (recursive monitoring of FirstTry)

---

## KEY PROPERTIES

✅ **Automatically Derived** - From snapshot history, no manual input  
✅ **No Inference** - Only factual reason codes, static descriptions  
✅ **Visually Exposed** - Admins cannot forget gaps exist  
✅ **Honest About Unknowns** - "unknown" reason used when cause not clear  
✅ **Timeline Integrity** - Chronological, non-overlapping, merged adjacent periods  
✅ **Configurable Window** - Any analysis period supported  
✅ **Immutable Record** - Canonical hash verification  

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial specification |


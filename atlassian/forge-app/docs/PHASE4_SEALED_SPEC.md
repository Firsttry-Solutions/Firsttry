# Phase 4: Change Awareness Timeline - SEALED SPECIFICATION

## Overview

Phase 4 implements a read-only, append-only timeline of detected changes in Jira settings. It is a purely **observational** system that:
- Detects changes in Jira configuration from Phase 2 metric deltas
- Records changes in an immutable, append-only timeline
- Displays the timeline in the gadget UI (read-only, no interactions)
- Runs on a **DAILY schedule ONLY** (not hourly, not manual)

## Sealed Specification Constraints

### 1. NO REST API Surface ✓
- Phase 4 has **no REST API endpoints**
- No web triggers, no HTTP routes
- No external API surface for invoking Phase 4 functions
- All Phase 4 operations are initiated by the DAILY scheduler only

### 2. NO Interactive UI Elements ✓
- Timeline displays as a **static chronological list** (most recent first)
- **NO buttons, filters, search, or user actions**
- **NO severity indicators, color-coding, or risk scoring**
- **NO statistics panels, metrics, or aggregates**
- **NO clickable elements** - pure read-only display

### 3. NO Jira API Calls ✓
- Phase 4 **never calls Jira directly**
- Change detection uses **Phase 2 stored metrics ONLY**
- Compares metric snapshots to detect deltas
- Never invokes `forge.asUser()`, `jira.requestWithAuth()`, or any Jira API

### 4. DAILY Schedule ONLY ✓
- Scheduler trigger: `interval: day`
- Runs once per 24 hours
- No hourly runs, no fiveMinute intervals
- **No manual trigger capability** - fully scheduled, no "Generate Now" button

### 5. Append-Only, Immutable Timeline ✓
- Timeline storage allows **append operations only**
- Events are never modified or deleted
- New events are prepended (most recent first)
- Total event count always increases or stays same, never decreases

### 6. Phase 2 Delta Detection ONLY ✓
- Tracks these Jira configuration metrics:
  - `customFieldCount`
  - `workflowCount`
  - `workflowSchemeCount`
  - `screenCount`
  - `permissionSchemeCount`
  - `maxWorkflowsPerScheme`
  - `maxProjectsPerPermissionScheme`
- Records changes when metric values differ from previous snapshot
- No interpretation, analysis, or scoring of changes

### 7. Fail-Closed Behavior ✓
- Scheduler errors are logged but not propagated
- Missing tenant identity causes graceful skip, not crash
- Storage errors cause timeline to be unavailable (isAvailable: false)
- App continues functioning if Phase 4 fails

## Data Structures

### Phase4ChangeEvent
```typescript
{
  id: string;                    // ISO timestamp + suffix
  detectedAt: string;            // ISO 8601 UTC
  changeType: 'JIRA_SETTING_CHANGED';
  settingKey: string;            // Metric name (customFieldCount, etc.)
  description: string;           // Human-readable description
  previousValue: string | number | boolean | null;
  currentValue: string | number | boolean | null;
  sourceMetric: string;          // "phase2:customFieldCount" etc
  recordedAt: string;            // ISO 8601 UTC
}
```

### Phase4Timeline
```typescript
{
  cloudId: string;               // Tenant ID
  events: Phase4ChangeEvent[];   // Most recent first
  lastUpdatedAt: string;         // ISO 8601 UTC
  totalEvents: number;           // Count of all events
}
```

### Phase4TimelinePayload (Returned to UI)
```typescript
{
  events: Phase4ChangeEvent[];   // Immutable copy
  totalEventCount: number;
  lastUpdatedAt: string;
  isAvailable: boolean;
  unavailableReason?: string;
}
```

## Scheduler Behavior

### DAILY Execution (`phase4_scheduler.runDaily`)
1. Fetch tenant identity from context
2. Load current Phase 2 metrics from storage
3. Detect changes by comparing to previous snapshot
4. Append any detected changes to timeline
5. Update metrics snapshot for next run
6. Record execution state (success/failure)
7. **Never propagates errors** - logs and continues

### Change Detection Algorithm
```
for each tracked metric:
  if currentValue != previousValue:
    create Phase4ChangeEvent
    append to timeline
save currentMetrics as previousSnapshot
```

## UI Display

### Timeline Section
- Location: Phase 4: Change Awareness Timeline (Read-Only, Append-Only)
- Position: After Phase 3 (Performance Signals), before Data Quality
- Display format: Chronological list, most recent first
- Max shown: 50 events (note indicates all retained in storage)
- Interaction: None (read-only)

### Timeline Event Display
- **Metric name** (bold)
- **Setting Key** (field name)
- **Previous value** → **Current value** (code blocks)
- **Detection timestamp** (right-aligned)
- NO color coding, NO severity icons, NO action buttons

### Truth Statement
```
"Timeline shows changes in Jira settings detected daily. 
Append-only, read-only record of configuration changes."
```

## Integration Points

### Manifest
```yaml
function:
  - key: phase4-scheduler-fn
    handler: scheduled/phase4_scheduler.runDaily

scheduledTrigger:
  - key: phase4-timeline-scheduler
    function: phase4-scheduler-fn
    interval: day
```

### Resolver
- Returns `phase4Timeline: Phase4TimelinePayload` in governance status
- Includes timeline in gadget payload
- Handles unavailable timeline gracefully (isAvailable: false)

### Gadget UI
- Renders phase4Timeline.events as static list
- Displays unavailable state with explanation
- No interactive elements

## Storage Keys

- Timeline: `phase4:timeline:{cloudId}`
- Scheduler state: `phase4:scheduler:{cloudId}`
- Phase 2 metrics snapshot: `phase2:metrics:{cloudId}`

## Constraints Summary

| Constraint | Status | Evidence |
|-----------|--------|----------|
| NO REST API | ✓ | No api.ts, no webTrigger in manifest |
| NO interactive UI | ✓ | Static read-only timeline, no buttons/filters |
| NO severity/stats | ✓ | No scoring, no aggregates in event data |
| NO Jira API calls | ✓ | Phase4_scheduler only reads Phase 2 storage |
| DAILY schedule ONLY | ✓ | Manifest interval: day |
| NO manual triggers | ✓ | No trigger endpoint, no UI button |
| Append-only storage | ✓ | appendChanges() only prepends, never deletes |
| Phase 2 deltas ONLY | ✓ | detectChanges() compares Phase 2 metrics |
| Fail-closed | ✓ | Scheduler catches errors, doesn't propagate |

## False Claims to Avoid

The following claims are FALSE and must not appear in documentation:

- ❌ "Phase 4 calls Jira API to detect changes"
- ❌ "Phase 4 can be manually triggered"
- ❌ "Phase 4 provides recommendations or suggestions"
- ❌ "Phase 4 has severity or risk scoring"
- ❌ "Phase 4 has filters or search capabilities"
- ❌ "Phase 4 runs hourly or on other intervals"
- ❌ "Phase 4 modifies Jira configuration"
- ❌ "Phase 4 enforces changes or recommendations"
- ❌ "Phase 4 exposes REST API endpoints"
- ❌ "Phase 4 has configurable detection rules"

## Testing

All sealed spec constraints are verified by tests in `timeline.test.ts`:
- NO REST API surface
- NO interactive UI elements
- NO Jira API calls
- DAILY schedule enforcement
- Append-only storage
- Phase 2 delta detection
- Fail-closed behavior
- Type isolation from other phases

## Compliance Checklist

- [x] Types defined in `src/phase4/types.ts`
- [x] Timeline logic in `src/phase4/timeline.ts`
- [x] Scheduler in `src/scheduled/phase4_scheduler.ts`
- [x] Evidence backfill in `src/phase4/phase4_evidence_backfill.ts` (safe, unchanged)
- [x] Manifest updated with DAILY scheduler
- [x] Gadget UI updated with timeline section
- [x] Resolver returns phase4Timeline
- [x] Tests verify sealed constraints
- [x] Documentation truthful and complete

## Version

- Sealed Specification Version: 1.0
- Implementation Version: 1.0
- Last Updated: 2026-01-04T00:00:00Z

# Enterprise Dashboard UI Specification

## Overview

The FirstTry Audit Evidence Dashboard is a read-only, dumb-reader Jira gadget that displays Jira governance audit snapshots. This document locks the contract for the UI layout, rendering rules, and data display.

## Product Name & Branding

**Title**: "FirstTry — Audit Evidence for Jira"
**Subtitle**: "Read-only governance snapshot viewer"

## Layout Structure

### 1. Header (Always Visible)

- **Left**: Product name and icon
- **Center**: Status badge (if relevant)
- **Right**: 
  - "Last updated: HH:MM UTC" (refresh time, not snapshot time)
  - Refresh button (no manual action allowed; read-only dashboard)

### 2. Primary Status Panel (Card-Based)

**When Status = AVAILABLE:**
```
┌─ ✓ Governance Snapshot Available ─────────────────┐
│                                                    │
│  Snapshot ID:    snap_abc123def456789             │
│  Created:        2026-01-24T14:32:01.123Z         │
│                                                    │
│  (Dashboard contains valid audit evidence)        │
└────────────────────────────────────────────────────┘
```

**When Status = NO_SNAPSHOT or INVALID_SNAPSHOT:**
```
┌─ ⊘ No Snapshot Available ─────────────────────────┐
│                                                    │
│  No snapshot has been created yet.                │
│                                                    │
│  Reason: NO_SNAPSHOT_POINTER                      │
└────────────────────────────────────────────────────┘
```

**When Status = HARD_ERROR:**
```
┌─ ✗ Snapshot Unavailable ──────────────────────────┐
│                                                    │
│  Error: BACKEND_STORAGE_CORRUPTED                 │
│  Unable to load governance snapshot               │
└────────────────────────────────────────────────────┘
```

### 3. Actions Row (Conditional)

**Enabled only when Status = AVAILABLE:**
- "Export as JSON" button (enabled if metadata.export.readiness = "AVAILABLE")
- "Export as PDF" (disabled stub, tooltip: "Format support coming soon")
- Future export formats rendered **disabled** with explanatory tooltips

### 4. Metadata Section (Collapsible)

**Header**: "Snapshot Metadata" (only if data present)

**Fields** (from `state.metadata`):
- Coverage: declaration + observation window note
- Integrity: checksum/signature proof
- Provenance: captured by + trigger reason
- Export: readiness status + available formats
- Compliance: scope + assertions

Each field rendered as a tidy key/value block with borders.

### 5. Disclaimers Section (Collapsible)

**Header**: "About This Dashboard"

**Content** (read from `metadata.disclaimer`):
- This dashboard does NOT modify Jira data
- This dashboard does NOT guarantee compliance
- This dashboard does NOT auto-fix issues
- This dashboard does NOT provide recommendations

**Visual**: Light yellow background (#fff3cd), left border accent

### 6. Footer

- **Left**: Build identity marker (if debug mode enabled)
- **Right**: "Non-real-time | Read-only | Not a compliance guarantee"
- Font size: 11px, color: #999

## Invariant Rules

### Rendering Rules

1. **Snapshot ID and Created fields ONLY appear when Status = AVAILABLE**
   - If Status ≠ AVAILABLE: fields are hidden, not displayed as "N/A"

2. **Status badge color codes**:
   - AVAILABLE: Blue (#0052cc)
   - NO_SNAPSHOT/INVALID: Gray (#626f86)
   - HARD_ERROR: Red (#d32f2f)

3. **Export button enabled ONLY if**:
   - Status = "AVAILABLE" AND
   - metadata.export.readiness = "AVAILABLE"

4. **Metadata section hidden if** state.metadata is null/undefined

5. **If invariant blocks AVAILABLE→NO_SNAPSHOT downgrade**:
   - Reason field will be "INVARIANT_BLOCKED_DOWNGRADE_AVAILABLE_TO_NO_SNAPSHOT"
   - UI MAY render a subtle warning line: "Data inconsistency detected; retaining last known snapshot."

## Data Sources

All data comes from resolver response `L0DashboardState`:
```typescript
{
  status: "AVAILABLE" | "NO_SNAPSHOT" | "INVALID_SNAPSHOT" | "HARD_ERROR";
  reasonCode: string;
  snapshotId: string | null;
  createdAtUtc: string | null;
  schemaVersion: string;
  error: string | null;
  note: string;
  metadata?: {
    coverage?: {...};
    integrity?: {...};
    provenance?: {...};
    export?: {...};
    compliance?: {...};
    disclaimer?: {...};
  };
}
```

**NO NEW DATA SOURCES ALLOWED**. No fetching additional data, no mutations, no side effects.

## Rendering Constraints

- **Deterministic**: Same state → same rendered HTML every time
- **No async**: No loading states, no spinners, no animations
- **No mutations**: Read-only gadget; no Jira API calls from UI
- **Accessibility**: Semantic HTML, proper heading hierarchy, color + text contrast
- **Responsive**: Works on mobile (1:1 scale) and desktop (2:1 scale)

## Testing

Each UI state transition must be covered by regression tests:

1. AVAILABLE rendering (snapshot ID + created visible)
2. NO_SNAPSHOT rendering (no data message)
3. INVALID_SNAPSHOT rendering
4. HARD_ERROR rendering
5. Metadata blocks rendering when present
6. Export button enabled/disabled based on state
7. Invariant-blocked downgrade warning (if applicable)

## Changelog

- **v1.0**: Initial enterprise dashboard spec (2026-01-29)
  - Status panel with invariant guard
  - Collapsible metadata sections
  - Read-only constraint enforcement
  - NO STG badge in production

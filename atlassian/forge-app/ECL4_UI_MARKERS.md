# ECL-4 Review Seal — UI Integration Markers

This document identifies where UI updates should be made to support review sealing functionality.

## Overview

ECL-4 adds deterministic review sealing via `sealReview()` function. Once sealed, reviews become immutable.

**Core Implementation:** `src/governance/reviewSeal.ts` (165 lines, fully self-contained)

## UI Components To Update

### 1. Review Detail Display (Access Reviews Tab)

**File:** `src/gadget-ui/src/main.ts` or review panel component

**Location:** Where review status is rendered

**Changes Required:**

```typescript
// FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_STATUS_DISPLAY
// Display seal status when review.sealed === true:
//   - Show: "🔒 Sealed by [role] on [timestamp]"
//   - Show: "Seal Hash: [sealHash truncated]"
//   - Disabled state: All action buttons disabled
//   - Read-only indicator: "This review is immutable"
```

### 2. Action Button Panel

**File:** `src/gadget-ui/src/main.ts` or review actions component

**Location:** Where "Record Decision" and "Add Exception" buttons appear

**Changes Required:**

```typescript
// FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_BUTTON_DISABLE
// Disable all mutation buttons if review.sealed === true:
//   - "Record Decision" button → disabled, tooltip: "Review is sealed (immutable)"
//   - "Add Exception" button → disabled, tooltip: "Review is sealed (immutable)"
//   - Any other mutation buttons → disabled
```

### 3. Seal Review Button

**File:** `src/gadget-ui/src/main.ts` or review actions component

**Location:** Near other action buttons (but only shown when NOT sealed)

**Changes Required:**

```typescript
// FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_BUTTON_ADD
// Show "Seal Review" button:
//   - Only when: review.sealed === false (or undefined)
//   - Only when: actorRole has CLOSE_REVIEW permission
//   - On click: Call resolver 'ar.sealReview' with {siteId, reviewId, actorRole}
//   - Show loading state: "Sealing..."
//   - On success: Refresh review state, show seal status
//   - On error: Show "FAIL_CLOSED: [error]"
```

### 4. Review List Item Display

**File:** `src/gadget-ui/src/main.ts` or review list component

**Location:** Where reviews are listed in table/grid

**Changes Required:**

```typescript
// FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_LIST_STATUS
// In review list rows, add seal indicator:
//   - If sealed: Show "🔒" badge next to status
//   - Tooltip: "Sealed by [role]"
//   - Style: Gray out row or add border to indicate immutability
```

## Resolver Integration

**JavaScript Invocation Pattern:**

```typescript
// FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_INVOKE
const result = await invokeWithUiReqId('ar.sealReview', {
  siteId: currentSiteId,
  reviewId: currentReviewId,
  actorRole: userRole,  // e.g., "Approver", "Owner"
});

if (result.ok) {
  const sealData = {
    sealedTimestampUtc: result.sealedTimestampUtc,
    sealHash: result.sealHash,
  };
  console.log('[SEAL_SUCCESS]', sealData);
  // Refresh review state
} else {
  console.error('[SEAL_ERROR]', result.error);
  // Show error toast
}
```

## API Contract

**Input Schema:**
- `siteId`: string (required)
- `reviewId`: string (required)
- `actorRole`: string (required, one of: Viewer, Operator, Approver, Auditor, Owner)

**Output Schema (Success):**
- `success`: boolean (true)
- `sealedTimestampUtc`: string (ISO 8601)
- `sealHash`: string (SHA-256 hex)

**Output Schema (Error):**
- `success`: boolean (false)
- `error`: string (error message, starts with "FAIL_CLOSED:" for validation errors)
- `code`: string (error code)

## Security & Design Notes

1. **Fail-Closed:** All validation happens on backend. UI must not make false claims about "secure" or "encrypted."
2. **Immutability Enforcement:** Backend refuses ANY mutation (recordDecision, addException) on sealed reviews.
3. **No Rollback:** Sealing is atomic and irreversible. UI must prompt for confirmation.
4. **Deterministic Hash:** sealHash is reproducible. Don't treat as "signature."
5. **Read-Only Post-Seal:** UI should visually enforce immutability (disabled buttons, grayed out).

## Implementation Priority

1. Status display (shows if sealed)
2. Button disable (prevents accidental clicks)
3. Seal button (allows sealing when authorized)
4. Confirmation prompt (warns before sealing)

## Testing

- [x] Backend: sealReview() function with fail-closed validation
- [x] Backend: immutability guards in recordDecision() and addException()
- [x] Backend: resolver ar.sealReview registered
- [ ] UI: Status display renders correctly
- [ ] UI: Buttons disabled post-seal
- [ ] UI: Seal button works with resolver
- [ ] E2E: Full seal workflow (open review → record decision → seal → verify immutable)

## Build Status

- [x] Code compiles (npm run build)
- [x] No new dependencies
- [x] No outbound networking
- [x] All 15/15 gates passing
- [ ] UI integration tests passing

## Related Files

- Backend sealing logic: `src/governance/reviewSeal.ts`
- RBAC permissions: `src/governance/rbac.ts` (EclAction.CLOSE_REVIEW)
- Review workflow: `src/access-review/phase3Workflow.ts` (immutability guards added)
- Review resolvers: `src/access-review/phase3Resolvers.ts` (ar.sealReview resolver added)
- Review types: `src/access-review/types.ts` (sealed, sealedTimestampUtc, sealedByRole, sealHash fields)

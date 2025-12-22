# PHASE P2: OUTPUT TRUTH GUARANTEE

**Status:** COMPLETE  
**Version:** 1.0  
**Last Updated:** 2025-01-01

---

## Executive Summary

Phase P2 ensures that no output can be misunderstood, reused beyond validity, or exported without explicit truth signals and operator acknowledgment.

**Core Principle:** All outputs are truth-labeled with explicit validity status, completeness disclosures, confidence levels, and drift awareness. Export is blocked unless the operator understands and acknowledges any data quality issues.

---

## Definitions

### Output Validity Status

Every exported output has one of these states:

| Status | Meaning | Operator Action | Export Allowed? |
|--------|---------|-----------------|-----------------|
| **VALID** | Complete + fresh + no drift | No action needed | ✅ Yes, no ack required |
| **DEGRADED** | Incomplete data OR stale | Must acknowledge degradation | ✅ Yes, with explicit ack |
| **EXPIRED** | Drift detected after generation OR too old (>7 days) | Must acknowledge expiry | ✅ Yes, with explicit ack |
| **BLOCKED** | Cannot compute truth OR missing snapshot | None available | ❌ No, impossible |

### Confidence Level

How confident are we in the output quality?

| Level | Criteria |
|-------|----------|
| **HIGH** | Complete (100%) + fresh (<7 days old) + no drift detected |
| **MEDIUM** | Complete but stale, OR drift status unknown, OR minor missing data |
| **LOW** | Incomplete (<100%) OR drift detected OR validation failed |

### Completeness

- **Complete (100%):** All expected data fields are present
- **Incomplete (<100%):** One or more expected data fields are missing
  - `completenessPercent`: integer 0-100
  - `missingData`: array of field identifiers missing from the output

### Drift Status

Has governance changed since the snapshot was created?

| Status | Meaning |
|--------|---------|
| **NO_DRIFT** | Snapshot is still representative of current governance state |
| **DRIFT_DETECTED** | Policy/configuration changes detected after snapshot generation |
| **UNKNOWN** | Drift status could not be verified (reduces confidence to MEDIUM) |

---

## Validity Rules (Deterministic)

These rules are applied in order. Once a rule triggers, validity is determined:

```
1. IF snapshot age > MAX_SNAPSHOT_AGE_SECONDS (604,800 = 7 days)
   → EXPIRED (confidence: LOW)

2. ELSE IF drift detected after generation
   → EXPIRED (confidence: LOW)

3. ELSE IF completeness < 100%
   → DEGRADED (confidence: LOW)

4. ELSE IF drift status is UNKNOWN
   → DEGRADED (confidence: MEDIUM at most, never HIGH)

5. ELSE (drift is NO_DRIFT AND completeness 100%)
   → VALID (confidence: HIGH)
```

**Critical Absolute Invariants:**

🚫 **UNKNOWN drift is NEVER VALID** — even with 100% completeness.  
- `driftStatus === 'UNKNOWN'` ⟹ `validityStatus` must be `'DEGRADED'`
- `driftStatus === 'UNKNOWN'` ⟹ `confidenceLevel` is at most `'MEDIUM'`

🚫 **Non-VALID status MUST have non-empty warnings and reasons**  
- `validityStatus !== 'VALID'` ⟹ `warnings.length > 0`
- `validityStatus !== 'VALID'` ⟹ `reasons.length > 0`

🚫 **Completeness cannot upgrade drift status**  
- High completeness (100%) does NOT change `validityStatus` if drift rules apply
- Completeness only affects validity within the constraints of drift status

🚫 **VALID status MUST have empty warnings and reasons**  
- `validityStatus === 'VALID'` ⟹ `warnings.length === 0`
- `validityStatus === 'VALID'` ⟹ `reasons.length === 0`

**Inference:**
- If `validityStatus != VALID`, then `warnings` and `reasons` are non-empty
- If `validityStatus == VALID`, then `warnings` and `reasons` are empty
- Confidence can never be HIGH if drift is UNKNOWN
- Confidence can never be HIGH if completeness < 100%

---

## Output Truth Metadata (Immutable Contract)

Every exported output includes this metadata:

```typescript
{
  // Schema identity (for backward compatibility)
  "schemaVersion": "1.0",

  // Temporal context
  "generatedAtISO": "2025-01-01T12:34:56Z",    // When output was created
  "snapshotId": "snap_abc123...",              // Which snapshot was used
  "snapshotCreatedAtISO": "2025-01-01T10:00:00Z", // When snapshot was taken
  "snapshotAgeSeconds": 9000,                   // 2.5 hours old

  // Versioning
  "rulesetVersion": "1.0",   // Drift detection rules version

  // Drift assessment
  "driftStatus": "NO_DRIFT" | "DRIFT_DETECTED" | "UNKNOWN",

  // Completeness (from Phase P1.3)
  "completenessPercent": 100,
  "missingData": ["field1", "field2"],          // Empty if complete
  "completenessStatus": "COMPLETE" | "INCOMPLETE",

  // Confidence in output quality
  "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",

  // Validity verdict
  "validityStatus": "VALID" | "DEGRADED" | "EXPIRED" | "BLOCKED",
  "validUntilISO": "2025-01-08T12:34:56Z",     // Expiry timestamp

  // User-facing disclosure (REQUIRED if not VALID)
  "warnings": [
    "⚠️ DEGRADED: Missing 2 data fields (95% complete)",
    "⚠️ Snapshot created 3 days ago"
  ],
  "reasons": [
    "Data is only 95% complete (missing: field1, field2)",
    "Snapshot age exceeds recommended freshness threshold"
  ]
}
```

---

## Export Blocking Rules

Before export, the system computes `OutputTruthMetadata`. Then:

### Export Permitted (No Acknowledgment Needed)
```
IF validityStatus == VALID
  → Export allowed immediately
  → No acknowledgment recorded
  → No watermark applied
```

### Export Requires Acknowledgment
```
IF validityStatus == DEGRADED OR validityStatus == EXPIRED
  AND acknowledgeByOperator == true
  → Export allowed
  → Audit event recorded: ACKNOWLEDGED_DEGRADED_OUTPUT
  → Watermark applied to exported content
  → Output record updated with ack timestamp
```

### Export Blocked
```
IF validityStatus == DEGRADED OR validityStatus == EXPIRED
  AND acknowledgeByOperator != true
  → Export blocked with HTTP 403 Forbidden
  → Response includes:
    - validityStatus
    - reasons (why not valid)
    - warnings (what's wrong)
    - Required query param: acknowledge_degradation=true
```

```
IF validityStatus == BLOCKED
  → Export impossible, always blocked
  → Cannot be overridden by acknowledgment
```

---

## Watermarking (Non-VALID Exports)

When an output is not VALID, all exported artifacts include an explicit watermark:

### JSON Export Watermark
```json
{
  "watermark": {
    "status": "DEGRADED",
    "message": "⚠️ DEGRADED: Data is 95% complete (missing: field1, field2)",
    "warnings": [...],
    "reasons": [...]
  },
  "truth_metadata": { ... },
  ...snapshot data...
}
```

### PDF/Text Export Watermark
```
⚠️ IMPORTANT: OUTPUT QUALITY WARNING
Status: DEGRADED

Reasons:
- Data is only 95% complete (missing: field1, field2)
- Snapshot created 3 days ago

Warnings:
- ⚠️ DEGRADED: Missing 2 data fields (95% complete)
- ⚠️ Snapshot created 3 days ago

⚠️ This export was made with explicit operator acknowledgment of data quality issues.
```

---

## Operator Acknowledgment Contract

When operator exports a DEGRADED or EXPIRED output:

1. **Export Request:** `POST /export?id=snap123&format=json&acknowledge_degradation=true`

2. **System Response:**
   - Computes `OutputTruthMetadata`
   - Validates operator acknowledgment
   - Records `ACKNOWLEDGED_DEGRADED_OUTPUT` audit event
   - Includes audit metadata (no PII, tenant-scoped)

3. **Audit Event:**
   ```
   {
     "eventType": "ACKNOWLEDGED_DEGRADED_OUTPUT",
     "snapshotId": "snap_abc123...",
     "outputId": "export_snap_abc123_json_1234567890",
     "validityStatus": "DEGRADED",
     "reason": "Export of DEGRADED output. Data is 95% complete.",
     "occurredAtISO": "2025-01-01T12:35:00Z",
     "tenantId": "tenant_xyz"
   }
   ```

4. **Immutable Record:**
   - Output record stored with export timestamp
   - `operatorAcknowledgedDegradation: true`
   - Linked to audit events for compliance
   - Expires when snapshot expires (from retention policy)

---

## Persisted Output Records

All outputs are recorded for verification and troubleshooting:

```typescript
{
  // Identity
  "outputId": "output_snap_abc123_json_1234567890",
  "tenantId": "tenant_xyz",
  "cloudId": "cloud_id_123",
  "outputVersion": 1,  // Monotonic per (snapshotId, outputType)

  // What was generated
  "snapshotId": "snap_abc123...",
  "outputType": "json" | "pdf" | "export",
  "outputGeneratedAtISO": "2025-01-01T12:34:56Z",

  // Truth metadata (immutable copy)
  "truthMetadata": { ... },

  // Export status
  "wasExported": true,
  "exportedAtISO": "2025-01-01T12:35:00Z",
  "operatorAcknowledgedDegradation": false,

  // Retention
  "createdAtISO": "2025-01-01T12:34:56Z",
  "expiresAtISO": "2025-02-01T12:34:56Z"  // From retention policy
}
```

---

## Audit Events (Tenant-Scoped, PII-Free)

All output operations are recorded:

| Event Type | Recorded When |
|------------|---------------|
| `OUTPUT_GENERATED` | Snapshot export process begins |
| `OUTPUT_EXPORTED` | Export completes (with operator action) |
| `ACKNOWLEDGED_DEGRADED_OUTPUT` | Operator confirms degradation acknowledgment |
| `OUTPUT_EXPIRED_VIEWED` | User views output that has since expired |

**Event Structure:**
```typescript
{
  "eventId": "evt_1234567890_abc123",
  "eventType": "OUTPUT_EXPORTED",
  "tenantId": "tenant_xyz",
  "snapshotId": "snap_abc123...",
  "outputId": "output_snap_abc123_json_1234567890",
  "validityStatus": "VALID",
  "operatorAction": "confirmed",
  "occurredAtISO": "2025-01-01T12:35:00Z",
  "expiresAtISO": "2025-02-01T12:35:00Z"
}
```

**Properties:**
- No operator ID stored (Phase P1 PII safety)
- Tenant-scoped (cannot cross-tenant)
- Retention-scoped (deleted per policy)
- Deterministic (no randomness in timestamps)

---

## Drift Status Tracking

Drift is tracked per-snapshot:

1. **Recording Drift:**
   ```
   recordDriftEvent(snapshotId, description, nowISO, expiresAtISO)
   ```
   - Event stored with snapshot ID
   - Expires per retention policy
   - Immutable once recorded

2. **Checking Drift:**
   ```
   driftStatus = getDriftStatus(snapshotId, nowISO)
   // Returns: NO_DRIFT, DRIFT_DETECTED, or UNKNOWN
   ```
   - Queries drift events for snapshot
   - Returns DRIFT_DETECTED if any active events exist
   - Returns NO_DRIFT if no active events

3. **Integration with Phase P1.7 Drift Detection:**
   - If Phase P1.7 governance drift detection exists, drift events can be recorded
   - If not, this system tracks minimal drift state
   - Deterministic: same inputs always produce same drift status

---

## Versioning & Backward Compatibility

### Schema Versioning

- `schemaVersion` in `OutputTruthMetadata` = "1.0"
- Increment on breaking changes to metadata structure
- Old outputs remain interpretable (deserialization checks version)

### Ruleset Versioning

- `rulesetVersion` in metadata = current drift detection rules version
- If rules change, new outputs use new version
- Old outputs evaluated with original rules (reproducibility)

### Migration Guarantee

For any saved output record + snapshot pair:
1. Recompute `OutputTruthMetadata` deterministically
2. Result must match original metadata exactly
   - Same `validityStatus`
   - Same `completenessStatus`
   - Same `warnings` and `reasons`
   - Same `driftStatus`

This prevents future regressions in truth computation.

---

## Completeness Computation (From Phase P1.3)

Completeness is sourced from snapshot's `missing_data` array:

```typescript
missingDataList = snapshot.missing_data || []
completenessPercent = missingDataList.length === 0 ? 100 : max(0, 100 - (count * 10))
missingData = missingDataList.map(item => item.dataset_name)
completenessStatus = completenessPercent === 100 ? "COMPLETE" : "INCOMPLETE"
```

**Rules:**
- 100% = COMPLETE
- < 100% = INCOMPLETE
- Each missing dataset reduces completeness (10% per missing field, example)

---

## Security & Isolation

### Tenant Isolation
- All records keyed by `tenantId`
- Cross-tenant queries impossible at storage layer
- Audit events contain `tenantId` for compliance

### No PII in Audit Events
- No operator IDs, email addresses, or names
- Operator action recorded as: "confirmed", "cancelled", "blocked"
- Reason is abstract: "data quality issue", not "user X exported incomplete data"
- Reuses Phase P1 logging safety patterns

### Immutability
- Output records created once, updated for export status only
- Audit events append-only
- Truth metadata never recomputed after creation
- Drift events immutable

---

## Testing & Verification

### Determinism Tests
- Given same inputs, `computeOutputTruthMetadata` produces identical output
- Snapshot age computation is deterministic
- Drift status is deterministic

### Completeness Verification
- Recompute metadata for saved output + snapshot
- Assert: matches original metadata exactly
- Prevents regression in truth computation

### Validity Rule Tests
- Test each validity rule in isolation
- Test rule ordering (age > drift > completeness)
- Test confidence level computation

### Export Blocking Tests
- VALID: export always succeeds
- DEGRADED: export fails without ack, succeeds with ack
- EXPIRED: export fails without ack, succeeds with ack
- BLOCKED: export always fails

### Watermarking Tests
- VALID outputs: no watermark
- DEGRADED/EXPIRED outputs: watermark present in JSON and PDF
- Watermark includes validity status, reasons, warnings

### Audit Trail Tests
- ACKNOWLEDGED_DEGRADED_OUTPUT event recorded on ack
- OUTPUT_EXPORTED event recorded with operator action
- Events are tenant-scoped and contain no PII

---

## Constants & Configuration

```typescript
// Maximum age of snapshot before marking EXPIRED (7 days)
export const MAX_SNAPSHOT_AGE_SECONDS = 604800;

// Output truth metadata schema version
export const OUTPUT_TRUTH_SCHEMA_VERSION = '1.0';
```

---

## Failure Modes & Recovery

| Scenario | Behavior |
|----------|----------|
| Snapshot not found | `validityStatus = BLOCKED`, export impossible |
| Drift status unknown | Confidence downgraded to MEDIUM, validity still computable |
| Missing completeness data | Defaults to 100% complete (conservative) |
| Audit event write fails | Error propagated; export aborted, not retried silently |
| TTL calculation error | Error thrown; export fails rather than create invalid record |

---

## Operator Guidance

### Exporting a VALID Output
```
No action needed. Click export. Output is safe to share.
```

### Exporting a DEGRADED Output
```
1. System shows warning:
   "⚠️ DEGRADED: Data is 95% complete (missing: field1)"

2. Operator reads reasons for degradation

3. If acceptable, add query param:
   ?acknowledge_degradation=true

4. System records acknowledgment in audit trail

5. Export proceeds with watermark applied
```

### Exporting an EXPIRED Output
```
Same as DEGRADED above. Watermark indicates:
"⚠️ EXPIRED: Snapshot created 8 days ago"
```

### Exporting a BLOCKED Output
```
Export is impossible. Operator must:
1. Create a fresh snapshot
2. Verify completeness
3. Export the new snapshot instead
```

---

## Compliance & Governance

**This phase implements:**

✅ **Marketplace Requirement:** Non-VALID outputs require explicit operator disclosure  
✅ **Data Privacy:** Completeness tracked, missing data disclosed  
✅ **Audit Trail:** All exports recorded, no silent operations  
✅ **Determinism:** Same inputs always same output validity  
✅ **Immutability:** Records never modified after creation  
✅ **Tenant Isolation:** No cross-tenant data leakage  
✅ **Retention:** Records deleted per Phase P1.2 policy  

---

## References

- Phase P1.1: Logging Safety (PII redaction)
- Phase P1.2: Data Retention (TTL enforcement)
- Phase P1.3: Export Truth (completeness, confidence)
- Phase P1.4: Tenant Isolation (storage scoping)
- Phase P1.5: Policy Drift Gates (CI/CD protection)
- Phase P2: Output Truth Guarantee (this document)

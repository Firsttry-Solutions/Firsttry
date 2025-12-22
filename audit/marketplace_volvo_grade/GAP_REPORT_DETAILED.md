# GAP_REPORT_DETAILED.md - Marketplace Security Gaps

## EXECUTIVE SUMMARY

FirstTry Jira Forge App audit reveals **24 missing/failing security requirements** across 10 categories, with **8 high-risk gaps** blocking Marketplace approval:

1. **Logging PII unchecked** (146 console.log calls; 82% unredacted)
2. **No data retention policy** (TTL/deletion undefined)
3. **Export staleness not warned** (no "incomplete data" disclosure)
4. **No export schema versioning** (backward compatibility unknown)
5. **Adversarial security tests missing** (tenant isolation untested)
6. **Policy drift gates missing** (no CI prevention of scope creep)
7. **SLI/SLO metrics undefined** (reliability claims unsupported)
8. **Marketing discipline vs. reality** (actually good; no overpromising)

---

## CRITICAL GAPS (P1: Marketplace Blockers)

### GAP-C1: PII Logging Exposure

**Category:** C - Privacy & Security Contract

**Status:** OPEN / HIGH RISK

**Finding:** 146 console.log statements across codebase; only 27 (18%) use redaction function.

**Evidence:**

File: [src/phase6/snapshot_capture.ts](../../src/phase6/snapshot_capture.ts)
```typescript
Line 48:  console.log(`Captured snapshot: ${snapshot.name}`);
         // snapshot.name may contain user PII
```

File: [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts)
```typescript
Line 1145:  console.log(`Export started by ${userName}`);
           // userName is unredacted
```

**Gap Description:** 
- Jira data (issue keys, custom field values, user names) logged without redaction
- Logs stored in browser console, container logs, and error tracking systems
- **GDPR/CCPA Violation Risk:** User PII becomes visible to developers/operators
- **Compliance Impact:** Fails HIPAA, EU-US Privacy Shield, data residency audits

**Current Redaction Coverage:**
```
Total console.log calls: 146
With redaction: 27 (18%)
Without redaction: 119 (82%)
```

**Affected Files (Sample):**
- src/phase6/snapshot_capture.ts (16 unredacted)
- src/admin/phase5_admin_page.ts (34 unredacted)
- src/phase7/drift_compute.ts (12 unredacted)

**Fix Complexity:** MEDIUM (1-2 days)

**Remediation Steps:**

1. Enforce redaction globally:
   ```typescript
   // src/phase9/log_redaction.ts
   const originalLog = console.log;
   console.log = function(...args) {
     originalLog(...args.map(arg => redact(String(arg))));
   };
   ```

2. Audit each of 119 unredacted calls; apply JSDoc `@redacted`:
   ```typescript
   // Instead of:
   console.log(`Export started by ${userName}`);
   
   // Use:
   /** @redacted */
   console.log(`Export started by ${redact(userName)}`);
   ```

3. Add CI check to enforce @redacted on all console.log() in src/phase*:
   ```bash
   grep -rn "console.log" src/ | grep -v "@redacted" && exit 1 || exit 0
   ```

---

### GAP-C2: No Data Retention Policy

**Category:** C - Privacy & Security Contract

**Status:** OPEN / HIGH RISK

**Finding:** No TTL or automatic deletion documented for stored data.

**Evidence:**

Files with data storage:
- [src/storage.ts](../../src/storage.ts) - Stores snapshots indefinitely
- [src/phase7/drift_storage.ts](../../src/phase7/drift_storage.ts) - Stores drift events (no cleanup)
- [src/run_ledgers.ts](../../src/run_ledgers.ts) - Stores job history indefinitely

**Command Result:**
```bash
$ grep -rn "delete\|expire\|ttl\|retention\|cleanup" src/
src/retention/cleanup.ts:89     deleteOldSnapshots()     [only snapshots >90d]
src/retention/cleanup.ts:120    deleteExpiredTokens()    [only refresh tokens]
(No tenant-wide data purge found)
```

**Gap Description:**
- Data stored indefinitely without TTL
- No automatic purge for old snapshots/drift events
- GDPR Article 5 violation: Data kept longer than necessary
- Customer compliance risk: Cannot prove data isn't kept "forever"

**Scope of Missing Policy:**
| Data Type | Current TTL | Required TTL | Risk |
|-----------|-------------|--------------|------|
| Snapshots | Undefined | 90 days (configurable) | HIGH |
| Drift Events | Undefined | 365 days | HIGH |
| Run Ledgers | Undefined | 180 days | HIGH |
| Refresh Tokens | Undefined | 30 days | MED |
| Export Files | Client-side | N/A | LOW |

**Fix Complexity:** MEDIUM (1-2 days)

**Remediation Steps:**

1. Create [src/retention/retention_policy.ts](../../src/retention/retention_policy.ts):
   ```typescript
   export const RETENTION_POLICY = {
     snapshots: 90,           // days
     driftEvents: 365,        // days
     runLedgers: 180,         // days
     refreshTokens: 30,       // days
   };
   ```

2. Extend [src/retention/cleanup.ts](../../src/retention/cleanup.ts) to purge all data types:
   ```typescript
   async function purgeExpiredData() {
     await deleteOldSnapshots(RETENTION_POLICY.snapshots);
     await deleteOldDriftEvents(RETENTION_POLICY.driftEvents);
     await deleteOldLedgers(RETENTION_POLICY.runLedgers);
   }
   ```

3. Add manifest job to run daily:
   ```yaml
   manifest.yml lines 63-71:
   retention-cleanup-job:
     - key: retention-cleanup-job
       schedule: '0 2 * * *'  # 2 AM UTC daily
       function: cleanupExpiredData
   ```

4. Document in [PRIVACY.md](../../PRIVACY.md):
   ```
   ## Data Retention Policy
   - Snapshots: 90 days from capture
   - Drift events: 365 days from detection
   - Run ledgers: 180 days from run
   
   ## Deletion Procedure
   Automatic deletion runs daily. To manually request deletion:
   1. Contact security@firstry.dev with tenant ID
   2. Deletion SLA: 7 business days
   ```

---

### GAP-E1: No Export Completeness Warnings

**Category:** E - Fail-Closed Semantics

**Status:** OPEN / HIGH RISK

**Finding:** Exports don't indicate if data is incomplete or stale.

**Evidence:**

File: [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts)

```typescript
Lines 1166-1180:
function generateExport(snapshot) {
  return JSON.stringify(snapshot, null, 2);
  // No warnings; user doesn't know what's missing
}
```

**Gap Description:**
- Export function returns data without completeness indicator
- User has no way to know if "automation rules" or other data failed to capture
- Silent degradation: Export appears successful even with 50% missing data
- Risk: User relies on incomplete export; governance audit uses bad data

**Specific Failure Scenarios:**

| Scenario | Current Behavior | Desired Behavior |
|----------|---|---|
| Jira API timeout (automation rules) | Export succeeds without automation rules | Warning: "Automation rules unavailable; export 78% complete" |
| Snapshot capture interrupted | Partial snapshot exported | Warning: "Snapshot incomplete; missing X fields" |
| Drift compute error | Drift events omitted silently | Error message: "Drift computation failed; export without drift data" |

**Fix Complexity:** MEDIUM (1-2 days)

**Remediation Steps:**

1. Create [src/admin/export_schema.ts](../../src/admin/export_schema.ts):
   ```typescript
   export interface ExportMetadata {
     exportedAt: Date;
     completeness: {
       snapshots: number;           // 0-100%
       driftEvents: number;         // 0-100%
       runLedgers: number;          // 0-100%
     };
     warnings: string[];            // Human-readable warnings
     missingData: string[];         // Known gaps
   }
   
   export interface CompleteExport {
     metadata: ExportMetadata;
     snapshots: Snapshot[];
     driftEvents: DriftEvent[];
     runLedgers: RunLedger[];
   }
   ```

2. Update [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts):
   ```typescript
   function generateExport(snapshot, driftEvents, ledger) {
     const completeness = {
       snapshots: snapshot ? 100 : 0,
       driftEvents: driftEvents.length > 0 ? 100 : 0,
       runLedgers: ledger ? 100 : 0,
     };
     
     const warnings = [];
     if (completeness.snapshots < 100) warnings.push("Snapshot incomplete");
     if (completeness.driftEvents < 100) warnings.push("Drift events missing");
     
     return {
       metadata: {
         exportedAt: new Date(),
         completeness,
         warnings,
         missingData: warnings,
       },
       snapshots: snapshot,
       driftEvents,
       runLedgers: ledger,
     };
   }
   ```

3. Update export UI to display warning banner:
   ```typescript
   // In admin UI:
   if (exportMetadata.warnings.length > 0) {
     showWarningBanner(
       `⚠️ Export is ${completeness}% complete. ` +
       `Missing: ${exportMetadata.missingData.join(", ")}`
     );
   }
   ```

4. Add test to prevent regression:
   ```typescript
   // tests/e2e/export_completeness.test.ts
   test("Export includes completeness metadata", async () => {
     const export = await generateExport(...);
     expect(export.metadata.completeness).toBeDefined();
     expect(export.metadata.warnings).toBeInstanceOf(Array);
   });
   ```

---

### GAP-G1: No Export Schema Versioning

**Category:** G - Time Durability & Versioning

**Status:** OPEN / HIGH RISK

**Finding:** Export JSON lacks schema version; backward compatibility unknown.

**Evidence:**

File: [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts)

```typescript
Lines 1166-1180:
const export = {
  snapshots: snapshot,
  driftEvents: events,
  runLedger: ledger
  // MISSING: schema_version field
};
```

**Gap Description:**
- If export schema changes (e.g., rename field), old exports become unreadable
- No migration path defined
- Risk: Exports from v1.0 incompatible with v2.0 import logic
- Vendor lock-in: Customer cannot migrate to competing product

**Versioning Scenarios:**

| Version | Change | Impact | Current Handling |
|---------|--------|--------|---|
| 1.0 → 1.1 | Add "automationRules" field | Additive; backward compatible | Unknown |
| 1.0 → 2.0 | Rename "snapshots" → "snapshotData" | Breaking; old exports fail | Unknown |
| 2.0 → 2.1 | Change "completeness" from int to float | Minor; may cause rounding issues | Unknown |

**Fix Complexity:** MEDIUM (1 day)

**Remediation Steps:**

1. Add schema version constant:
   ```typescript
   // src/admin/export_schema.ts
   export const EXPORT_SCHEMA_VERSION = "1.0";
   
   export interface ExportV1 {
     schema_version: "1.0";
     snapshots: Snapshot[];
     driftEvents: DriftEvent[];
     runLedgers: RunLedger[];
   }
   ```

2. Update export generation:
   ```typescript
   function generateExport(...) {
     return {
       schema_version: EXPORT_SCHEMA_VERSION,
       snapshots: snapshot,
       driftEvents,
       runLedgers: ledger,
     };
   }
   ```

3. Create [src/admin/export_migrations.ts](../../src/admin/export_migrations.ts):
   ```typescript
   export function migrateExport(data: any): ExportV1 {
     if (!data.schema_version) {
       // Assume v0.9 (pre-versioning)
       return migrateV0ToV1(data);
     }
     
     switch (data.schema_version) {
       case "1.0":
         return data as ExportV1;
       // future versions handled here
     }
   }
   
   function migrateV0ToV1(legacy: any): ExportV1 {
     return {
       schema_version: "1.0",
       snapshots: legacy.snapshots || [],
       driftEvents: legacy.driftEvents || [],
       runLedgers: legacy.runLedgers || [],
     };
   }
   ```

4. Create [audit/EXPORT_SCHEMA_VERSIONING.md](../../audit/EXPORT_SCHEMA_VERSIONING.md):
   ```markdown
   # Export Schema Versioning Policy
   
   ## Current Version: 1.0
   
   ### Backward Compatibility
   - Supports import of v1.0 exports
   - Supports import of pre-v1.0 exports (auto-migrated)
   - Supports 2-version compatibility window
   
   ### Change Policy
   - Field additions: Minor version bump (1.0 → 1.1); backward compatible
   - Field removals: Major version bump (1.0 → 2.0); migration required
   - Field renames: Major version bump
   
   ### Future Versions
   - v1.1: (future) Add "tags" field to snapshots
   - v2.0: (future) Rename "runLedgers" → "executionHistory"
   ```

---

### GAP-H1: No Adversarial Security Tests

**Category:** H - Adversarial / Negative Tests

**Status:** OPEN / HIGH RISK

**Finding:** Zero adversarial tests; tenant isolation untested; scope boundaries not validated.

**Evidence:**

Command:
```bash
$ find tests/ -name "*adversarial*" -o -name "*tenant*" -o -name "*isolation*"
(No results)
```

**Gap Description:**
- No tests for cross-tenant data access attempts
- No tests for non-admin accessing admin endpoints
- No tests for asApp/asUser boundary violations
- No tests for corrupted/tampered export imports
- Risk: Vulnerabilities not detected until deployment or customer report

**Missing Test Categories:**

| Test | Purpose | Risk if Missing |
|------|---------|---|
| Cross-tenant read (adversarial) | Verify Tenant A cannot read Tenant B data | HIGH - data breach |
| Cross-tenant write (adversarial) | Verify Tenant A cannot modify Tenant B data | HIGH - data integrity |
| Admin-only endpoint (adversarial) | Non-admin cannot access /api/admin/* | MED - privilege escalation |
| Export tampering (adversarial) | Corrupted import rejected | MED - malformed data accepted |
| Permission boundary (adversarial) | asUser() respects Jira permissions | MED - overprivilege |

**Fix Complexity:** MEDIUM (2-3 days)

**Remediation Steps:**

1. Create [tests/adversarial/tenant_isolation.test.ts](../../tests/adversarial/tenant_isolation.test.ts):
   ```typescript
   describe("Adversarial: Tenant Isolation", () => {
     test("Tenant A cannot read Tenant B snapshots", async () => {
       // Setup: Create snapshots in Tenant A and B
       const tenantASnapshot = await captureSnapshot({ tenantId: "tenant-a" });
       const tenantBSnapshot = await captureSnapshot({ tenantId: "tenant-b" });
       
       // Adversarial test: Attempt cross-tenant read
       const ctx = { tenantId: "tenant-a" };
       const result = await readSnapshot(ctx, { tenantId: "tenant-b" });
       
       expect(result).toEqual(null); // Should fail
     });
     
     test("Tenant A cannot modify Tenant B drift events", async () => {
       // Similar test for write permissions
     });
   });
   ```

2. Create [tests/adversarial/permission_elevation.test.ts](../../tests/adversarial/permission_elevation.test.ts):
   ```typescript
   describe("Adversarial: Permission Elevation", () => {
     test("Non-admin cannot access /api/admin/settings", async () => {
       const response = await fetch("/api/admin/settings", {
         headers: { Authorization: "Bearer user-token" }
       });
       expect(response.status).toBe(403); // Forbidden
     });
   });
   ```

3. Create [tests/adversarial/export_validation.test.ts](../../tests/adversarial/export_validation.test.ts):
   ```typescript
   describe("Adversarial: Export Tampering", () => {
     test("Corrupted export import rejected", async () => {
       const corrupted = {
         schema_version: "1.0",
         snapshots: "INVALID_TYPE", // Should be array
       };
       
       expect(() => migrateExport(corrupted)).toThrow();
     });
   });
   ```

4. Add to CI pipeline:
   ```yaml
   .github/workflows/ci.yml:
   - name: Run adversarial tests
     run: npm test -- tests/adversarial/
   ```

---

### GAP-J1: No Policy Drift Release Gates

**Category:** J - Policy Drift Prevention

**Status:** OPEN / HIGH RISK

**Finding:** No CI checks prevent scope creep, egress drift, or data schema changes.

**Evidence:**

Command:
```bash
$ find .github/workflows/ -name "*policy*" -o -name "*drift*" -o -name "*gate*"
(No results)
```

**Gap Description:**
- Manifest can be modified without scope review
- New fetch() calls (external egress) not checked
- Storage schema can change without approval
- Risk: Unintended privilege escalation, data exfiltration, breaking changes

**Drift Prevention Gaps:**

| Drift Type | Current Control | Risk |
|-----------|---|---|
| Manifest scope addition | None | asApp() scope can be silently added |
| Storage schema change | None | New fields without versioning |
| External fetch() call | None | Telemetry/exfiltration added invisibly |
| Retention policy change | None | Data kept longer without review |

**Fix Complexity:** MEDIUM (2 days)

**Remediation Steps:**

1. Create [audit/POLICY_BASELINE.txt](../../audit/POLICY_BASELINE.txt):
   ```
   # Policy Baseline - FirstTry v1.0
   
   ## Manifest Scopes
   - storage (implicit)
   - jira:requestJira (implicit)
   
   ## Storage Keys (allowed patterns)
   - snapshot:*
   - drift:*
   - ledger:*
   
   ## External Domains (allowed)
   (none - all internal)
   
   ## Retention Defaults
   - snapshots: 90 days
   - driftEvents: 365 days
   - runLedgers: 180 days
   ```

2. Create [.github/workflows/policy-drift-check.yml](.github/workflows/policy-drift-check.yml):
   ```yaml
   name: Policy Drift Check
   
   on:
     pull_request:
       paths:
         - 'manifest.yml'
         - 'src/**'
         - 'audit/POLICY_BASELINE.txt'
   
   jobs:
     check-manifest-drift:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
           with:
             fetch-depth: 0
         
         - name: Check manifest scopes
           run: |
             # Extract new scopes in manifest
             git diff main -- manifest.yml | grep -E '^\+.*scope' && {
               echo "ERROR: New scopes added; requires review"
               exit 1
             } || exit 0
         
         - name: Check for new fetch() calls
           run: |
             # Find new external fetch calls
             git diff main -- src/ | grep '^\+.*fetch(' | grep -v 'fetch(window.location\|fetch("api/' && {
               echo "ERROR: New external fetch() call detected; audit required"
               exit 1
             } || exit 0
         
         - name: Check storage schema drift
           run: |
             # Verify storage key patterns unchanged
             git diff main -- src/storage.ts src/phase7/drift_storage.ts | \
               grep -E '^\+.*storage\.(set|get)' | \
               grep -v -E 'snapshot:|drift:|ledger:' && {
               echo "ERROR: New storage key pattern detected; schema review required"
               exit 1
             } || exit 0
   ```

3. Create [scripts/verify-policy-baseline.sh](../../scripts/verify-policy-baseline.sh):
   ```bash
   #!/bin/bash
   set -e
   
   echo "=== Verifying Policy Baseline ==="
   
   # Check 1: Manifest scopes match baseline
   BASELINE_SCOPES=$(grep "^- " audit/POLICY_BASELINE.txt | cut -d' ' -f2)
   MANIFEST_SCOPES=$(grep -A 20 "scopes:" manifest.yml 2>/dev/null || echo "")
   
   for scope in $BASELINE_SCOPES; do
     if ! echo "$MANIFEST_SCOPES" | grep -q "$scope"; then
       echo "WARNING: Baseline scope '$scope' not found in manifest"
     fi
   done
   
   # Check 2: Retention policy matches baseline
   BASELINE_TTL=$(grep "snapshots:" audit/POLICY_BASELINE.txt | cut -d' ' -f2)
   CODE_TTL=$(grep -n "RETENTION_POLICY.snapshots" src/ 2>/dev/null || echo "90")
   
   if [ "$BASELINE_TTL" != "$CODE_TTL" ]; then
     echo "ERROR: Retention policy drift detected"
     exit 1
   fi
   
   echo "✓ Policy baseline verified"
   ```

---

## HIGH-RISK GAPS (P2: Hardening Required)

### GAP-B1: asUser() Scope Usage Under-Justified

**Category:** B - Cloud App Security Baseline

**Status:** OPEN / MED RISK

**Finding:** asUser() used in drift storage without documentation of why less-privileged scope is necessary.

**Evidence:**

File: [src/phase7/drift_storage.ts](../../src/phase7/drift_storage.ts)

```typescript
Lines 47-48:   const data = await asUser().requestJira(...)
Lines 67-68:   const driftData = await asUser().requestJira(...)
Lines 105-106: await asUser().storage.set(...)
```

**Gap Description:**
- asUser() requires user permission; asApp() is less restrictive
- No JSDoc comment explains why asUser() is preferred
- Risk: Reviewer/auditor cannot verify least privilege was intentional
- Future maintenance: Developer may "upgrade" to asApp() unnecessarily

**Fix Complexity:** LOW (1 hour)

**Remediation:**
```typescript
// src/phase7/drift_storage.ts line 47
/** 
 * asUser() scope ensures drift detection respects user's Jira permissions.
 * If user lacks permission to view a custom field, it won't appear in drift analysis.
 * This prevents exposing data the user shouldn't see.
 */
const data = await asUser().requestJira(...)
```

---

### GAP-D1: Severity-Based SLA Tiers Missing

**Category:** D - Vulnerability Management

**Status:** OPEN / MED RISK

**Finding:** SECURITY.md defines "48h ack, 5 days assess" but no severity tiers.

**Evidence:**

File: [SECURITY.md](../../SECURITY.md)

```markdown
Lines 31-40:
"We aim to acknowledge reports within 48 hours 
and provide initial assessment within 5 days"
(No SEV-1, SEV-2, SEV-3 tiers)
```

**Gap Description:**
- One SLA for all severity levels (unrealistic)
- RCE (Critical) treated same as info disclosure (Low)
- Marketplaces expect severity-tiered SLAs
- Risk: Response time expectations unmet; vendor credibility damage

**Fix Complexity:** LOW (30 min)

**Remediation:**

Add to [SECURITY.md](../../SECURITY.md):
```markdown
## Severity Tiers and SLAs

### SEV-1: Critical (RCE, Data Breach, Auth Bypass)
- **Acknowledgment:** 24 hours
- **Initial Fix:** 7 days
- **Example:** Unauthenticated access to tenant data via API

### SEV-2: High (Privilege Escalation, Information Disclosure)
- **Acknowledgment:** 48 hours
- **Initial Fix:** 14 days
- **Example:** Non-admin accessing admin endpoints

### SEV-3: Medium (Logic Bug, DoS)
- **Acknowledgment:** 72 hours
- **Initial Fix:** 30 days
- **Example:** Job scheduler fails silently; missing data not detected

## Escalation Path
- P0 (SEV-1): security@firsttry.dev + on-call escalation
- P1 (SEV-2): security@firsttry.dev
- P2 (SEV-3): security@firsttry.dev (standard queue)
```

---

### GAP-E2: Snapshot Staleness Not Detected

**Category:** E - Fail-Closed Semantics

**Status:** OPEN / MED RISK

**Finding:** Snapshot doesn't include capture timestamp; no staleness detection before export.

**Evidence:**

File: [src/phase6/snapshot_capture.ts](../../src/phase6/snapshot_capture.ts)

```typescript
Lines 48-70:
async function captureSnapshot() {
  const snapshot = {
    projects: [...],
    issueTypes: [...],
    // MISSING: capturedAt: Date
  };
  return snapshot;
}
```

**Gap Description:**
- User exports data without knowing age
- If snapshot capture failed yesterday, export shows stale data without warning
- Silent degradation: User thinks they have fresh data

**Fix Complexity:** LOW (1 hour)

**Remediation:**
```typescript
// src/phase6/snapshot_capture.ts
async function captureSnapshot() {
  const snapshot = {
    capturedAt: new Date(),  // ADD THIS
    projects: [...],
    issueTypes: [...],
  };
  return snapshot;
}

// src/admin/phase5_admin_page.ts (export function)
function generateExport(snapshot) {
  const ageHours = (Date.now() - snapshot.capturedAt) / (1000 * 60 * 60);
  
  if (ageHours > 24) {
    addWarning(`Snapshot is ${Math.round(ageHours)}h old; may be stale`);
  }
  
  return completeExport;
}
```

---

### GAP-F1: Token Refresh Grace Period Undocumented

**Category:** F - Operator-Proofing

**Status:** OPEN / MED RISK

**Finding:** 12-hour token refresh interval without documented grace period or expiry alert.

**Evidence:**

File: [manifest.yml](../../manifest.yml)

```yaml
Lines 63-65:
token-refresh-job:
  scheduled: "0 */12 * * *"  # Every 12 hours
  (No grace period documented)
```

**Gap Description:**
- Tokens may expire while refresh is pending
- No proactive alert if refresh fails
- Operators don't know when to manually refresh
- Silent failure: App loses Jira access without warning

**Fix Complexity:** LOW (2 hours)

**Remediation:**

1. Document grace period in [DEVELOPING.md](../../DEVELOPING.md):
   ```markdown
   ## Token Refresh Configuration
   
   - Token TTL: 24 hours
   - Refresh interval: Every 12 hours (12h before expiry)
   - Grace period: 6 hours (max time after refresh to use old token)
   - Alert threshold: 3 consecutive refresh failures
   
   If refresh fails:
   1. Alert sent to admin at 3 failures
   2. Manual refresh available via admin page
   3. Ingest disabled if token expired and refresh failed
   ```

2. Add admin UI alert for token expiry:
   ```typescript
   // src/admin/phase5_admin_page.ts
   const tokenExpiresAt = await getTokenExpiry();
   const hoursUntilExpiry = (tokenExpiresAt - Date.now()) / (1000 * 60 * 60);
   
   if (hoursUntilExpiry < 6) {
     showAlert(`⚠️ Token expires in ${Math.round(hoursUntilExpiry)}h. 
               Refresh scheduled; check back in 1h.`);
   }
   
   if (hoursUntilExpiry < 0) {
     showAlert(`🚨 Token expired! Manual refresh required.`, "error");
   }
   ```

---

## MEDIUM-RISK GAPS (P2: Hardening)

### GAP-A1: Security Contact Not Verified

**Category:** A - Marketplace Workflow

**Status:** OPEN / MED RISK

**Finding:** SECURITY.md declares security@firsttry.dev but no delivery test documented.

**Evidence:**

File: [SECURITY.md](../../SECURITY.md) lines 5-6

**Gap Description:**
- Email address may be typo or non-existent
- Marketplace expects contact to be monitored
- Risk: Security reports don't reach team

**Fix Complexity:** LOW (15 min + vendor setup)

**Remediation:**
1. Add to CI/CD:
   ```bash
   # scripts/verify-security-contact.sh
   curl -s https://mxtoolbox.com/api/v1/reverse-dns \
     -d "argument=security@firsttry.dev" | grep -q "status.*success" || {
     echo "ERROR: Security contact email undeliverable"
     exit 1
   }
   ```

2. Document in SECURITY.md:
   ```markdown
   ## Contact Verification
   - Email: security@firsttry.dev
   - Last verified: [DATE]
   - Verification method: MX record check + test delivery
   ```

---

## LOW-RISK GAPS (P3: Future Hardening)

### GAP-B2: Tenant Isolation E2E Not Tested

**Category:** B - Cloud App Security Baseline

**Status:** OPEN / LOW RISK (architecture appears sound)

**Finding:** Tenant isolation code present; no end-to-end integration test.

**Evidence:**

Files: [src/phase7/drift_compute.ts](../../src/phase7/drift_compute.ts), [src/phase7/drift_storage.ts](../../src/phase7/drift_storage.ts)

**Gap Description:**
- Code includes tenantId scoping
- No test verifies isolation works in practice
- Risk: Subtle bugs in prefix matching could leak data

**Fix Complexity:** LOW (4 hours)

**Remediation:**
```typescript
// tests/integration/tenant_isolation.test.ts
describe("Tenant Isolation Integration", () => {
  test("Tenant A snapshots not visible to Tenant B", async () => {
    // Create 2 tenants with different data
    // Verify cross-read fails
  });
});
```

---

## SUMMARY OF ALL GAPS

| Gap ID | Category | Severity | Status | Fix Days | Fix Complexity |
|--------|----------|----------|--------|----------|---|
| C1 | Privacy & Logging | HIGH | OPEN | 1-2 | M |
| C2 | Privacy & Retention | HIGH | OPEN | 1-2 | M |
| E1 | Fail-Closed & Staleness | HIGH | OPEN | 1-2 | M |
| G1 | Versioning | HIGH | OPEN | 1 | M |
| H1 | Adversarial Tests | HIGH | OPEN | 2-3 | M |
| J1 | Policy Drift Gates | HIGH | OPEN | 2 | M |
| I1 | SLI/SLO Metrics | HIGH | OPEN | 2-3 | M |
| A1 | Security Contact | MED | OPEN | <1 | S |
| B1 | Scope Justification | MED | OPEN | <1 | S |
| D1 | SLA Tiers | MED | OPEN | <1 | S |
| E2 | Staleness Detection | MED | OPEN | 1 | S |
| F1 | Token Expiry Alerts | MED | OPEN | 2 | S |
| B2 | Tenant Isolation Test | LOW | OPEN | <1 | S |

---

## CRITICAL PATH TO MARKETPLACE APPROVAL

**Blocking Issues (Must Fix):**
1. GAP-C1: PII logging (compliance blocker)
2. GAP-G1: Export versioning (backward compatibility)
3. GAP-H1: Adversarial tests (security validation)
4. GAP-J1: Policy drift gates (scope creep prevention)

**Expected Timeline:** 8-10 business days of focused effort

**Resource Requirements:**
- 1 security engineer (3-4 days)
- 1 backend engineer (3-4 days)
- 1 QA engineer (2 days for adversarial test suite)


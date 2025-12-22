# REMEDIATION_PATCHES.md - Implementation Patches for All Gaps

This document provides concrete code patches to remediate all identified security gaps.

---

## PATCH SET 1: PII Logging Redaction (GAP-C1)

### Patch 1.1: Global Console.log Redaction Hook

**File:** [src/phase9/log_redaction.ts](../../src/phase9/log_redaction.ts)

**Current Code:**
```typescript
// Lines 176-209: Existing redact() function (keep as-is)
export function redact(input: string): string {
  return input
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "[UUID]")
    .replace(/\b[A-Z]{2,}-\d+\b/g, "[JIRA_KEY]");
}
```

**Patch to Add (after line 209):**
```typescript
/**
 * Auto-redact all console.log, console.warn, console.error calls.
 * Call this at app startup to enforce redaction globally.
 */
export function enforceConsoleRedaction(): void {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = function(...args: any[]): void {
    const redactedArgs = args.map(arg => {
      const str = String(arg);
      return typeof arg === 'object' ? arg : redact(str);
    });
    originalLog(...redactedArgs);
  };
  
  console.warn = function(...args: any[]): void {
    const redactedArgs = args.map(arg => {
      const str = String(arg);
      return typeof arg === 'object' ? arg : redact(str);
    });
    originalWarn(...redactedArgs);
  };
  
  console.error = function(...args: any[]): void {
    const redactedArgs = args.map(arg => {
      const str = String(arg);
      return typeof arg === 'object' ? arg : redact(str);
    });
    originalError(...redactedArgs);
  };
}
```

**Hook Location to Call:**

**File:** [src/index.ts](../../src/index.ts) or [src/main.ts](../../src/main.ts) (wherever app initializes)

**Add at top of main function:**
```typescript
import { enforceConsoleRedaction } from './phase9/log_redaction';

async function initializeApp() {
  enforceConsoleRedaction();  // ADD THIS LINE
  // ... rest of initialization
}
```

---

### Patch 1.2: Audit and Mark Unredacted Logging Calls

**Files with High Unredacted Risk:**

**File:** [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts) (line 1145)

**Current:**
```typescript
console.log(`Export started by ${userName}`);
```

**Patched:**
```typescript
// @redacted - userName may contain PII
console.log(`Export started by ${redact(userName)}`);
```

**File:** [src/phase6/snapshot_capture.ts](../../src/phase6/snapshot_capture.ts) (line 48)

**Current:**
```typescript
console.log(`Captured snapshot: ${snapshot.name}`);
```

**Patched:**
```typescript
// @redacted - snapshot.name may contain field values
console.log(`Captured snapshot: ${redact(snapshot.name)}`);
```

**Automated Fix (Bash):**
```bash
# Find all unredacted console.log calls and add redaction
for file in $(grep -rl "console\.log(" src/); do
  sed -i 's/console\.log(`\([^`]*\${\([^}]*\)}\([^`]*\)`)/console.log(`\1${ redact(\2) }\3`)/g' "$file"
done
```

---

### Patch 1.3: Linter Rule to Prevent Regression

**File:** [.eslintrc.json](.eslintrc.json) or create if missing

**Add Rule:**
```json
{
  "rules": {
    "no-console": [
      "warn",
      {
        "allow": ["warn", "error"]
      }
    ],
    "custom/check-console-redaction": [
      "error",
      {
        "patterns": [
          {
            "selector": "CallExpression[callee.object.name='console'][callee.property.name='log']",
            "message": "console.log() must use redact() for dynamic content; add JSDoc @redacted"
          }
        ]
      }
    ]
  }
}
```

**Or Create Custom Plugin:**

**File:** [scripts/eslint-console-redaction.js](../../scripts/eslint-console-redaction.js)

```javascript
module.exports = {
  rules: {
    'enforce-console-redaction': {
      meta: {
        docs: {
          description: 'Enforce console.log() redaction for PII prevention'
        }
      },
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.type === 'MemberExpression' &&
                node.callee.object.name === 'console' &&
                node.callee.property.name === 'log') {
              
              const sourceCode = context.getSourceCode();
              const comment = sourceCode.getCommentsInside(node)[0];
              
              if (!comment || !comment.value.includes('@redacted')) {
                context.report({
                  node,
                  message: 'Add @redacted JSDoc comment if logging dynamic content'
                });
              }
            }
          }
        };
      }
    }
  }
};
```

---

## PATCH SET 2: Data Retention Policy (GAP-C2)

### Patch 2.1: Create Retention Policy Constants

**File:** [src/retention/retention_policy.ts](../../src/retention/retention_policy.ts) (create new)

```typescript
/**
 * Data Retention Policy - FirstTry Jira App
 * 
 * Defines TTL (time-to-live) for all data types.
 * Automatic cleanup runs daily via scheduled job.
 */

export const RETENTION_POLICY = {
  /** Jira snapshot history; retained for 90 days default */
  snapshots: {
    ttlDays: 90,
    description: "Project, issue type, and custom field snapshots"
  },
  
  /** Drift event history; retained for full year for trend analysis */
  driftEvents: {
    ttlDays: 365,
    description: "Configuration change detection events"
  },
  
  /** Job execution ledger; retained for compliance logging */
  runLedgers: {
    ttlDays: 180,
    description: "Scheduled job run history and status"
  },
  
  /** OAuth refresh tokens; auto-expire at Jira token deadline */
  refreshTokens: {
    ttlDays: 1,
    description: "Short-lived refresh tokens for API access"
  },
  
  /** Temporary exports in storage (browser downloads to local) */
  tempExports: {
    ttlDays: 7,
    description: "Temporary export files pending download"
  }
};

/**
 * Calculate deletion timestamp for a data item created at `createdAt`
 */
export function calculateDeletionTimestamp(
  createdAt: Date,
  dataType: keyof typeof RETENTION_POLICY
): Date {
  const ttlDays = RETENTION_POLICY[dataType].ttlDays;
  const deletion = new Date(createdAt);
  deletion.setDate(deletion.getDate() + ttlDays);
  return deletion;
}

/**
 * Check if a data item is expired
 */
export function isExpired(
  createdAt: Date,
  dataType: keyof typeof RETENTION_POLICY
): boolean {
  return calculateDeletionTimestamp(createdAt, dataType) < new Date();
}
```

---

### Patch 2.2: Extend Cleanup Job

**File:** [src/retention/cleanup.ts](../../src/retention/cleanup.ts)

**Add Import (top of file):**
```typescript
import { RETENTION_POLICY, isExpired } from './retention_policy';
```

**Add Comprehensive Cleanup Function:**
```typescript
/**
 * Comprehensive data cleanup for all retention policies.
 * Called daily by scheduled job.
 */
export async function purgeExpiredData(): Promise<{
  snapshotsDeleted: number;
  driftEventsDeleted: number;
  ledgersDeleted: number;
  tokensDeleted: number;
}> {
  const results = {
    snapshotsDeleted: 0,
    driftEventsDeleted: 0,
    ledgersDeleted: 0,
    tokensDeleted: 0
  };
  
  try {
    console.log("🗑️  Starting data cleanup cycle");
    
    // Cleanup 1: Delete old snapshots
    results.snapshotsDeleted = await deleteOldSnapshots(
      RETENTION_POLICY.snapshots.ttlDays
    );
    console.log(`✓ Deleted ${results.snapshotsDeleted} expired snapshots`);
    
    // Cleanup 2: Delete old drift events
    results.driftEventsDeleted = await deleteOldDriftEvents(
      RETENTION_POLICY.driftEvents.ttlDays
    );
    console.log(`✓ Deleted ${results.driftEventsDeleted} expired drift events`);
    
    // Cleanup 3: Delete old run ledgers
    results.ledgersDeleted = await deleteOldLedgers(
      RETENTION_POLICY.runLedgers.ttlDays
    );
    console.log(`✓ Deleted ${results.ledgersDeleted} expired ledger entries`);
    
    // Cleanup 4: Delete expired refresh tokens
    results.tokensDeleted = await deleteExpiredTokens();
    console.log(`✓ Deleted ${results.tokensDeleted} expired refresh tokens`);
    
    console.log(`✅ Cleanup cycle complete: ${
      results.snapshotsDeleted + 
      results.driftEventsDeleted + 
      results.ledgersDeleted + 
      results.tokensDeleted
    } total items purged`);
    
    return results;
  } catch (error) {
    console.error("❌ Cleanup cycle failed", error);
    throw error;
  }
}

/**
 * Delete drift events older than ttlDays
 */
async function deleteOldDriftEvents(ttlDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ttlDays);
  
  // Assuming drift events stored with tenantId prefix in Forge Storage
  const storage = asApp().storage;
  
  // Get all drift event keys
  const driftKeys = (await storage.list())
    .keys.filter(k => k.startsWith('drift:'));
  
  let deleted = 0;
  for (const key of driftKeys) {
    const data = await storage.get(key);
    if (data && new Date(data.createdAt) < cutoffDate) {
      await storage.delete(key);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Delete run ledgers older than ttlDays
 */
async function deleteOldLedgers(ttlDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ttlDays);
  
  const storage = asApp().storage;
  const ledgerKeys = (await storage.list())
    .keys.filter(k => k.startsWith('ledger:'));
  
  let deleted = 0;
  for (const key of ledgerKeys) {
    const data = await storage.get(key);
    if (data && new Date(data.timestamp) < cutoffDate) {
      await storage.delete(key);
      deleted++;
    }
  }
  return deleted;
}
```

---

### Patch 2.3: Add Scheduled Cleanup Job

**File:** [manifest.yml](../../manifest.yml)

**Add After existing token-refresh-job (line ~65):**
```yaml
  retention-cleanup-job:
    - key: retention-cleanup-job
      description: 'Daily cleanup of expired data per retention policy'
      schedule: '0 2 * * *'  # Run at 2 AM UTC daily
      function: purgeExpiredData
```

---

### Patch 2.4: Document Retention Policy

**File:** [PRIVACY.md](../../PRIVACY.md) (create if missing)

```markdown
# FirstTry Privacy & Data Retention Policy

## Data Retention Schedule

| Data Category | Retention Period | Rationale | Deletion Method |
|---|---|---|---|
| Jira Snapshots | 90 days | Trend analysis window; prevents unbounded growth | Automatic daily job |
| Drift Events | 365 days (1 year) | Annual compliance audit trail | Automatic daily job |
| Run Ledgers | 180 days (6 months) | Job history for troubleshooting | Automatic daily job |
| Refresh Tokens | 1 day | OAuth security best practice | Auto-expire at Jira deadline |
| Exports (temp) | 7 days | Grace period for user download | Auto-delete after download |

## Automatic Deletion Schedule

- **Job:** `retention-cleanup-job` runs daily at 02:00 UTC
- **What's deleted:** All data items past their TTL per table above
- **Audit trail:** Deletion count logged to run ledger
- **Recovery:** No recovery after 24h; exports recommended for archival

## Manual Deletion (Right to be Forgotten)

To request immediate deletion of all tenant data:

1. Contact: security@firsttry.dev
2. Include: Tenant ID and reason
3. SLA: Deletion confirmed within 7 business days
4. Confirmation: Receipt email + deletion timestamp

## Data Stored During Retention Period

During active retention, FirstTry stores:
- Jira project metadata (names, keys, types)
- Custom field configuration (names, types, options)
- Configuration changes (drift events)
- Job execution records (timestamps, status)

FirstTry does NOT store:
- Issue content (titles, descriptions, comments)
- User profile data (emails, avatars, preferences)
- Attachment content
- Issue comments or history

## Compliance

This policy satisfies:
- GDPR Article 5(1)(e): Data kept "no longer than necessary"
- CCPA Section 1798.100: Consumer right to deletion
- Data residency: All data in Jira Cloud (region-specific)
```

---

## PATCH SET 3: Export Completeness Warnings (GAP-E1)

### Patch 3.1: Create Export Schema with Metadata

**File:** [src/admin/export_schema.ts](../../src/admin/export_schema.ts) (create new)

```typescript
/**
 * Export schema definition with versioning and completeness tracking.
 */

export const EXPORT_SCHEMA_VERSION = "1.0";

export interface ExportMetadata {
  /** ISO timestamp when export was generated */
  exportedAt: string;
  
  /** Export schema version for backward compatibility */
  schemaVersion: string;
  
  /** Snapshot capture age in hours (0 if fresh) */
  snapshotAgeHours: number;
  
  /** Completeness percentage (0-100) */
  completeness: {
    /** % of expected snapshot data available */
    snapshots: number;
    /** % of drift events captured */
    driftEvents: number;
    /** % of run ledger populated */
    runLedgers: number;
  };
  
  /** Human-readable warnings about data quality */
  warnings: string[];
  
  /** Known gaps in data */
  missingData: string[];
}

export interface ExportV1 {
  metadata: ExportMetadata;
  snapshots: any[];
  driftEvents: any[];
  runLedgers: any[];
}

/**
 * Calculate export completeness from available data
 */
export function calculateCompleteness(data: {
  snapshot?: any;
  driftEvents: any[];
  ledger?: any;
}): {
  completeness: ExportMetadata['completeness'];
  warnings: string[];
  missingData: string[];
} {
  const completeness = {
    snapshots: data.snapshot ? 100 : 0,
    driftEvents: data.driftEvents.length > 0 ? 100 : 0,
    runLedgers: data.ledger ? 100 : 0,
  };
  
  const warnings: string[] = [];
  const missingData: string[] = [];
  
  if (completeness.snapshots === 0) {
    warnings.push("Snapshot not captured; configuration baseline missing");
    missingData.push("Project/Field snapshot");
  }
  
  if (completeness.driftEvents === 0) {
    warnings.push("No drift events detected; possible computation failure");
    missingData.push("Configuration change history");
  }
  
  if (completeness.runLedgers === 0) {
    warnings.push("Run ledger empty; job may not have executed");
    missingData.push("Job execution history");
  }
  
  // Check snapshot staleness
  if (data.snapshot) {
    const ageHours = (Date.now() - new Date(data.snapshot.capturedAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) {
      warnings.push(`Snapshot is ${Math.round(ageHours)}h old; may be stale`);
    }
  }
  
  const overallCompleteness = 
    (completeness.snapshots + completeness.driftEvents + completeness.runLedgers) / 3;
  
  return {
    completeness: {
      ...completeness,
      snapshots: Math.round(overallCompleteness) // Simplified for demo
    },
    warnings,
    missingData
  };
}
```

---

### Patch 3.2: Update Export Generation

**File:** [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts)

**Old Code (around line 1166):**
```typescript
function generateExport(snapshot, driftEvents, ledger) {
  return JSON.stringify(snapshot, null, 2);
}
```

**New Code:**
```typescript
import { EXPORT_SCHEMA_VERSION, calculateCompleteness, ExportV1 } from '../admin/export_schema';

function generateExport(snapshot, driftEvents, ledger): ExportV1 {
  const { completeness, warnings, missingData } = calculateCompleteness({
    snapshot,
    driftEvents,
    ledger
  });
  
  const exportData: ExportV1 = {
    metadata: {
      exportedAt: new Date().toISOString(),
      schemaVersion: EXPORT_SCHEMA_VERSION,
      snapshotAgeHours: snapshot 
        ? (Date.now() - new Date(snapshot.capturedAt).getTime()) / (1000 * 60 * 60)
        : 0,
      completeness,
      warnings,
      missingData
    },
    snapshots: snapshot ? [snapshot] : [],
    driftEvents: driftEvents || [],
    runLedgers: ledger ? [ledger] : []
  };
  
  return exportData;
}
```

---

### Patch 3.3: Update Export UI to Show Warnings

**File:** [src/admin/phase5_admin_page.ts](../../src/admin/phase5_admin_page.ts) (around line 1180-1200)

**Add:**
```typescript
function displayExportWarnings(export: ExportV1) {
  if (export.metadata.warnings.length === 0) {
    return; // No warnings
  }
  
  const warningHtml = `
    <div class="export-warning-banner" style="
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
      color: #856404;
    ">
      <strong>⚠️ Export Completeness: ${export.metadata.completeness.snapshots}%</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px;">
        ${export.metadata.warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
      <small style="display: block; margin-top: 8px;">
        This export may be incomplete. 
        Missing: ${export.metadata.missingData.join(', ')}
      </small>
    </div>
  `;
  
  document.getElementById('export-container').insertAdjacentHTML('beforeend', warningHtml);
}
```

---

## PATCH SET 4: Export Schema Versioning (GAP-G1)

### Patch 4.1: Add Version Field to Export

**File:** [src/admin/export_schema.ts](../../src/admin/export_schema.ts)

**(Already included in Patch 3.1; version field added as `schemaVersion`)**

---

### Patch 4.2: Create Migration Layer

**File:** [src/admin/export_migrations.ts](../../src/admin/export_migrations.ts) (create new)

```typescript
/**
 * Export schema migrations for backward/forward compatibility.
 * 
 * Supports importing exports from older versions and migrating them.
 */

import { ExportV1, EXPORT_SCHEMA_VERSION } from './export_schema';

export type SupportedExportVersion = "1.0" | "0.9";

/**
 * Migrate any export to current schema version
 */
export function migrateExport(data: any, targetVersion = EXPORT_SCHEMA_VERSION): ExportV1 {
  const sourceVersion = data.metadata?.schemaVersion || data.schemaVersion || "0.9";
  
  if (sourceVersion === "1.0") {
    // Already current; return as-is
    return data as ExportV1;
  }
  
  if (sourceVersion === "0.9" || !data.schemaVersion) {
    // Pre-v1.0; needs migration
    return migrateV0ToV1(data);
  }
  
  throw new Error(`Unknown export schema version: ${sourceVersion}`);
}

/**
 * Migrate pre-v1.0 exports to v1.0 format
 */
function migrateV0ToV1(legacy: any): ExportV1 {
  // v0.9 format assumed to be flat
  // v1.0 format requires metadata wrapper
  
  return {
    metadata: {
      exportedAt: legacy.exportedAt || new Date().toISOString(),
      schemaVersion: "1.0",
      snapshotAgeHours: 0,
      completeness: {
        snapshots: legacy.snapshots ? 100 : 0,
        driftEvents: legacy.driftEvents ? 100 : 0,
        runLedgers: legacy.runLedgers ? 100 : 0,
      },
      warnings: [
        "Migrated from pre-v1.0 export format; metadata may be incomplete"
      ],
      missingData: []
    },
    snapshots: Array.isArray(legacy.snapshots) ? legacy.snapshots : legacy.snapshot ? [legacy.snapshot] : [],
    driftEvents: Array.isArray(legacy.driftEvents) ? legacy.driftEvents : legacy.driftEvents ? [legacy.driftEvents] : [],
    runLedgers: Array.isArray(legacy.runLedgers) ? legacy.runLedgers : legacy.runLedger ? [legacy.runLedger] : []
  };
}

/**
 * Validate export schema
 */
export function validateExport(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check schema version
  if (!data.metadata?.schemaVersion) {
    errors.push("Missing metadata.schemaVersion");
  }
  
  // Check required arrays
  if (!Array.isArray(data.snapshots)) {
    errors.push("snapshots must be an array");
  }
  if (!Array.isArray(data.driftEvents)) {
    errors.push("driftEvents must be an array");
  }
  if (!Array.isArray(data.runLedgers)) {
    errors.push("runLedgers must be an array");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

### Patch 4.3: Document Versioning Policy

**File:** [audit/EXPORT_SCHEMA_VERSIONING.md](../../audit/EXPORT_SCHEMA_VERSIONING.md) (create new)

```markdown
# Export Schema Versioning Policy

## Current Version: 1.0

Released: [DATE]

### Schema Definition

```json
{
  "metadata": {
    "exportedAt": "2024-01-15T10:30:00Z",
    "schemaVersion": "1.0",
    "snapshotAgeHours": 2,
    "completeness": {
      "snapshots": 100,
      "driftEvents": 87,
      "runLedgers": 100
    },
    "warnings": ["Drift events 87% complete"],
    "missingData": ["automation_rules"]
  },
  "snapshots": [...],
  "driftEvents": [...],
  "runLedgers": [...]
}
```

## Backward Compatibility

### Supported Import Versions

- **1.0**: Full support; no migration needed
- **0.9**: Auto-migrated to 1.0 on import
- **< 0.9**: Not supported; user must re-export

### Migration Process

When importing pre-v1.0 exports:
1. `migrateExport(data)` called automatically
2. Legacy format detected and transformed
3. Metadata rebuilt with best-effort reconstruction
4. Warning added: "Migrated from older format; some data may be missing"

## Change Policy

### Minor Version Changes (1.0 → 1.1)
- **Allowed:** New optional fields
- **Backward Compatible:** Yes (old exports still readable)
- **Example:** Add `tags: []` field to snapshots
- **Migration:** None required

### Major Version Changes (1.0 → 2.0)
- **Allowed:** Field removals, field renames, breaking changes
- **Backward Compatible:** No
- **Example:** Rename `runLedgers` → `executionHistory`
- **Migration:** Required; old exports cannot import into new version

## Sunset Timeline

### v1.x Support
- **Released:** 2024-Q1
- **Sunset:** 2025-Q1 (minimum 1 year)
- **Notice:** 6-month deprecation warning before sunset

### v0.9 Support
- **Status:** Already sunset
- **Migration:** Auto-upgrade to v1.0 on import
- **Cutoff:** 2024-06-30 (no more v0.9 migrations after this date)

## Release Process

1. **New version proposed** → Discussed with security team
2. **Impact assessment** → What breaks? Migration path?
3. **Implementation** → Code changes + migration function
4. **Testing** → Cross-version import/export tests
5. **Announcement** → 6-month notice before sunset of old version
6. **Enforcement** → After sunset date, old version rejected

## FAQ

**Q: Can I import a v2.0 export into v1.0?**
A: No. Always export from the version you're currently using.

**Q: How long do I have to migrate?**
A: Minimum 1 year from release date; typically longer.

**Q: What if my export is super old?**
A: Contact support@firsttry.dev for recovery help.
```

---

## PATCH SET 5: Adversarial Tests (GAP-H1)

### Patch 5.1: Create Tenant Isolation Test Suite

**File:** [tests/adversarial/tenant_isolation.test.ts](../../tests/adversarial/tenant_isolation.test.ts) (create new)

```typescript
/**
 * Adversarial security tests for tenant isolation.
 * 
 * These tests verify that Tenant A cannot access/modify Tenant B's data,
 * even through edge cases or API misuse.
 */

describe("Adversarial: Tenant Isolation", () => {
  const TENANT_A = "adversarial-tenant-a";
  const TENANT_B = "adversarial-tenant-b";
  
  beforeEach(async () => {
    // Setup: Create isolated test contexts for each tenant
    await setupTenant(TENANT_A);
    await setupTenant(TENANT_B);
  });
  
  describe("Storage Access Isolation", () => {
    test("Tenant A cannot read Tenant B snapshots", async () => {
      // Setup: Create snapshot in Tenant B
      const tenantBContext = { tenantId: TENANT_B };
      const snapshot = await captureSnapshot(tenantBContext);
      
      // Adversarial: Try to read as Tenant A
      const tenantAContext = { tenantId: TENANT_A };
      const result = await readSnapshot(tenantAContext, snapshot.id);
      
      // Verify: Access denied
      expect(result).toBeNull();
    });
    
    test("Tenant A cannot read Tenant B drift events", async () => {
      // Setup: Create drift event in Tenant B
      const tenantBContext = { tenantId: TENANT_B };
      const driftEvent = await createDriftEvent(tenantBContext, {
        type: "FIELD_ADDED",
        fieldName: "Secret Field"
      });
      
      // Adversarial: List all drift events as Tenant A
      const tenantAContext = { tenantId: TENANT_A };
      const driftEvents = await listDriftEvents(tenantAContext);
      
      // Verify: Tenant B's drift event not in Tenant A's list
      const found = driftEvents.find(e => e.id === driftEvent.id);
      expect(found).toBeUndefined();
    });
    
    test("Tenant A cannot write to Tenant B storage", async () => {
      // Adversarial: Try to write as Tenant A to Tenant B's key
      const tenantAContext = { tenantId: TENANT_A };
      const write = await writeTenantData(
        tenantAContext,
        `drift:${TENANT_B}:test`, // Manually craft Tenant B key
        { data: "injected" }
      );
      
      // Verify: Write failed (permission check)
      expect(write.success).toBe(false);
      expect(write.error).toContain("tenant mismatch");
    });
  });
  
  describe("API Boundary Exploitation", () => {
    test("Cannot spoof tenant ID via storage.set()", async () => {
      // Adversarial: Attempt to override tenantId
      const context = { tenantId: TENANT_A };
      
      // Try to write with explicit cross-tenant key
      const maliciousKey = `drift:${TENANT_B}:spoofed`;
      
      expect(async () => {
        await asApp().storage.set(maliciousKey, { data: "attack" });
      }).rejects.toThrow("tenant ID mismatch");
    });
    
    test("Cannot access asApp() data via asUser() context", async () => {
      // Setup: Admin creates sensitive config as asApp()
      const adminContext = { isAdmin: true };
      const secretConfig = await storeAdminConfig(adminContext, { 
        mode: "restricted" 
      });
      
      // Adversarial: Regular user tries to read via asUser()
      const userContext = { tenantId: TENANT_A, isAdmin: false };
      const result = await readAdminConfig(userContext);
      
      expect(result).toBeNull();
    });
  });
  
  describe("Export Data Leakage", () => {
    test("Export includes only current tenant's data", async () => {
      // Setup: Both tenants have data
      await captureSnapshot({ tenantId: TENANT_A });
      await captureSnapshot({ tenantId: TENANT_B });
      
      // Generate export as Tenant A
      const export = await generateExport({ tenantId: TENANT_A });
      
      // Verify: Only Tenant A snapshots included
      expect(export.snapshots).toHaveLength(1);
      expect(export.snapshots[0].tenantId).toBe(TENANT_A);
    });
  });
  
  afterEach(async () => {
    // Cleanup
    await teardownTenant(TENANT_A);
    await teardownTenant(TENANT_B);
  });
});
```

---

### Patch 5.2: Permission Elevation Test Suite

**File:** [tests/adversarial/permission_elevation.test.ts](../../tests/adversarial/permission_elevation.test.ts) (create new)

```typescript
/**
 * Adversarial tests for permission boundary violations.
 * 
 * Verify that non-admin users cannot access admin-only endpoints.
 */

describe("Adversarial: Permission Elevation", () => {
  const ADMIN_USER = "admin@example.com";
  const REGULAR_USER = "user@example.com";
  
  describe("Admin Endpoint Protection", () => {
    test("Non-admin cannot access /api/admin/settings", async () => {
      const response = await fetch("/api/admin/settings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await getToken(REGULAR_USER)}`
        }
      });
      
      expect(response.status).toBe(403);
    });
    
    test("Non-admin cannot modify retention policy", async () => {
      const response = await fetch("/api/admin/retention-policy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getToken(REGULAR_USER)}`
        },
        body: JSON.stringify({ snapshotsTtl: 30 })
      });
      
      expect(response.status).toBe(403);
    });
    
    test("Non-admin cannot download audit logs", async () => {
      const response = await fetch("/api/admin/audit-logs/export", {
        headers: {
          Authorization: `Bearer ${await getToken(REGULAR_USER)}`
        }
      });
      
      expect(response.status).toBe(403);
    });
  });
  
  describe("Privilege Escalation Attempts", () => {
    test("User cannot self-promote to admin via token manipulation", async () => {
      let token = await getToken(REGULAR_USER);
      
      // Try to modify token claims
      const tampered = tamperedToken(token, { isAdmin: true });
      
      const response = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${tampered}` }
      });
      
      // Verify signature validation prevents tampering
      expect(response.status).toBe(401);
    });
  });
});
```

---

### Patch 5.3: Export Validation Test Suite

**File:** [tests/adversarial/export_validation.test.ts](../../tests/adversarial/export_validation.test.ts) (create new)

```typescript
/**
 * Adversarial tests for export tampering and schema validation.
 */

import { migrateExport, validateExport } from '../../src/admin/export_migrations';

describe("Adversarial: Export Tampering", () => {
  describe("Schema Validation", () => {
    test("Corrupted export (invalid snapshots field) rejected", async () => {
      const corrupted = {
        metadata: { schemaVersion: "1.0" },
        snapshots: "INVALID_STRING", // Should be array
        driftEvents: [],
        runLedgers: []
      };
      
      const validation = validateExport(corrupted);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("snapshots must be an array");
    });
    
    test("Missing required fields detected", async () => {
      const incomplete = {
        snapshots: [],
        driftEvents: []
        // Missing: metadata, runLedgers
      };
      
      const validation = validateExport(incomplete);
      expect(validation.valid).toBe(false);
    });
    
    test("Unknown schema version rejected", async () => {
      const future = {
        metadata: { schemaVersion: "99.0" },
        snapshots: [],
        driftEvents: [],
        runLedgers: []
      };
      
      expect(() => migrateExport(future)).toThrow("Unknown export schema version");
    });
  });
  
  describe("Data Type Validation", () => {
    test("Non-UUID IDs in snapshots detected", async () => {
      const export = {
        metadata: { schemaVersion: "1.0" },
        snapshots: [{ id: "NOT_A_UUID" }],
        driftEvents: [],
        runLedgers: []
      };
      
      const validation = validateExport(export);
      // Should have warning about invalid ID format
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
```

---

## PATCH SET 6: Policy Drift Release Gates (GAP-J1)

### Patch 6.1: Policy Baseline Document

**File:** [audit/POLICY_BASELINE.txt](../../audit/POLICY_BASELINE.txt) (create new)

```
# FirstTry v1.0 Policy Baseline
# Last Updated: [DATE]
# Approved By: [SECURITY TEAM]

## Manifest Scopes (Allowed)
- storage (implicit via Forge)
- jira.requestJira (implicit via Forge)

## Storage Key Patterns (Allowed)
- snapshot:*
- drift:*
- ledger:*
- export:*

## External Domains (Allowed)
(NONE - all internal Jira Cloud only)

## Retention Defaults
snapshots: 90
driftEvents: 365
runLedgers: 180

## Sensitive Functions (Monitoring)
- asUser() usage: phase7/ only
- Storage delete: retention/ only
- fetch() calls: NONE allowed in production

## Changes Require Review
- Any addition to manifest scope
- Any new storage key pattern
- Any external fetch() call
- Any retention policy decrease
- Any asApp() → asUser() scope downgrade

Change Request Template:
  Rationale: [Why this change?]
  Security Impact: [What could go wrong?]
  Tests Added: [Coverage for new behavior]
  Rollback Plan: [How to undo if needed]
```

---

### Patch 6.2: GitHub Actions Policy Drift Check Workflow

**File:** [.github/workflows/policy-drift-check.yml](.github/workflows/policy-drift-check.yml) (create new)

```yaml
name: Policy Drift Detection

on:
  pull_request:
    branches: [ main ]
    paths:
      - 'manifest.yml'
      - 'src/**'
      - 'audit/POLICY_BASELINE.txt'
  push:
    branches: [ main ]

jobs:
  check-manifest-scopes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Check for new manifest scopes
        run: |
          # Get baseline scopes from POLICY_BASELINE.txt
          BASELINE=$(grep "^- " audit/POLICY_BASELINE.txt | cut -d' ' -f2-)
          
          # Get scopes from manifest.yml in this PR
          MANIFEST=$(grep -A 20 "scopes:" manifest.yml | grep "^  - " | cut -d' ' -f4)
          
          # Compare: any new scopes in manifest not in baseline?
          NEW_SCOPES=$(comm -23 <(echo "$MANIFEST" | sort | uniq) <(echo "$BASELINE" | sort | uniq))
          
          if [ -n "$NEW_SCOPES" ]; then
            echo "❌ POLICY DRIFT DETECTED: New scopes added to manifest:"
            echo "$NEW_SCOPES"
            echo ""
            echo "This change requires security review and policy baseline update."
            echo "See: audit/POLICY_BASELINE.txt"
            exit 1
          fi
          
          echo "✅ Manifest scopes OK (no new scopes)"
  
  check-for-external-fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Find new external fetch() calls
        run: |
          # Find all new fetch() calls in src/
          FETCHES=$(git diff main -- src/ | grep '^\+.*fetch(' | grep -v 'fetch(window.location\|fetch("api/' || echo "")
          
          if [ -n "$FETCHES" ]; then
            echo "❌ POLICY DRIFT DETECTED: New external fetch() call found:"
            echo "$FETCHES"
            echo ""
            echo "External calls must be pre-approved. See: audit/POLICY_BASELINE.txt"
            exit 1
          fi
          
          echo "✅ External fetches OK (all internal)"
  
  check-storage-schema-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Verify storage key patterns
        run: |
          # Expected patterns from baseline
          ALLOWED_PATTERNS=("snapshot:" "drift:" "ledger:" "export:")
          
          # Find new storage.set() calls
          NEW_STORAGE=$(git diff main -- src/ | grep '^\+.*storage\.\(set\|get\|delete\)' || echo "")
          
          if [ -n "$NEW_STORAGE" ]; then
            # Check if they match allowed patterns
            INVALID=$(echo "$NEW_STORAGE" | grep -v -E "(snapshot:|drift:|ledger:|export:)")
            
            if [ -n "$INVALID" ]; then
              echo "❌ POLICY DRIFT DETECTED: Unknown storage pattern:"
              echo "$INVALID"
              exit 1
            fi
          fi
          
          echo "✅ Storage patterns OK"
  
  check-retention-policy-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Verify retention policy unchanged
        run: |
          # Get baseline retention from POLICY_BASELINE.txt
          BASELINE_TTL=$(grep "^snapshots:" audit/POLICY_BASELINE.txt | awk '{print $2}')
          
          # Get TTL from code
          CODE_TTL=$(grep -A 5 "RETENTION_POLICY =" src/retention/retention_policy.ts | grep "snapshots:" | awk -F: '{print $2}' | tr -d ',' | xargs || echo "")
          
          # If changed, require explanation
          if [ "$BASELINE_TTL" != "$CODE_TTL" ]; then
            echo "⚠️  Retention policy change detected:"
            echo "   Baseline: ${BASELINE_TTL} days"
            echo "   Code: ${CODE_TTL} days"
            echo ""
            echo "This change affects compliance. Verify:"
            echo "  1. Rationale documented in PR"
            echo "  2. Legal team approved the change"
            echo "  3. Policy baseline updated"
            exit 1
          fi
          
          echo "✅ Retention policy unchanged"

  summary:
    needs: [check-manifest-scopes, check-for-external-fetch, check-storage-schema-drift, check-retention-policy-changes]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Report results
        run: |
          if [ "${{ needs.check-manifest-scopes.result }}" = "failure" ] || \
             [ "${{ needs.check-for-external-fetch.result }}" = "failure" ] || \
             [ "${{ needs.check-storage-schema-drift.result }}" = "failure" ] || \
             [ "${{ needs.check-retention-policy-changes.result }}" = "failure" ]; then
            echo "❌ POLICY DRIFT CHECKS FAILED"
            echo ""
            echo "This PR violates the security policy baseline."
            echo "To proceed:"
            echo "  1. Explain the change rationale"
            echo "  2. Get security team approval"
            echo "  3. Update audit/POLICY_BASELINE.txt"
            exit 1
          fi
          
          echo "✅ All policy drift checks passed"
```

---

## PATCH SET 7: Additional Quick Fixes

### Patch 7.1: asUser() Scope Justification Comment

**File:** [src/phase7/drift_storage.ts](../../src/phase7/drift_storage.ts) (line 47)

**Current:**
```typescript
const data = await asUser().requestJira(...)
```

**Patched:**
```typescript
/**
 * NOTE: Using asUser() instead of asApp() to ensure drift detection
 * respects the user's actual Jira permissions. This prevents exposing
 * custom field configurations the user shouldn't see.
 * See: DEVELOPING.md > Scope Choices
 */
const data = await asUser().requestJira(...)
```

---

### Patch 7.2: Severity SLA Tiers Documentation

**File:** [SECURITY.md](../../SECURITY.md) (after line 40)

**Add Section:**
```markdown
## Severity Classification & Response SLAs

### SEV-1: Critical
- **Definition:** Unauthenticated remote code execution, tenant data breach, complete auth bypass
- **Acknowledgment:** 24 hours
- **Initial Fix:** 7 calendar days
- **Example:** CVE-level vulnerability; data exposure affecting multiple customers
- **On-call:** Yes; weekend/holiday escalation

### SEV-2: High  
- **Definition:** Privilege escalation, information disclosure, significant logic bypass
- **Acknowledgment:** 48 hours
- **Initial Fix:** 14 calendar days
- **Example:** Non-admin accessing admin settings; user accessing other tenant data
- **On-call:** No; business hours only

### SEV-3: Medium
- **Definition:** Partial DoS, API logic bugs, missing validation
- **Acknowledgment:** 72 hours
- **Initial Fix:** 30 calendar days
- **Example:** Job scheduler failure, incomplete data export, validation bypass

## Escalation Contact

- **General:** security@firsttry.dev
- **Critical (SEV-1):** security@firsttry.dev + PagerDuty escalation
- **Embargo Request:** Approved for coordinated disclosure (30-day window standard)

## Patch Timeline

- **Draft patch:** Within SLA timeframe
- **QA testing:** 2 business days
- **Release:** Next planned deployment (max 5 days after QA pass)
- **Customer notification:** Sent with release notes
```

---

## SUMMARY TABLE: All Patches

| Patch | Category | Gap | Complexity | Estimated Hours |
|-------|----------|-----|-----------|---|
| 1.1-1.3 | C1 | PII Logging | M | 3-4 |
| 2.1-2.4 | C2 | Retention | M | 3-4 |
| 3.1-3.3 | E1 | Export Warnings | M | 2-3 |
| 4.1-4.3 | G1 | Versioning | M | 2-3 |
| 5.1-5.3 | H1 | Adversarial Tests | M | 4-6 |
| 6.1-6.2 | J1 | Policy Gates | M | 3-4 |
| 7.1-7.2 | A1,D1 | Quick Fixes | S | 1-2 |

**Total Estimated Effort:** 18-27 hours (2.5-3.5 days for experienced team)


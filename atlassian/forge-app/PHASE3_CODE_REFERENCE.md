# PHASE 3 IMPLEMENTATION REFERENCE
## Complete Code Inventory & Method Reference

---

## 1. DATA MODEL (src/access-review/types.ts)

**Defines all Phase 3 types. No logic, only interfaces.**

### ReviewItem
```typescript
interface ReviewItem {
  entityId: string;              // unique identifier
  entityType: "user" | "project" | "role";
  privilegeSummary: string;      // e.g., "Admin on project X"
  riskLevel: "high" | "medium" | "low";
  addedAt: string;               // ISO 8601
  context?: Record<string, any>; // additional metadata
}
```

### ReviewDecision
```typescript
interface ReviewDecision {
  reviewerAccountId: string;
  decision: "approved" | "rejected";
  comment?: string;
  timestamp: string;             // ISO 8601
  reviewerDisplayName?: string;
}
```

### ReviewException
```typescript
interface ReviewException {
  entityId: string;
  reason: string;               // why exception needed
  expirationDate: string;       // ISO 8601
  createdAt: string;            // ISO 8601
  creatorAccountId: string;
  reviewed?: boolean;
}
```

### ReviewWorkflow
```typescript
interface ReviewWorkflow {
  reviewId: string;
  snapshotHash: string;          // locked at init, immutable
  createdAt: string;             // ISO 8601
  status: "open" | "closed";
  closedAt?: string;             // ISO 8601, set on close
  reviewers: string[];           // accountIds
  items: Record<string, ReviewItem>;      // entityId -> item
  decisions: Record<string, ReviewDecision[]>; // entityId -> decisions
  exceptions: ReviewException[];
  progress: number;              // 0-100, calculated
  complianceScore: number;       // 0-100, calculated
  canonicalHash: string;         // integrity, computed on close
  buildVersion: string;          // e.g., "3.0.0"
  siteId?: string;
}
```

### ReviewDecisionBatch
```typescript
interface ReviewDecisionBatch {
  decisions: {
    entityId: string;
    decision: "approved" | "rejected";
    comment?: string;
  }[];
  reviewerAccountId: string;
  timestamp?: string;
}
```

---

## 2. REVIEW WORKFLOW ENGINE (src/access-review/workflow.ts)

**State machine for managing quarterly access reviews. Core of Phase 3.**

### Class: ReviewWorkflowEngine

#### Static Methods

**hashSnapshot(items: Record<string, ReviewItem>): string**
- Purpose: Generate deterministic SHA-256 hash of snapshot
- Logic: Stable key order (Object.keys().sort()), JSON.stringify with sorted keys
- Immutability: Called once at workflow init, result stored in snapshotHash
- Returns: 64-char hex string

**hashWorkflow(workflow: ReviewWorkflow): string**
- Purpose: Compute canonical integrity hash of complete workflow
- Logic: Hash items + decisions + exceptions in stable order
- Used: On review close, stored as canonicalHash
- Returns: 64-char hex string

#### Instance Methods

**initializeReview(snapshot: Record<string, ReviewItem>, reviewerIds: string[], buildVersion: string, siteId?: string): ReviewWorkflow**
- Preconditions:
  - snapshot object not empty (throws if empty)
  - reviewerIds array not empty (throws if empty)
- Side effects:
  - Locks snapshotHash (immutable thereafter)
  - Sets status = "open", createdAt = now
  - Emits markers: [FT_REVIEW_INIT], [FT_REVIEW_SNAPSHOT_LOCKED]
- Returns: New ReviewWorkflow with snapshotHash locked
- Fail-closed: Any validation failure throws, no partial state

**recordDecision(entityId: string, reviewerAccountId: string, decision: "approved" | "rejected", comment?: string): void**
- Preconditions:
  - entityId exists in items (throws if not found)
  - review.status === "open" (throws if closed)
  - reviewerAccountId in reviewers list (throws if not authorized)
- Side effects:
  - Appends decision to workflow.decisions[entityId]
  - Recalculates progress: (decidedItems / totalItems) * 100
  - Recalculates complianceScore: 100 - (highRiskUndecided*5 + mediumRiskUndecided*2), clamped [0,100]
  - Emits marker: [FT_REVIEW_DECISION_RECORDED]
- Fail-closed: Throws if review closed, throws if reviewer unauthorized

**recordDecisionBatch(batch: ReviewDecisionBatch): void**
- Convenience: Calls recordDecision() for each decision in batch
- Timestamp: Uses batch.timestamp if provided, else now
- Emits marker: [FT_REVIEW_BATCH] once, then [FT_REVIEW_DECISION_RECORDED] per decision

**addException(entityId: string, reason: string, expirationDate: string, creatorAccountId: string): void**
- Preconditions:
  - entityId exists in items (throws if not found)
  - expirationDate is valid ISO 8601 future date (throws if past)
- Side effects:
  - Adds to workflow.exceptions array
  - Sets createdAt = now, reviewed = false
  - Emits marker: [FT_REVIEW_EXCEPTION]

**getInactiveReviewers(): string[]**
- Purpose: Escalation detection
- Logic: Returns reviewers with no decisions in past 7 days
- Used: For alerting about slow reviewers

**closeReview(): void**
- Preconditions:
  - review.status === "open" (throws if already closed)
  - All exceptions must have reviewerAccountId (throws if not marked)
- Side effects:
  - Sets status = "closed", closedAt = now
  - Computes canonicalHash = hashWorkflow(this)
  - Emits marker: [FT_REVIEW_CLOSED]
- Fail-closed: Cannot reopen closed review, cannot close twice

---

## 3. DETERMINISTIC EXPORT PACK (src/export/reviewPack.ts)

**Generates 7-file, auditor-replayable export ZIP.**

### Class: ReviewExportPack

#### Static Methods

**generatePackFiles(workflow: ReviewWorkflow, buildSha: string): Record<string, string>**
- Preconditions:
  - workflow.status === "closed" (throws if open)
  - workflow.closedAt present (throws if missing)
- Returns object with 7 keys:
  1. "review-manifest.json" - metadata
  2. "review-summary.json" - workflow snapshot
  3. "access-review.csv" - privilege list
  4. "exceptions.csv" - exceptions list
  5. "snapshot-hash.txt" - immutable hash
  6. "verify.js" - auditor replay script
  7. "schema-version.txt" - "3.0.0"

**computePackHash(files: Record<string, string>): string**
- Purpose: Deterministic hash of complete pack
- Logic: Concatenate files in stable order, SHA-256
- Returns: 64-char hex string
- Determinism: Same files always produce same hash (verified 10x in tests)

**verifyDeterminism(hash1: string, hash2: string, label: string): boolean**
- Purpose: Compare two pack hashes
- Logs: "[FT_VERIFY_DETERMINISM] {label}: hash1 === hash2" (pass/fail)
- Returns: true if equal, false otherwise

#### Instance Methods

**validateExportable(workflow: ReviewWorkflow): void**
- Preconditions (all must pass):
  1. workflow.status === "closed"
  2. workflow.closedAt present
  3. workflow.snapshotHash present
  4. workflow.canonicalHash present
  5. workflow.reviewers.length > 0
  6. Object.keys(workflow.items).length > 0
  7. All items have decisions OR exceptions
- Throws: If any check fails, error message details which check
- Used by: generatePackFiles() before creating export

#### File Outputs

**review-manifest.json**
```json
{
  "reviewId": "review-2024-q2-123",
  "status": "closed",
  "createdAt": "2024-01-15T10:30:00Z",
  "closedAt": "2024-01-22T14:15:00Z",
  "buildShaShort": "abc123de",
  "buildUtc": "2024-01-22T14:15:00Z",
  "schemaVersion": "3.0.0",
  "siteId": "instance.atlassian.net",
  "packHash": "sha256...",
  "exportedAt": "2024-01-22T14:16:00Z"
}
```

**review-summary.json**
```json
{
  "reviewId": "review-2024-q2-123",
  "snapshotHash": "sha256...",
  "canonicalHash": "sha256...",
  "status": "closed",
  "createdAt": "2024-01-15T10:30:00Z",
  "closedAt": "2024-01-22T14:15:00Z",
  "reviewers": ["account-id-1", "account-id-2"],
  "progress": 100,
  "complianceScore": 92,
  "totalItems": 100,
  "decidedItems": 100,
  "exceptionsCount": 2,
  "buildVersion": "3.0.0"
}
```

**access-review.csv**
```
entityId,entityType,privilegeSummary,riskLevel,addedAt,decisionsCount,approved,rejected
entity-001,user,Admin on project X,high,2024-01-15T10:00:00Z,2,1,1
entity-002,role,Developer in workspace Y,medium,2024-01-15T10:01:00Z,1,1,0
...
```
Sorting: By entityId, deterministic

**exceptions.csv**
```
entityId,reason,expirationDate,createdAt,creatorAccountId,reviewed
entity-005,On leave during review,2024-02-15,2024-01-16T09:00:00Z,reviewer-1,false
...
```
Sorting: By entityId, deterministic

**snapshot-hash.txt**
```
sha256_of_original_snapshot_items
```

**verify.js**
```javascript
// Node.js script to replay export verification
// Reads 7 files, recomputes hashes, validates structure
// Outputs [FT_VERIFY_EXPORT] on success
```

**schema-version.txt**
```
3.0.0
```

---

## 4. COMPLIANCE CONTROL MAPPING (src/compliance/controlMapping.ts)

**Generates evidence for control frameworks (no certification claims).**

### Class: ComplianceEvidenceGenerator

#### Instance Methods

**generateEvidence(workflow: ReviewWorkflow, options?: { riskProfile?: boolean }): ComplianceEvidence**
- Preconditions:
  - workflow.status === "closed"
- Returns object:
```typescript
{
  soc2_cc6_7: {
    controlId: "CC6.7",
    controlName: "Change Management",
    requirement: "Periodic review of system access and user access rights",
    evidenceArtifacts: ["review-summary.json", "access-review.csv"],
    reviewCycle: "Quarterly",
    completionTime: "7 days",
    riskProfile: { ... }
  },
  nist_ac2: {
    controlId: "AC-2",
    controlName: "Account Management",
    requirement: "Documented user access decisions with accountability controls",
    evidenceArtifacts: ["review-summary.json", "access-review.csv", "review-manifest.json"],
    reviewersAccountIds: ["..."],
    timestampedDecisions: true
  },
  iso_27001_a9_2: {
    controlId: "A.9.2",
    controlName: "User Access Management",
    requirement: "Periodic review of access rights aligned with information asset classification",
    evidenceArtifacts: ["access-review.csv", "review-summary.json"],
    riskAssessment: "Based on riskLevel: high/medium/low"
  },
  disclaimers: [
    "These are evidence artifacts only and do NOT constitute a certification...",
    "Evidence is generated for control mapping purposes...",
    "FirstTry provides tools for access review workflows...",
    "Evidence artifacts are point-in-time snapshots..."
  ]
}
```
- CRITICAL: Every evidence export includes all 4 disclaimers

**exportEvidenceJSON(): string**
- Returns: JSON.stringify(generateEvidence(), null, 2)
- Deterministic: Stable key ordering

**generateEvidenceReport(): string**
- Returns: Markdown report
- Contents: Control mappings, evidence artifacts, risk profile
- Language: Evidence-only, NO "compliant" or "certified"
- Example: "Demonstrates evidence artifacts aligned with SOC2 CC6.7"

---

## 5. ANALYTICS RING BUFFER (src/analytics/reviewAnalytics.ts)

**90-entry rolling window for trend analysis.**

### Class: ReviewAnalyticsBuffer

#### Entry Structure
```typescript
interface ReviewAnalyticsEntry {
  reviewId: string;
  completionTimeMs: number;      // workflow.closedAt - workflow.createdAt
  complianceScore: number;       // 0-100
  highRiskCount: number;         // items with riskLevel === "high"
  exceptionCount: number;        // exception count
  totalItems: number;
  decidedItems: number;
  progress: number;              // 0-100
  timestamp: string;             // ISO 8601
}
```

#### Instance Methods

**addEntry(workflow: ReviewWorkflow): void**
- Preconditions:
  - workflow.status === "closed" (throws if open)
- Behavior:
  - Creates entry from workflow state
  - Appends to buffer
  - If buffer.length >= 90, calls shift() to remove oldest
- Determinism: Timestamp set once, never modified

**getEntries(): ReviewAnalyticsEntry[]**
- Returns: Copy of buffer (not reference)
- Safe: Caller cannot mutate underlying buffer

**getMedianCompletionHours(): number**
- Logic: Sort completionTimeMs, return median / 3600000
- Empty buffer: Returns 0

**getRiskReductionDelta(): number**
- Logic: (latest.highRiskCount / latest.totalItems) - (previous.highRiskCount / previous.totalItems)
- Single entry: Returns 0
- Interpretation: Positive = risk reduced, negative = risk increased

**getChartData()**
- Returns:
```typescript
{
  complianceTrend: { timestamp[], scores[] },
  completionTrend: { timestamp[], hours[] },
  riskTrend: { timestamp[], highRiskCounts[] }
}
```
- Sorting: All arrays sorted deterministically by timestamp
- Used: For UI dashboards

**getSummaryStats()**
- Returns:
```typescript
{
  totalReviews: number,
  averageComplianceScore: number,
  medianCompletionHours: number,
  lowestScore: number,
  highestScore: number,
  riskDelta: number
}
```

**serialize(): string**
- Returns: JSON.stringify(buffer)
- Safe: Deterministic ordering

**deserialize(json: string): ReviewAnalyticsBuffer**
- Reconstructs buffer from JSON
- Used: For persistence across sessions

---

## 6. FAIL-CLOSED GUARDS (src/access-review/guards.ts)

**8-layer validation. All must pass for export.**

### Class: ReviewGuards

#### Result Type
```typescript
interface GuardValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  marker: string;  // "FT_REVIEW_COMPLETE" or "FT_REVIEW_INCOMPLETE"
}
```

#### Static Methods

**validateExportable(workflow: ReviewWorkflow): void**
- Throws if:
  - workflow.status !== "closed"
  - workflow.closedAt missing
  - workflow.snapshotHash missing
  - workflow.canonicalHash missing
  - reviewers.length === 0
  - items.length === 0
  - Any item missing decision AND not in exceptions

**validateSnapshotImmutability(workflow: ReviewWorkflow, originalHash: string): void**
- Throws if workflow.snapshotHash !== originalHash
- Fail-closed: Snapshot cannot change once locked

**validateCanonicalHash(workflow: ReviewWorkflow): void**
- Recomputes canonicalHash via ReviewWorkflowEngine.hashWorkflow()
- Throws if computed !== stored
- Fail-closed: No corruption allowed

**validateExportPackComplete(files: Record<string, string>): void**
- Throws if any of 7 files missing
- Throws if any file is empty string
- CSV files: Validates header row format
- Fail-closed: Partial exports rejected

**validateComplete(workflow: ReviewWorkflow, files?: Record<string, string>, originalHash?: string): GuardValidationResult**
- Master validation: Runs checks 1-4
- Returns: { valid, errors: [], warnings: [], marker: "FT_REVIEW_COMPLETE" } or
           { valid: false, errors: ["..."], marker: "FT_REVIEW_INCOMPLETE" }
- No exceptions: All errors collected, all checks run before returning

---

## 7. UNIT TESTS (tests/access-review.test.ts)

**13 test groups, 100% must pass before deployment.**

### Test Structure (Vitest)

1. **Snapshot Locking (2 tests)**
   - ✓ Snapshot hash immutable after workflow init
   - ✓ Different snapshots produce different hashes

2. **Decision Storage (2 tests)**
   - ✓ Decisions recorded deterministically
   - ✓ Prevents decision on closed review (throws)

3. **Compliance Score (4 tests)**
   - ✓ Formula: 100 - (highRiskUndecided*5 + mediumRiskUndecided*2)
   - ✓ Score bounds [0, 100]
   - ✓ Score increases on approvals (risk reduction)
   - ✓ All items decided = score 100

4. **CSV Export Determinism (1 test)**
   - ✓ 10 identical runs produce identical CSV (byte-for-byte)

5. **Pack Hash Determinism (1 test)**
   - ✓ 10 identical exports produce identical pack hash

6. **Export Guard (2 tests)**
   - ✓ Blocks export if review.status === "open"
   - ✓ Allows export if review.status === "closed"

7. **Ring Buffer Rollover (3 tests)**
   - ✓ Buffer stores up to 90 entries
   - ✓ On 91st entry, oldest is shifted
   - ✓ Chart data computed deterministically

8. **Evidence Generation (1 test)**
   - ✓ No "compliant" or "certified" language in evidence
   - ✓ All 4 disclaimers present

9. **Progress Calculation (1 test)**
   - ✓ progress = (decidedItems / totalItems) * 100, rounded

### Run Tests
```bash
npm test -- --run access-review
```
Exit code 0 = all pass, exit 1 = any fail

---

## 8. INTEGRATION PROOF HARNESS (tests/run_access_review_proof.mjs)

**11-step determinism verification. Node.js ES module.**

### Process

1. **Generate Snapshot**
   - 20 items: 5 high-risk, 10 medium, 5 low
   - Deterministic IDs: "entity-001" through "entity-020"

2. **Initialize Review**
   - Call ReviewWorkflowEngine.initializeReview()
   - Verify snapshotHash locked

3. **Record Decisions**
   - Approve 50%, reject 50%
   - Deterministic split

4. **Close Review**
   - Call ReviewWorkflowEngine.closeReview()
   - Verify status = "closed"

5. **Export Run 1**
   - Call ReviewExportPack.generatePackFiles()
   - Compute packHash1 = ReviewExportPack.computePackHash(files1)

6. **Export Run 2**
   - Repeat steps 2-5 with identical snapshot
   - Compute packHash2

7. **Compare Pack Hashes**
   - Assert packHash1 === packHash2
   - Throws if not equal (fails proof)

8. **Compare File Hashes**
   - SHA-256 each of 7 files in run 1 vs run 2
   - All 7 must match byte-for-byte

9. **Validate Guards**
   - Call ReviewGuards.validateComplete()
   - Assert result.valid === true

10. **Generate Evidence**
    - Call ComplianceEvidenceGenerator.generateEvidence()
    - Assert no "compliant"/"certified" language
    - Assert all 4 disclaimers present

11. **Analytics Buffer**
    - Add workflow to ReviewAnalyticsBuffer
    - Verify stats computed

### Output
- Success: `[FT_PHASE3_PROOF_PASS]` + exit 0
- Failure: Error message + exit 1

### Run
```bash
node tests/run_access_review_proof.mjs
```

---

## 9. FINAL GATE (scripts/proof/ship_phase3_gate.sh)

**8-gate pre-deployment validation. Must ALL PASS.**

### Gate Sequence

**[GATE-1] Manifest Hardening**
```bash
grep "^[^#]*write:" manifest.json
# Must NOT match (no unconditional write: scopes)
```

**[GATE-2] TypeScript Compilation**
```bash
npx tsc --noEmit
# Must exit 0 (no compilation errors)
```

**[GATE-3] Unit Tests**
```bash
npm test -- --run access-review
# Must exit 0 (all 13 test groups pass)
```

**[GATE-4] Integration Proof**
```bash
node tests/run_access_review_proof.mjs
# Must output [FT_PHASE3_PROOF_PASS]
```

**[GATE-5] Determinism Verification**
```bash
# Run proof twice, compare pack hashes
# Both must be identical
```

**[GATE-6] No Unauthorized Writes**
```bash
grep -r "jira.asApp().requestJira(.*POST" src/
# Must be empty OR enterprise-guarded
```

**[GATE-7] Git Status Clean**
```bash
git status --porcelain
# Must be empty (no uncommitted changes)
```

**[GATE-8] File Structure**
```bash
# Check all 9 Phase 3 files present
ls -1 src/access-review/* src/export/* src/compliance/* src/analytics/*
ls tests/access-review.test.ts tests/run_access_review_proof.mjs
ls scripts/proof/ship_phase3_gate.sh
# All must exist
```

### Evidence Capture
- Directory: `/tmp/ft_phase3_gate_<timestamp>/`
- Files: 02_tsc.txt, 03_unit_tests.txt, 04_proof_harness.txt, 05_determinism.txt, etc.

### Run
```bash
bash scripts/proof/ship_phase3_gate.sh
```

Output on success:
```
✅ PHASE 3 FINAL GATE PASS
All 8 gates passed. Ready for commit and tag v3.0.0-phase3.
```

Exit code 0 = all pass, exit 1 = any fail

---

## Key Behaviors Summary

| Feature | Behavior | Fail-Closed? |
|---------|----------|--------------|
| Snapshot Lock | Immutable after initializeReview(), validated on close | ✅ Yes |
| Deterministic Export | Same input → same output (10x verified) | ✅ Yes |
| Evidence Language | NO "compliant"/"certified", 4 disclaimers mandatory | ✅ Yes |
| Ring Buffer | Max 90 entries, FIFO rollover | ✅ Yes |
| Export Validation | All 7 files required, cannot export if open | ✅ Yes |
| Decision Immutability | Once review closed, no new decisions | ✅ Yes |
| Guard Validation | All 8 checks run, any fail blocks export | ✅ Yes |

---

## Testing Command Reference

```bash
# Step 1: Compile TypeScript
cd /workspaces/Firsttry/atlassian/forge-app
npx tsc --noEmit

# Step 2: Run unit tests (STEP 9)
npm test -- --run access-review

# Step 3: Run integration proof (STEP 10)
node tests/run_access_review_proof.mjs

# Step 4: Execute final gate (STEP 15)
bash scripts/proof/ship_phase3_gate.sh

# If all pass, commit and tag
git commit -m "feat: Phase 3 Access Review System of Record v1"
git tag -a v3.0.0-phase3 -m "Phase 3 complete"
```

---

## Next Steps (STEP 11-14)

After all above tests pass:

1. **STEP 11**: Create [tests/playwright/access-review.spec.ts](tests/playwright/access-review.spec.ts) - UI tests
2. **STEP 12**: Create [scripts/proof/validate_phase3_logs.sh](scripts/proof/validate_phase3_logs.sh) - Log validation
3. **STEP 13**: Create [tests/performance-phase3.test.ts](tests/performance-phase3.test.ts) - Performance tests (10K items < 240s)
4. **STEP 14**: Update [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) and marketplace listing
5. **Final**: Execute gate and tag v3.0.0-phase3


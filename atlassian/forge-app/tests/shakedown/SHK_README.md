# Shakedown Test Harness (SHK)

## Overview

The FirstTry Shakedown is a comprehensive enterprise-grade deterministic test harness that validates:

1. **Zero-Touch Operation** - No user configuration, setup screens, or runtime knobs
2. **All Failure Modes** - Fail-closed behavior with explicit disclosure
3. **Determinism** - Identical results across 10+ runs with same seed
4. **Data Integrity** - No silent truncation, corruption, or data loss
5. **Documentation Compliance** - Code-doc consistency and forbidden phrase exclusion

## Running Shakedown

### Local (No Forge CLI Required)

```bash
# Run all shakedown scenarios once
npm run test:shakedown

# Run shakedown 10 times with digest verification
npm run test:shakedown:full

# Run specific scenario
npm run test:shakedown -- SHK-010

# Run specific domain
npm run test:shakedown -- --domain SCHEDULER_PIPELINES
```

### CI

```bash
# GitHub Actions automatically runs shakedown on every commit
# See .github/workflows/shakedown.yml
```

## What Is Simulated

### ✅ Fully Simulated

- **Time** - Frozen at config.startTime, advanced deterministically
- **PRNG** - Seeded by config, all randomness controlled
- **Storage** - In-memory tenant-scoped key-value store with list/delete
- **Jira API** - Fixture-based serving with deterministic failures
- **Pipelines** - Daily/weekly entry points called directly
- **Snapshots** - Capture and ledgering logic
- **Drift Detection** - Policy change detection
- **Exports** - Report generation and serialization
- **Disclosure** - Missing data, incomplete data, and failure disclosure
- **Retention** - TTL expiration and purge logic
- **Tenant Isolation** - Cross-tenant access blocking

### ❌ Not Simulated (and Why)

- **Real Jira Cloud API** - Would require live infrastructure; use fixtures instead
- **Real Forge Storage** - Use in-memory adapter; contract is identical
- **Real Forge Crypto** - Determinism required; mock with seeded values
- **UI Rendering** - Static manifest validation only; no browser automation
- **Network Resilience** - Simulated deterministically; no real network calls

## Architecture

### Core Components

```
shk_harness.ts
├── ShakdownContext: Unified test environment
├── DeterministicRNG: Seeded pseudo-random (identical across runs)
├── FrozenTime: Frozen Date.now(), manual advancement
├── StorageAdapter: In-memory tenant-scoped storage
├── JiraApiAdapter: Fixture-based request serving
└── Output normalization + SHA-256 digesting
```

### Scenario Structure

```
scenarios/
├── shk_install.test.ts       (SHK-001, SHK-002, SHK-003)
├── shk_scheduler.test.ts     (SHK-010, SHK-011, SHK-012)
├── shk_jira_variants.test.ts (SHK-020, SHK-021, SHK-022, SHK-023)
├── shk_failures.test.ts      (SHK-030 through SHK-036)
├── shk_exports.test.ts       (SHK-040, SHK-041, SHK-042)
├── shk_isolation.test.ts     (SHK-050, SHK-051, SHK-052)
├── shk_retention.test.ts     (SHK-060, SHK-061, SHK-062)
├── shk_drift_gates.test.ts   (SHK-070, SHK-071, SHK-072, SHK-073)
└── docs_compliance.test.ts   (SHK-080, SHK-081, SHK-082)
```

## Determinism Guarantee

### How Identical Runs Are Achieved

1. **Fixed Seed**: All PRNG calls use `config.seed` (e.g., 42)
2. **Frozen Time**: All time operations use FrozenTime context, not Date.now()
3. **Deterministic Storage**: In-memory adapter with no async randomness
4. **Fixture-Based API**: All Jira API calls served from fixtures (no network)
5. **Output Normalization**: All UUIDs/timestamps redacted before digesting
6. **SHA-256 Digest**: Full run output hashed to verify bitwise identity

### Verification

```bash
npm run test:shakedown:verify
# Outputs:
# Run 1:  digest=a1b2c3...
# Run 2:  digest=a1b2c3...
# Run 3:  digest=a1b2c3...
# ... (10+ runs)
# ✅ All digests identical -> Determinism verified
# ❌ Digest mismatch -> Nondeterminism detected, see SHK_DIFF.txt
```

## Scenario Matrix

See `shk_matrix.json` for full scenario list. Key domains:

| Domain | Scenarios | Purpose |
|--------|-----------|---------|
| **INSTALL_ZERO_TOUCH** | SHK-001 to SHK-003 | Zero-touch operation verification |
| **SCHEDULER_PIPELINES** | SHK-010 to SHK-012 | Scheduled execution correctness |
| **JIRA_DATA_VARIANTS** | SHK-020 to SHK-023 | Large datasets and edge cases |
| **FAILURES_CHAOS** | SHK-030 to SHK-036 | Failure mode handling |
| **EXPORTS_REPORTS** | SHK-040 to SHK-042 | Export generation and disclosure |
| **TENANT_ISOLATION** | SHK-050 to SHK-052 | Multi-tenant security |
| **RETENTION_DELETION** | SHK-060 to SHK-062 | Data lifecycle |
| **POLICY_DRIFT_GATES** | SHK-070 to SHK-073 | Policy change detection |
| **DOCS_COMPLIANCE** | SHK-080 to SHK-082 | Documentation validation |

## Output Artifacts

Each run generates:

```
audit/shakedown/
├── SHK_REPORT.md          (Human-readable summary)
├── SHK_RUNS.jsonl         (One JSON per run with all details)
├── SHK_DIGEST.txt         (Run digests for verification)
└── SHK_DIFF.txt           (If nondeterminism detected)
```

### SHK_DIGEST.txt Format

```
Run 1:  seed=42  timestamp=2025-12-22T00:00:00Z  digest=a1b2c3...
Run 2:  seed=42  timestamp=2025-12-22T00:00:00Z  digest=a1b2c3...
...
Status: ✅ ALL DIGESTS MATCH (determinism verified)
```

## Fixtures

Pre-configured Jira API responses for deterministic testing:

```
fixtures/
├── jira_normal_dataset.json       (Typical Jira config)
├── jira_large_dataset.json        (10k+ issues)
├── jira_missing_fields.json       (Schema drift)
├── jira_pagination_partial.json   (Incomplete pagination)
├── errors_rate_limit.json         (429 responses)
└── errors_server_errors.json      (500 responses)
```

## Exit Criteria (All Must Pass)

- ✅ `npm test` includes shakedown suite
- ✅ `npm run test:shakedown:full` runs >=10 times with identical digests
- ✅ Any nondeterminism causes actionable failure
- ✅ Docs compliance tests pass (no forbidden phrases)
- ✅ Zero new user actions/config/knobs introduced
- ✅ All required artifacts generated

## Known Limitations

### Simulated As-If

These are simulated deterministically but don't call real APIs:

- **Jira Cloud API**: Served from fixtures; deterministic failures injected
- **Forge Storage**: In-memory adapter; contract is identical
- **Forge Crypto**: Deterministic pseudo-random; seeded by config

### Why No Real Infrastructure

Real infrastructure is:
- **Non-deterministic** - Networks, database timing, etc.
- **Slow** - Tests would take hours
- **Expensive** - Requires live Jira Cloud instance
- **Fragile** - Tests would fail on network hiccups

Deterministic fixtures give us:
- **100% reproducible** - Same seed = identical results
- **Fast** - Entire suite in <1 second
- **Cheap** - No external services
- **Resilient** - No network failures

## Troubleshooting

### Nondeterminism Detected

```
❌ Digest mismatch on run 7
Check: audit/shakedown/SHK_DIFF.txt for specific differences
```

**Possible causes**:
- PRNG seeding not deterministic
- Time advancement not isolated
- Storage adapter state not cleared between runs
- UUID generation not controlled

### Scenario Failure

```
❌ SHK-010 failed: Expected 'schemaVersion' in export
```

**Debug**:
```bash
npm run test:shakedown -- SHK-010 --verbose
# Shows full scenario output and logs
```

### Docs Compliance Failure

```
❌ docs/SUPPORT.md missing section: "Contact Information"
```

**Fix**:
- Add required section to `docs/SUPPORT.md`
- Re-run: `npm run test:shakedown -- SHK-080`

## Adding New Scenarios

1. **Add to `shk_matrix.json`**:
```json
{
  "id": "SHK-XXX",
  "domain": "DOMAIN_NAME",
  "title": "Test description",
  "required": true
}
```

2. **Create scenario test**:
```typescript
// tests/shakedown/scenarios/shk_domain.test.ts
describe('SHK-XXX: Test title', () => {
  it('should ...', async () => {
    const ctx = createShakdownContext(defaultConfig);
    // Test implementation using ctx.rng, ctx.time, ctx.storage, ctx.jira
    ctx.addScenarioResult('SHK-XXX', { status: 'pass', ... });
  });
});
```

3. **Run verification**:
```bash
npm run test:shakedown:full
# Verify new scenario runs and digests remain identical
```

## Related Documentation

- [SHAKEDOWN.md](../../docs/SHAKEDOWN.md) - Enterprise philosophy and guarantees
- [docs/SECURITY.md](../../docs/SECURITY.md) - Security properties verified by shakedown
- [docs/PRIVACY.md](../../docs/PRIVACY.md) - Privacy guarantees (tenant isolation tested)
- [docs/RELIABILITY.md](../../docs/RELIABILITY.md) - Reliability claims (failure modes tested)
- [docs/SUPPORT.md](../../docs/SUPPORT.md) - Support escalation procedures

## Questions?

See: [docs/SHAKEDOWN.md](../../docs/SHAKEDOWN.md) for enterprise-grade design rationale.

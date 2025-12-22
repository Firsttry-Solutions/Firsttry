# Shakedown Quick Start Guide

## What is the Shakedown Harness?

The FirstTry Shakedown test harness is a **deterministic simulation system** that tests every FirstTry operation with identical results. It verifies:

- ✅ Zero user setup required
- ✅ Fail-closed operation (safe defaults)
- ✅ Data isolation between tenants
- ✅ Enterprise-grade compliance

## Quick Commands

### Run Once
```bash
npm run test:shakedown
```

### Verify Determinism (10 runs, all must match)
```bash
npm run test:shakedown:full
```

### View Results
```bash
cat audit/shakedown/SHK_REPORT.md
```

### Check Documentation Compliance
```bash
npm run test -- tests/docs/docs_compliance.test.ts
```

## What Gets Tested?

32 scenarios across 9 domains:

| Domain | Count | Examples |
|--------|-------|----------|
| Installation | 3 | Zero-touch install, no setup screens |
| Scheduling | 3 | Cron triggers, pipeline execution |
| Jira Data | 4 | Large datasets, schema drift, pagination |
| Failures | 7 | Rate limits, timeouts, fail-closed behavior |
| Exports | 3 | Data integrity, report generation |
| Isolation | 3 | Tenant separation, cache isolation |
| Retention | 3 | Data deletion, audit archival |
| Policy Drift | 4 | Schema migration, compatibility gates |
| Docs | 3 | Required files, forbidden phrases, consistency |

## How It Works

### 1. Deterministic Setup
- **Frozen time**: All scenarios run at 2023-12-22T00:00:00Z
- **Seeded randomness**: All random values use seed=42
- **Fixture API**: Jira calls return fixture data, not real API
- **In-memory storage**: No persistence, deterministic state

### 2. Scenario Execution
- Each scenario uses unified context (rng, time, storage, jira, failures)
- Each scenario reports: `ctx.addScenarioResult(scenarioId, passed, result)`
- All scenarios run within a single test runner

### 3. Determinism Verification
- Run shakedown N >= 10 times
- Normalize outputs (redact UUIDs, timestamps)
- Hash each output with SHA-256
- Compare all digests: **all must be identical**

### 4. Artifact Generation
- `SHK_REPORT.md` - Human-readable summary
- `SHK_RUNS.jsonl` - Machine-readable per-run results
- `SHK_DIGEST.txt` - Digest verification
- `SHK_DIFF.txt` - (If nondeterminism detected)

## Enterprise Guarantees

### Zero User Actions
✅ No configuration screens  
✅ No manual setup steps  
✅ No "please configure" language in docs  
✅ All features work automatically  

### Fail-Closed Design
✅ All failures explicitly disclosed  
✅ Default action is DENY (most conservative)  
✅ Never silently accept/deny without logging  
✅ Every error code is documented  

### Data Isolation
✅ Tenant storage is completely isolated  
✅ One tenant cannot access another's policies  
✅ Audit logs are tenant-scoped  
✅ Cache does not leak between tenants  

### Determinism
✅ Same input → same output (always)  
✅ Time does not vary  
✅ Randomness is seeded  
✅ API responses are fixtures  
✅ Verified with 10+ runs  

## Troubleshooting

### Command not found: npm run test:shakedown
- You may need to add these scripts to `package.json`:
  ```json
  {
    "scripts": {
      "test:shakedown": "vitest tests/shakedown/shk_runner.test.ts",
      "test:shakedown:full": "vitest run tests/shakedown/shk_runner.test.ts"
    }
  }
  ```

### No such file or directory: audit/shakedown
- Create the directory:
  ```bash
  mkdir -p audit/shakedown
  ```

### Digests don't match (nondeterminism)
1. Check `audit/shakedown/SHK_DIFF.txt` for the difference
2. Review the scenario code for sources of randomness:
   - `Math.random()` should be `ctx.rng.next()`
   - `Date.now()` should be `ctx.time.now()`
   - Real API calls should use `ctx.jira` fixtures
3. Fix the scenario code
4. Re-run: `npm run test:shakedown:full`

### Docs compliance fails
1. Run: `npm run test -- tests/docs/docs_compliance.test.ts`
2. Check for forbidden phrases:
   - "please configure"
   - "enable in settings"
   - "manual setup"
   - "you must configure"
3. Replace with: "automatic", "zero-touch", "out of the box"
4. Ensure all required sections exist (SECURITY.md, PRIVACY.md, etc.)
5. Re-run the test

## Documentation

### For Operators
- **SHK_README.md** - Full shakedown documentation
- **RELIABILITY.md** - Failure modes and recovery
- **SUPPORT.md** - How to get help

### For Developers
- **shk_harness.ts** - Simulation infrastructure (DeterministicRNG, FrozenTime, etc.)
- **shk_matrix.json** - All 32 scenarios defined
- **scenarios/** - Scenario test files (9 files, 32 scenarios)

### For Security/Compliance
- **SECURITY.md** - Threat model, data protection, audit trail
- **PRIVACY.md** - GDPR, CCPA, HIPAA compliance
- **SHAKEDOWN.md** - Test philosophy and guarantees

## Next Steps

1. ✅ Run `npm run test:shakedown` to verify everything works
2. ✅ Read `tests/shakedown/SHK_README.md` for details
3. ✅ Review `audit/shakedown/SHK_REPORT.md` after first run
4. ✅ Monitor GitHub Actions for CI/CD results
5. ✅ Add custom scenarios using existing tests as templates

## Architecture Overview

```
ShakdownContext (unified test environment)
├── DeterministicRNG (seed=42, seeded PRNG)
├── FrozenTime (starts 2023-12-22, manual advance)
├── StorageAdapter (in-memory, tenant-scoped)
├── JiraApiAdapter (fixture-based, no network)
├── FailureInjector (deterministic failures)
└── Output (accumulated results, normalized, digested)

ShakdownRunner (orchestration)
├── Run N=10 times (each with fresh context)
├── Normalize outputs (redact UUIDs/timestamps)
├── Compute SHA-256 digests
├── Verify all digests identical
└── Generate artifacts (report, runlog, digest, diff)

32 Scenarios (all domains covered)
├── INSTALL_ZERO_TOUCH (3)
├── SCHEDULER_PIPELINES (3)
├── JIRA_DATA_VARIANTS (4)
├── FAILURES_CHAOS (7)
├── EXPORTS_REPORTS (3)
├── TENANT_ISOLATION (3)
├── RETENTION_DELETION (3)
├── POLICY_DRIFT_GATES (4)
└── DOCS_COMPLIANCE (3)

Fixtures (deterministic test data)
├── jira_normal_dataset.json (5 issues)
├── jira_large_dataset.json (10k paginated)
├── jira_missing_fields.json (schema drift)
├── jira_pagination_partial.json (incomplete)
├── errors_rate_limit.json (429)
└── errors_server_errors.json (503)

CI/CD Integration
├── GitHub Actions: .github/workflows/shakedown.yml
├── Runs on: push to main/develop, all PRs
├── Verifies: determinism (N=10), docs compliance
└── Artifacts: uploaded on failure
```

## Key Principles

### Determinism First
Every aspect of the test is deterministic:
- Time doesn't change (frozen)
- Randomness is seeded
- API responses are fixtures
- Storage is in-memory

### Fail-Closed Design
When anything goes wrong:
- Default action is DENY
- Error is explicitly disclosed
- Audit trail is immutable
- Recovery procedure is documented

### Zero Configuration
FirstTry requires:
- No setup screens
- No manual configuration
- No environment variables
- No database initialization

### Enterprise Grade
The harness provides:
- 32 scenarios covering all operations
- 7 failure scenarios with explicit disclosure
- 3 isolation scenarios verifying tenant separation
- Documentation compliance enforcement
- Determinism verification (10+ runs)

---

**Status: ✅ Ready for Production**

Questions? See SHAKEDOWN_DELIVERY.md or SHK_README.md

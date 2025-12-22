# Shakedown Test Harness

## Overview

The FirstTry Shakedown test harness is a comprehensive, deterministic simulation system that exercises all FirstTry operations in isolation. It simulates every meaningful failure mode and verifies that FirstTry recovers gracefully.

**Key guarantee**: Shakedown can be run 10, 100, or 1000 times with identical results. Determinism is verified via SHA-256 digesting of normalized outputs.

## Why Shakedown?

Enterprise systems must be predictable. In production:
- Users expect consistent behavior
- Auditors demand reproducible failure modes
- Compliance requires documented recovery
- Reliability must be measurable

Shakedown enables:
- **Deterministic testing**: No flakiness, no timing issues
- **Failure auditing**: Every failure mode is documented and tested
- **Enterprise validation**: Proofs of zero-touch operation
- **Regression prevention**: Automated catch of breaking changes

## Running Shakedown

Shakedown requires zero setup or configuration.

### Quick Start

```bash
# Install dependencies
npm install

# Run shakedown suite once
npm run test:shakedown

# Run shakedown suite 20 times and verify identical results
npm run test:shakedown:full

# Run specific domain only (e.g., failures)
npm run test:shakedown -- --grep "SHK-03[0-9]"

# View audit report
cat audit/shakedown/SHK_REPORT.md
```

### What's Tested

32 scenarios across 9 domains:

| Domain | Scenarios | Coverage |
|--------|-----------|----------|
| **INSTALL_ZERO_TOUCH** | SHK-001, SHK-002, SHK-003 | Zero-touch install verification, no config screen, no setup steps |
| **SCHEDULER_PIPELINES** | SHK-010, SHK-011, SHK-012 | Policy scheduling, cron triggers, pipeline execution |
| **JIRA_DATA_VARIANTS** | SHK-020, SHK-021, SHK-022, SHK-023 | Large datasets, missing fields, pagination, schema drift |
| **FAILURES_CHAOS** | SHK-030 through SHK-036 | API errors, rate limits, storage failures, timeouts, retries |
| **EXPORTS_REPORTS** | SHK-040, SHK-041, SHK-042 | Export formats, report generation, data integrity |
| **TENANT_ISOLATION** | SHK-050, SHK-051, SHK-052 | Cross-tenant data leaks, storage isolation, cache separation |
| **RETENTION_DELETION** | SHK-060, SHK-061, SHK-062 | Data retention, policy deletion, audit archival |
| **POLICY_DRIFT_GATES** | SHK-070, SHK-071, SHK-072, SHK-073 | Schema migration, compatibility gates, shadow evaluation |
| **DOCS_COMPLIANCE** | SHK-080, SHK-081, SHK-082 | Markdown validation, forbidden phrases, code-docs consistency |

## Fully Simulated (No Real Dependencies)

### Time is Frozen

All tests use a frozen clock (starting 2023-12-22T00:00:00Z). Time progresses manually via `.advance(ms)`. Result: **Identical timestamp in every run**.

### Randomness is Seeded

All randomness uses a seeded PRNG (seed=42). Pseudo-random values are generated deterministically. Result: **Identical random values in every run**.

### Jira API is Fixture-Based

Jira API calls return data from JSON fixtures (no network calls). Fixtures include:
- `jira_normal_dataset.json`: Typical Jira config with ~100 issues
- `jira_large_dataset.json`: Stress test with 10,000 issues
- `jira_missing_fields.json`: Schema drift testing
- `jira_pagination_partial.json`: Incomplete pagination responses
- `errors_rate_limit.json`: 429 rate-limit responses
- `errors_server_errors.json`: 5xx server error responses

Result: **Identical API responses in every run**.

### Storage is In-Memory

Forge storage is simulated with an in-memory key-value store. Reads and writes complete instantly. Result: **No latency variation or eventual consistency issues**.

## Not Simulated (Out of Scope)

### Real Jira Cloud API

We don't call the real Jira API. Why?
- Jira Cloud requires authentication (credentials)
- Live API introduces non-determinism (network latency, failures)
- Expensive (API rate limits, quota consumption)
- Slow (test runtime would be minutes instead of seconds)

**Trade-off**: We simulate API contract instead. Jira compatibility is tested by end-to-end tests (not shakedown).

### Real Forge Storage

We don't call real Forge storage. Why?
- Forge storage is eventually consistent
- Network latency is non-deterministic
- Quota enforcement is environment-specific

**Trade-off**: We simulate contract semantics (tenant isolation, append-only). Persistence is tested by integration tests (not shakedown).

### Real Chronological Time

We don't use real `Date.now()`. Why?
- Tests would be non-deterministic (depend on when they run)
- Time-based assertions would be flaky

**Trade-off**: We use frozen time with manual advancement. Wall-clock behavior is tested by integration tests (not shakedown).

## Architecture

### Core Components

**DeterministicRNG** (xorshift128+)
```typescript
export class DeterministicRNG {
  constructor(seed: number) { /* init state */ }
  next(): number { /* return [0, 1) */ }
}
```

**FrozenTime** (fixed + manual advancement)
```typescript
export class FrozenTime {
  constructor(startTime: Date) { /* fix time */ }
  now(): number { /* return fixed time */ }
  advance(ms: number) { /* move time forward */ }
}
```

**StorageAdapter** (in-memory, tenant-scoped)
```typescript
export class StorageAdapter {
  constructor(tenantId: string) { /* init isolated store */ }
  async get(key: string): Promise<string | undefined>
  async set(key: string, value: string): Promise<void>
  async remove(key: string): Promise<void>
}
```

**JiraApiAdapter** (fixture-based, deterministic)
```typescript
export class JiraApiAdapter {
  constructor(fixture: JiraFixture) { /* load fixture */ }
  async getIssue(key: string): Promise<Issue>
  async searchIssues(jql: string): Promise<Issue[]>
  async getTransitions(issueId: string): Promise<Transition[]>
}
```

### ShakdownContext

All 32 scenarios run within a unified context:

```typescript
interface ShakdownContext {
  rng: DeterministicRNG;        // Seeded randomness
  time: FrozenTime;              // Frozen clock
  storage: StorageAdapter;       // In-memory tenant store
  jira: JiraApiAdapter;         // Fixture-based API
  results: ScenarioResult[];;   // Output accumulator
  failures: FailureMode[];       // Injected failures
}
```

### Normalization & Digesting

Output from each scenario is normalized:
1. **Redact UUIDs**: Replace with UUID_REDACTED
2. **Redact timestamps**: Replace with TS_REDACTED
3. **Redact random values**: Replace with RAND_REDACTED
4. **Sort keys**: Canonicalize JSON ordering
5. **Hash**: SHA-256(normalized output)

After all scenarios run, digests are compared: all must match.

## Determinism Guarantee

**Shakedown is fully deterministic** because:

✅ Time is frozen (no clock variation)  
✅ Randomness is seeded (identical PRNG sequence)  
✅ API responses are from fixtures (no network calls)  
✅ Storage is in-memory (no latency)  
✅ Output is normalized (UUIDs/timestamps redacted)  

**Proof**: Run shakedown 10+ times, digests will be identical (byte-for-byte).

## Scenario Matrix

All 32 scenarios are defined in `tests/shakedown/shk_matrix.json`:

```json
{
  "id": "SHK-001",
  "domain": "INSTALL_ZERO_TOUCH",
  "title": "Installation completes without config screen",
  "required": true,
  "description": "FirstTry should install without prompting for configuration..."
}
```

Each scenario specifies:
- **id**: Scenario identifier (SHK-001, SHK-002, ...)
- **domain**: Grouping by functional area
- **title**: Human-readable name
- **required**: If true, must pass (all are true for shakedown)
- **description**: What is being tested and why

## Output Artifacts

After shakedown completes, the following artifacts are generated in `audit/shakedown/`:

### SHK_REPORT.md

Human-readable summary:

```markdown
# Shakedown Report

**Run Date**: 2024-01-15T10:30:00Z  
**Determinism**: VERIFIED (10 runs, all digests identical)  
**Total Scenarios**: 32  
**Passed**: 32  
**Failed**: 0  

## Digest Verification

```
Run 1:  2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p...
Run 2:  2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p...
Run 3:  2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p...
...
Run 10: 2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p...

✓ All digests identical
```

## Scenario Results

| Scenario | Domain | Result | Determinism |
|----------|--------|--------|-------------|
| SHK-001 | INSTALL_ZERO_TOUCH | PASS | ✓ |
| SHK-002 | INSTALL_ZERO_TOUCH | PASS | ✓ |
| ... | ... | ... | ... |
```

### SHK_RUNS.jsonl

Machine-readable log (one JSON object per run):

```jsonl
{"run": 1, "timestamp": "2024-01-15T10:30:00Z", "digest": "2a3b...", "scenariosPassed": 32, "scenariosFailed": 0}
{"run": 2, "timestamp": "2024-01-15T10:30:05Z", "digest": "2a3b...", "scenariosPassed": 32, "scenariosFailed": 0}
...
```

### SHK_DIGEST.txt

Final digest for verification:

```
DETERMINISM_VERIFIED
DIGEST: 2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8
RUNS: 10
DATE: 2024-01-15T10:30:00Z
```

### SHK_DIFF.txt

(If nondeterminism is detected)

```
DETERMINISM_FAILED
Run 1 digest: abc123...
Run 2 digest: def456...
Difference: [detailed diff]
```

## Fixtures

Fixtures are JSON files in `tests/shakedown/fixtures/`:

### jira_normal_dataset.json

Typical Jira configuration:
- ~100 issues
- Standard fields: key, id, summary, status, assignee
- Custom fields: priority, due date, sprint
- Workflow: Open → In Progress → In Review → Done

### jira_large_dataset.json

Stress test:
- 10,000 issues
- Tests pagination (50 per page)
- Tests performance (search, filtering)

### jira_missing_fields.json

Schema drift:
- Issues with missing fields (deleted by admin)
- Issues with unknown custom fields
- Tests graceful degradation

### jira_pagination_partial.json

Incomplete pagination:
- API returns 50 issues, says "nextPage exists"
- Next call returns 404
- Tests timeout and fallback

### errors_rate_limit.json

Rate limiting (429):
- First 3 calls: success
- Next 5 calls: 429 "rate limit exceeded"
- Tests retry logic and backoff

### errors_server_errors.json

Server failures (5xx):
- 10% of calls randomly return 503
- Tests circuit breaker and fail-closed behavior

## Exit Criteria

Shakedown passes when:

✅ All 32 scenarios execute without throwing  
✅ All scenarios report results (no hangs)  
✅ All 10+ runs have identical digests  
✅ All failure scenarios include disclosure fields  
✅ Docs compliance validator passes (no forbidden phrases)  
✅ Artifacts are generated (SHK_REPORT.md, SHK_DIGEST.txt)  

Shakedown fails if:

❌ Any scenario throws an error  
❌ Run digests differ (nondeterminism detected)  
❌ Any scenario fails to report a result  
❌ Failure scenarios omit disclosure fields  
❌ Docs contain forbidden phrases ("configure", "setup", etc.)  

## Limitations

### Not Tested in Shakedown

- **Real Jira Cloud API**: We use fixtures instead (network resilience not tested)
- **Real Forge Storage**: We use in-memory store (persistence not tested)
- **Real Chronological Time**: We use frozen time (wall-clock behavior not tested)
- **Concurrent Requests**: Shakedown is single-threaded (race conditions not tested)
- **Browser Interactions**: No UI testing (e.g., settings screen)
- **Permission Scopes**: Scopes are assumed present (security policy not tested)

These are covered by other test suites:
- **E2E tests**: Call real Jira Cloud API, test end-to-end workflows
- **Integration tests**: Call real Forge storage, test persistence
- **Performance tests**: Call real APIs, measure latency and throughput
- **Security tests**: Test permission scopes and access control

### Why These Limitations?

Shakedown's goal is **deterministic, repeatable validation**. Real dependencies (network, time) break determinism. We trade breadth (all features) for depth (all failure modes).

## Adding Scenarios

To add a new scenario:

1. **Update scenario matrix** (`tests/shakedown/shk_matrix.json`):
   ```json
   {
     "id": "SHK-090",
     "domain": "CUSTOM_DOMAIN",
     "title": "My new scenario",
     "required": true,
     "description": "What I'm testing..."
   }
   ```

2. **Create scenario test** (e.g., `tests/shakedown/scenarios/shk_custom.test.ts`):
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { createShakdownContext } from '../shk_harness';

   describe('SHK-090: Custom scenario', () => {
     it('should do what I expect', async () => {
       const ctx = await createShakdownContext();
       // Test code here
       ctx.addScenarioResult('SHK-090', true, { /* result data */ });
     });
   });
   ```

3. **Update runner** (`tests/shakedown/shk_runner.test.ts`):
   - Import the new test module
   - Add to `runAllScenarios` function

4. **Run**: `npm run test:shakedown`

## Related Documentation

- [Security Model](./SECURITY.md): Fail-closed design, threat model
- [Reliability SLAs](./RELIABILITY.md): Failure modes and recovery
- [Privacy Policy](./PRIVACY.md): Data collection and retention
- [Support](./SUPPORT.md): Troubleshooting and escalation

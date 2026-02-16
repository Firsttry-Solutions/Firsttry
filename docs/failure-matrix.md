# Failure Scenario Matrix (Fail-Closed)

No partial data is exported in failure scenarios.

| Error Code | Trigger | Data Safety Impact | Recovery Path |
| ---------- | ------- | ------------------ | ------------- |
| SNAPSHOT_MISSING | Required baseline/snapshot not present | No export produced | Re-run snapshot collection, then export |
| LOCK_UNAVAILABLE | Concurrency lock cannot be acquired | No export produced | Retry later when lock clears |
| TIME_BUDGET_EXCEEDED | Operation exceeds time budget | No export produced | Reduce scope / run again; see [docs/scale-envelope.md](scale-envelope.md) |
| EXPORT_TOO_LARGE | Artifact exceeds size constraints | No export produced | Reduce export scope or split exports (if supported) |
| SCALE_LIMIT_EXCEEDED | Tenant size exceeds supported envelope | No export produced | See [docs/scale-envelope.md](scale-envelope.md); fail-closed |
| ABUSE_LIMIT_EXCEEDED | Platform rate limits / abuse protections | No export produced | Retry after cooldown; fail-closed |

Notes:
- Exact emitted error strings depend on implementation; tests enforce fail-closed behavior and "no partial artifact" guarantees:
  - [atlassian/forge-app/tests/security/failureCompleteness.spec.ts](../../atlassian/forge-app/tests/security/failureCompleteness.spec.ts)

# Logging and Monitoring

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-OPS-010  

---

## 1. Application Logging

**Logger**: Winston (Node.js logging library)

**Log levels**:
- ERROR: App failures, unhandled exceptions
- WARN: Recoverable issues, deprecated API usage
- INFO: State changes, API calls, exports
- DEBUG: Detailed execution flow (development only)

**Log output**:
- Console (development)
- Forge Storage (production; audit trail)
- Forge logs (accessible via `forge logs`)

**PII handling**:
- Redact user emails from logs (log user IDs only)
- Never log request/response bodies containing sensitive data
- Exclude API keys and credentials

---

## 2. Audit Trail (Ledger)

**What is logged**:
- API calls to Jira (method, endpoint, timestamp)
- Snapshot creation (ID, record count, timestamp)
- Export requests (timestamp, file hash)
- Error events (action, error message, tenant ID)

**Immutability**:
- Stored in append-only ledger (Forge Storage)
- Hash chain prevents tampering
- Customer can verify offline via export archives

---

## 3. Metrics and Observability

**Metrics exported**:
- Request count (per endpoint)
- Latency percentiles (p50, p95, p99)
- Error rate (failures / total requests)
- Snapshot size (bytes stored)
- Ledger record count

**Access**:
- Dashboard gadget (real-time Jira admin view)
- Export manifest (historical snapshots)
- Forge platform metrics (via forge logs)

---

## 4. Error Handling and Alerting

**Errors are fail-closed**:
- If API call fails: Return error to user (no silent failures)
- If export fails: Report reason code and stop (don't corrupt ZIP)
- If ledger verification fails: Abort export

**Example error messages**:
```
"ERROR: Jira API returned 429 (rate limit). Retry in 5 minutes."
"ERROR: Export validation failed: ledger hash mismatch."
"ERROR: Insufficient Forge Storage quota. Uninstall old snapshots."
```

**Alerting** (if connected to monitoring):
- Slack notification on critical errors (optional)
- Email alerts for repeated failures
- Manual threshold: >5% error rate triggers review

---

## 5. Logging for Forensics

**When investigating incidents**:

1. **Access Forge logs**:
   ```bash
   forge logs [--tail | --follow]
   ```

2. **Retrieve ledger from Forge Storage**:
   - Admin exports compliance evidence
   - Ledger is included in ZIP archive

3. **Search logs for**:
   - Specific error messages
   - API call patterns
   - Timestamp bounds around incident
   - Tenant/user context

---

## 6. Retention and Deletion

**Log retention**:
- Forge logs: 14 days (Atlassian platform default)
- Audit ledger: 90 days (configurable per snapshot policy)
- After 90 days: Auto-cleanup via cron (scheduled job)

**Customer export logs**:
- Retained on customer's infrastructure
- FirstTry does not retain downloads

---

## 7. Monitoring Plan

**What to monitor**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | >5% | Investigate root cause |
| API latency | p99 > 5s | Check Jira Cloud health |
| Ledger size | >1GB | Warn customer; recommend export |
| Export failure rate | >1% | Escalate to engineering |

**Review frequency**: Weekly (automated), Manual monthly

---

## References

- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md): Error handling procedures
- [docs/trust/LEDGER_CRYPTO_SPEC.md](../trust/LEDGER_CRYPTO_SPEC.md): Audit trail format

# FirstTry Reliability & Failure Disclosure

## Overview

FirstTry is designed for fail-closed operation: if anything goes wrong, the default is to DENY (most conservative policy decision), not to allow unexpected behavior.

## Availability & SLAs

FirstTry does not claim 99.9% uptime; it runs within Jira Cloud and Forge, and is subject to their SLAs.

**Expected availability**: Similar to Jira Cloud (typically 99.5-99.9%)

**FirstTry's contribution to failures**: < 1% (minimal code, no network calls, mostly deterministic)

## Failure Modes

### Jira Cloud API Failures

**If Jira API is unavailable**:
- FirstTry cannot fetch latest issue metadata
- Decision: DENY (fail-closed; do not allow unexpected transitions)
- Disclosure: CLI shows "JIRA_UNAVAILABLE" error code
- User action: Retry after Jira is available

**If Jira API returns 5xx errors**:
- Same as above: DENY, error disclosure, retry
- Cached data (if available) is not used; we never use stale data for decisions

### Policy Evaluation Failures

**If policy ruleset is corrupted**:
- Policy validation fails on load
- Decision: DENY (fail-closed)
- Disclosure: "INVALID_POLICY" error code in audit trail
- User action: Fix policy via `firstry policy update`

**If entitlement engine fails**:
- Cannot determine plan tier (baseline/pro/enterprise)
- Decision: Default to BASELINE (most restrictive plan)
- Disclosure: "ENTITLEMENT_ERROR" in audit trail
- User action: Contact support

**If usage meter fails**:
- Cannot record usage (export/report counts)
- Decision: Continue operation (meter failure does not block usage)
- Disclosure: "METER_FAILURE" in audit trail
- User action: No user action needed; logged for investigation

### Storage Failures

**If Forge storage is unavailable**:
- Cannot read/write policies
- Decision: In-memory cache is used if available
- Disclosure: "STORAGE_UNAVAILABLE" error code
- User action: Wait for Forge to recover, then retry

**If Forge storage quota is exceeded**:
- Cannot write new policies
- Decision: DENY policy creation
- Disclosure: "STORAGE_QUOTA_EXCEEDED" error code
- User action: Delete unused policies, then retry

### Schema Migration Failures

**If policy schema version is unsupported**:
- New version of FirstTry has different schema
- Old policies cannot be loaded
- Decision: DENY (fail-closed; do not evaluate unknown policies)
- Disclosure: "SCHEMA_VERSION_MISMATCH" error code
- User action: Upgrade FirstTry, or rollback policies to compatible version

## Fail-Closed vs. Fail-Open

FirstTry uses **fail-closed** design:

| Scenario | FirstTry Decision | Rationale |
|----------|-------------------|-----------|
| API error | DENY | Don't allow unexpected state |
| Invalid policy | DENY | Don't evaluate malformed rules |
| Entitlement unknown | BASELINE (most restrictive) | Don't grant unexpected permissions |
| Storage unavailable | Use cache (if available) | Defensive, but don't invent data |

This means: **If anything is ambiguous, the answer is NO.** This is the most secure default.

## Recovery

### Automatic Recovery

- **Transient failures**: FirstTry retries with exponential backoff (1s, 2s, 4s, then give up)
- **Cache recovery**: If API is unavailable, uses last-known metadata (max 7 days old)
- **Entitlement fallback**: Defaults to BASELINE if engine unavailable

### Manual Recovery

Users can force recovery via:

```bash
firstry cache clear          # Clear all cached metadata
firstry policy refresh <id>  # Refresh a specific policy
firstry export               # Export and verify data integrity
```

## Monitoring & Alerting

FirstTry logs all failures to audit trail:
- **JIRA_UNAVAILABLE**: Jira API is down
- **JIRA_RATE_LIMITED**: 429 response (transient)
- **JIRA_SERVER_ERROR**: 5xx response
- **INVALID_POLICY**: Policy validation failed
- **ENTITLEMENT_ERROR**: Plan lookup failed
- **STORAGE_UNAVAILABLE**: Forge storage down
- **STORAGE_QUOTA_EXCEEDED**: Out of space
- **SCHEMA_VERSION_MISMATCH**: Incompatible policy version

Users can query audit trail to detect patterns:

```bash
firstry audit list --error-only
firstry audit list --since "2024-01-01"
```

## Disaster Recovery

### Total Data Loss

In case of Forge storage corruption (catastrophic failure):

1. **Policies are lost**: Users must re-create policies from backup (e.g., git repository)
2. **Audit trail is lost**: Historical decisions cannot be recovered
3. **Usage metrics are lost**: Entitlement billing may be affected
4. **FirstTry is cleared**: Can be reinstalled from scratch

Recovery procedure:
```bash
# 1. Export current state (if possible)
firstry export > backup.json

# 2. Reinstall app
firstry reinstall

# 3. Import policies from backup or version control
firstry import < backup.json
```

### Partial Data Loss

If only some policies are corrupted:
- Delete corrupted policy: `firstry policy delete <id>`
- Restore from backup: Re-create manually or import from version control
- Audit trail may have gaps (loss is not recoverable)

## Known Issues

### Issue 1: Large Policy Sets (1000+ policies)
- **Problem**: Listing all policies is slow (O(n) API calls)
- **Workaround**: Use `--filter` to narrow the list
- **Fix timeline**: Q2 2024 (performance optimization)

### Issue 2: Jira Custom Field Drift
- **Problem**: If Jira admin renames a custom field, policies become invalid
- **Workaround**: Run `firstry policy validate` to detect drift
- **Disclosure**: "CUSTOM_FIELD_REMOVED" error
- **Fix**: Manually update policy with new field name

### Issue 3: Concurrent Policy Updates
- **Problem**: If two users update the same policy simultaneously, last write wins
- **Workaround**: Serialize updates (use locks or revision control)
- **Fix timeline**: Q3 2024 (optimistic locking)

## Support & Escalation

For reliability issues:
1. **Check status**: Visit [status.atlassian.com](https://status.atlassian.com) (Forge/Jira Cloud status)
2. **Check FirstTry issues**: Search [GitHub Issues](https://github.com/user/firstry/issues) for similar problems
3. **Contact support**: Email or create GitHub issue with:
   - Error code and timestamp
   - Output of `firstry export`
   - Output of `firstry audit list --error-only`

Response time: Best effort (community-supported project)

## Related Documentation

- [Security Model](./SECURITY.md)
- [Privacy Policy](./PRIVACY.md)
- [Shakedown Test Harness](./SHAKEDOWN.md)

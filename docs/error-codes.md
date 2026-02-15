# FirstTry Error Codes Reference

**Version**: 3.2  
**Last Updated**: 2026-02-15  
**Marker**: [FT_ERROR_MODEL_DOCUMENTED]

---

## Overview

This document maps FirstTry error codes to their causes, user-facing messages, and remediation steps. All errors are fail-closed (deny access rather than permit).

---

## Error Code Catalog

### Authentication & Authorization Errors

#### AUTH_REQUIRED
- **HTTP Status**: 401 Unauthorized
- **Message**: "Authentication required. Please sign in."
- **Cause**: User not authenticated with Jira
- **Remediation**: Redirect to Jira OAuth login
- **Logging**: INFO (expected behavior)

#### INSUFFICIENT_PRIVILEGE
- **HTTP Status**: 403 Forbidden
- **Message**: "You must be a Jira admin to perform this action."
- **Cause**: User lacks admin privilege
- **Remediation**: Request Jira admin access
- **Logging**: WARN (security event)

#### RBAC_DENIED
- **HTTP Status**: 403 Forbidden
- **Message**: "Your role does not permit this action. Current role: Reviewer (read-only)."
- **Cause**: RBAC role insufficient for operation
- **Remediation**: Request role escalation from admin
- **Logging**: AUDIT (track RBAC denials)

#### REVIEWER_GROUP_FROZEN
- **HTTP Status**: 403 Forbidden
- **Message**: "Reviewer list frozen at review open time. Run new review to update membership."
- **Cause**: Attempted privilege escalation via group modification
- **Remediation**: Admin must open new review to capture latest group
- **Logging**: WARN (potential attack)

---

### Tenant Isolation Errors

#### TENANT_SPOOF_DETECTED
- **HTTP Status**: 400 Bad Request
- **Message**: "Tenant identity mismatch. Your tenant: abc123; requested: xyz789"
- **Cause**: Input siteId does not match OAuth context
- **Remediation**: None (blocked by design for security)
- **Logging**: ALERT (active attack attempt)

#### RESIDENCY_MISMATCH
- **HTTP Status**: 400 Bad Request
- **Message**: "Data residency violation. Your region: EU; requested: US"
- **Cause**: Query attempted outside configured residency boundary
- **Remediation**: Verify tenant data residency setting
- **Logging**: AUDIT (compliance event)

---

### Input Validation Errors

#### INVALID_QUARTER
- **HTTP Status**: 400 Bad Request
- **Message**: "Invalid quarter format. Expected: YYYY-Q# (e.g., 2026-Q1)"
- **Cause**: Quarter string malformed
- **Remediation**: Use correct format (2026-Q1, 2026-Q2, etc.)
- **Logging**: INFO

#### INVALID_SITE_ID
- **HTTP Status**: 400 Bad Request
- **Message**: "Invalid site ID. Must be alphanumeric, 8-36 chars."
- **Cause**: siteId contains invalid characters or length
- **Remediation**: Verify siteId from Jira Cloud settings
- **Logging**: INFO

#### MISSING_PRIVILEGE_CONTEXT
- **HTTP Status**: 400 Bad Request
- **Message**: "Privilege context required. Request with admin flag confirmed."
- **Cause**: Caller did not provide privilege verification
- **Remediation**: Pass `privilegeContext` in request
- **Logging**: WARN (potential protocol violation)

#### ENTITY_COUNT_EXCEEDED
- **HTTP Status**: 400 Bad Request
- **Message**: "Too many entities. Limit: 10,000; provided: 15,342. Reduce scope and retry."
- **Cause**: Query exceeds entity limit
- **Remediation**: Filter by date range; batch export
- **Logging**: INFO (customer operation limit reached)

---

### Rate Limiting Errors

#### RATE_LIMIT_OPEN
- **HTTP Status**: 429 Too Many Requests
- **Message**: "Review opening rate limited. Limit: 1 per hour. Try again in 45 minutes."
- **Cause**: Customer exceeded rate limit for opening reviews
- **Remediation**: Wait for rate limit window to reset
- **Logging**: INFO (expected for heavy users)

#### RATE_LIMIT_EXPORT
- **HTTP Status**: 429 Too Many Requests
- **Message**: "Export rate limited. Limit: 10 per day. Resets at 2026-02-16 00:00 UTC."
- **Cause**: Customer exceeded export quota
- **Remediation**: Wait for daily reset or contact support
- **Logging**: INFO

#### RATE_LIMIT_DECISION
- **HTTP Status**: 429 Too Many Requests
- **Message**: "Decision recording rate limited. Limit: 100 per minute. Cool off period: 2 hours."
- **Cause**: Batch decision requests too rapid
- **Remediation**: Spread decisions over time; use batching API (if available)
- **Logging**: INFO

---

### Scale Envelope Errors

#### SCALE_LIMIT_EXCEEDED
- **HTTP Status**: 400 Bad Request
- **Message**: "Scale envelope exceeded: 50,000 entities requested (limit: 10,000)."
- **Cause**: Query violates hard entity limit
- **Remediation**: Reduce scope; contact enterprise@firsttry.app for custom deployment
- **Logging**: WARN

#### TIMEOUT_EXECUTION
- **HTTP Status**: 504 Gateway Timeout
- **Message**: "Query exceeded 240-second timeout. Increase specificity and retry."
- **Cause**: Complex query took >240 seconds
- **Remediation**: Reduce date range or entity count
- **Logging**: WARN

#### MEMORY_LIMIT_EXCEEDED
- **HTTP Status**: 503 Service Unavailable
- **Message**: "Memory limit exceeded (1GB). Retry with smaller scope."
- **Cause**: Query consumed >1GB heap
- **Remediation**: Reduce dataset size; batch requests
- **Logging**: ALERT (infrastructure concern)

#### EXPORT_SIZE_EXCEEDED
- **HTTP Status**: 400 Bad Request
- **Message**: "Export size exceeded 50 MB at position 23,421 entities."
- **Cause**: CSV export grew beyond 50 MB
- **Remediation**: Reduce date range and retry
- **Logging**: INFO

---

### Data Integrity Errors

#### STATE_HASH_MISMATCH
- **HTTP Status**: 500 Internal Server Error
- **Message**: "State integrity check failed. Computed: abc123...; stored: xyz789..."
- **Cause**: Stored state hash does not match computed hash (tampering or corruption)
- **Remediation**: Contact security@firsttry.app immediately (potential data breach)
- **Logging**: ALERT (security incident)

#### CHAIN_INTEGRITY_VIOLATION
- **HTTP Status**: 500 Internal Server Error
- **Message**: "Ledger chain broken at position 15. Review #Q1-2025-001 hash mismatch."
- **Cause**: Ledger chain tampering detected
- **Remediation**: Contact security@firsttry.app; initiate incident response
- **Logging**: ALERT

#### AUDIT_TRAIL_CORRUPTED
- **HTTP Status**: 500 Internal Server Error
- **Message**: "Audit trail entry missing at timestamp 2026-02-15T14:23:00Z"
- **Cause**: Audit ledger contains gaps or missing entries (impossible under append-only)
- **Remediation**: Contact support@firsttry.app; escalate to engineering
- **Logging**: ALERT

---

### Storage Errors

#### STORAGE_UNAVAILABLE
- **HTTP Status**: 503 Service Unavailable
- **Message**: "Forge storage temporarily unavailable. Retry in 30 seconds."
- **Cause**: Forge App Storage API is down or unreachable
- **Remediation**: Retry; contact Atlassian if persists >5 min
- **Logging**: ERROR (infrastructure)

#### STORAGE_QUOTA_EXCEEDED
- **HTTP Status**: 400 Bad Request
- **Message**: "Storage quota limit reached (100 GB). Archive reviews or contact support."
- **Cause**: Tenant storage quota exhausted
- **Remediation**: Delete old reviews; request quota increase
- **Logging**: WARN

#### LOCK_ACQUISITION_TIMEOUT
- **HTTP Status**: 409 Conflict
- **Message**: "Could not acquire review lock (330s timeout). Review may be in use. Retry in 5 minutes."
- **Cause**: Another user is modifying the same review
- **Remediation**: Wait for other user to complete; retry
- **Logging**: INFO (concurrent operation)

---

### GDPR & Lifecycle Errors

#### ANONYMIZATION_FAILED
- **HTTP Status**: 500 Internal Server Error
- **Message**: "Anonymization failed for user record: alice@jira.example.com"
- **Cause**: Deterministic hash computation error
- **Remediation**: Contact support@firsttry.app; escalate to engineering
- **Logging**: ERROR

#### PURGE_POLICY_VIOLATION
- **HTTP Status**: 400 Bad Request
- **Message**: "Cannot purge. Retention policy requires 7-year hold. Eligible for purge on 2033-02-15."
- **Cause**: Attempted premature purge
- **Remediation**: Wait until retention period expires
- **Logging**: INFO

#### HARD_DELETE_REJECTED
- **HTTP Status**: 403 Forbidden
- **Message**: "Hard deletion disabled for this tenant. Use ANONYMIZE instead."
- **Cause**: Org policy forbids permanent deletion (audit requirement)
- **Remediation**: Use anonymization; or contact admin to enable hard delete
- **Logging**: WARN

---

### Jira Integration Errors

#### JIRA_API_UNAVAILABLE
- **HTTP Status**: 503 Service Unavailable
- **Message**: "Could not fetch Jira data. Jira Cloud API temporarily down."
- **Cause**: Jira REST API is unreachable
- **Remediation**: Retry; check Jira Cloud status page
- **Logging**: ERROR (infrastructure)

#### JIRA_PERMISSION_DENIED
- **HTTP Status**: 403 Forbidden
- **Message**: "FirstTry app lacks permission to read projects. Grant read:jira-project scope."
- **Cause**: scope mismatch or revoked permission
- **Remediation**: Re-authorize app; contact Jira admin
- **Logging**: WARN

#### USER_NOT_FOUND
- **HTTP Status**: 404 Not Found
- **Message**: "User not found: alice@jira.example.com (may have been deprovisioned)"
- **Cause**: Referenced user does not exist in Jira
- **Remediation**: Verify user account exists; update reviewer list
- **Logging**: INFO

---

### Configuration Errors

#### MANIFEST_PARSE_ERROR
- **HTTP Status**: 500 Internal Server Error
- **Message**: "App manifest invalid YAML at line 42."
- **Cause**: Manifest syntax error
- **Remediation**: Contact engineering@firsttry.app (internal only)
- **Logging**: ERROR (deployment)

#### INVALID_SIGNING_KEY
- **HTTP Status**: 500 Internal Server Error
- **Message**: "Signing key corrupted or expired."
- **Cause**: RSA key validation failed
- **Remediation**: N/A (v3.2 removed RSA signing; error should not occur)
- **Logging**: ALERT (legacy error)

---

### Unknown/Catch-All Errors

#### INTERNAL_SERVER_ERROR
- **HTTP Status**: 500 Internal Server Error
- **Message**: "An internal error occurred. Incident ID: INC-20260215-0001. Contact support with this ID."
- **Cause**: Unmapped error; unhandled exception
- **Remediation**: Contact support@firsttry.app with incident ID
- **Logging**: ERROR (always escalate to engineering)

---

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "INSUFFICIENT_PRIVILEGE",
  "code": 403,
  "message": "You must be a Jira admin to perform this action.",
  "timestamp": "2026-02-15T14:23:00Z",
  "correlationId": "corr-20260215-abc123",
  "details": {
    "requiredRole": "admin",
    "currentRole": "viewer",
    "remediation": "Request Jira admin access from your IT department"
  }
}
```

---

## Client-Side Error Handling

### UI Behavior

**Errors are displayed to users as**:
```
STATUS: ⚠️ Error (Red banner)
TITLE: "Could not export review"
MESSAGE: (customer-friendly summary from `message` field)
ACTION: "Retry" button + "View Details" link (shows `details` JSON)
```

**Non-retriable errors show**:
```
STATUS: ❌ Error (Red banner)
TITLE: "Cannot proceed"
MESSAGE: (remediation step, e.g., "Contact admin for permission")
ACTION: "Close" button + link to support
```

---

## Logging Conventions

| Log Level | Trigger | Audience | Example |
|-----------|---------|----------|---------|
| **DEBUG** | Dev/test only | Engineers | `[DEBUG] Rate limiter refill: +5 tokens` |
| **INFO** | Expected behavior | Ops + customers | `[INFO] Export rate limited; quota resets in 4h` |
| **WARN** | Unexpected but handled | Support + security | `[WARN] Concurrent lock timeout; retrying` |
| **ERROR** | Failure; needs fix | Engineering | `[ERROR] Hash mismatch detected; quarantine data` |
| **ALERT** | Security incident | Security team + CTO | `[ALERT] Tenant spoof attempt from IP 1.2.3.4` |
| **AUDIT** | Compliance-relevant | Compliance + legal | `[AUDIT] Hard delete authorized for siteId:abc123` |

---

## Error Reference by HTTP Status

| Code | Errors | Common Cause |
|------|--------|------------|
| **400** | INVALID_QUARTER, TENANT_SPOOF, SCALE_LIMIT_EXCEEDED | Client input invalid or out of bounds |
| **401** | AUTH_REQUIRED | User not signed in |
| **403** | INSUFFIENT_PRIVILEGE, RBAC_DENIED, RESIDENCY_MISMATCH | Permission denied |
| **404** | USER_NOT_FOUND | Resource not found |
| **409** | LOCK_ACQUISITION_TIMEOUT | Conflict (concurrent edit) |
| **429** | RATE_LIMIT_* | Rate limit exceeded |
| **500** | STATE_HASH_MISMATCH, INTERNAL_SERVER_ERROR | Server error (critical) |
| **503** | STORAGE_UNAVAILABLE, MEMORY_LIMIT_EXCEEDED | Service unavailable |
| **504** | TIMEOUT_EXECUTION | Query timeout |

---

This error model is fail-closed: when in doubt, deny access and escalate to support.

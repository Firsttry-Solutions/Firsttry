# Platform Dependencies Documentation

---
**COMPLIANCE DISCLAIMER**: Any references to SOC 2, ISO 27001, HIPAA, GDPR, or Cloud Fortified in this document refer to Atlassian's platform-level certifications, NOT independent app-level certifications. FirstTry Governance inherits security posture from the Atlassian Forge platform. See [docs/SECURITY.md](../atlassian/forge-app/docs/SECURITY.md) for explicit disclaimers.
---


**App Name**: FirstTry Governance - Atlassian Dual-Layer Integration  
**Last Updated**: 2025-12-22  
**Purpose**: Document all dependencies on Atlassian Forge platform and trust boundaries

⚠️ **HISTORICAL NOTE**: Some sections reference admin page UI functionality. Current builds expose no admin UI surface. Admin page references in this document describe historical/future risk scenarios only; they do not apply to current deployments.

---

## Overview

This Forge app **delegates all infrastructure, security, and operational responsibilities** to the Atlassian Forge platform.

**App Scope**: Application logic only (read-only Jira metadata processing)  
**Platform Scope**: Everything else (runtime, storage, security, availability)  

---

## Critical Platform Dependencies

### 1. Forge Runtime (nodejs20.x)

**Dependency**: Forge execution environment  
**Version**: nodejs20.x (declared in manifest.yml)  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- Node.js runtime version and patches
- Sandboxed execution environment
- CPU and memory limits
- Process lifecycle management

**What App Cannot Control**:
- Runtime version upgrades (forced by Atlassian)
- Resource quotas (CPU, memory, execution time)
- Runtime security patches
- Deprecation timeline

**Risk**: Forced runtime upgrades may break app compatibility.

**Mitigation**: None (accept platform risk).

---

### 2. Forge Storage API

**Dependency**: Key-value storage for app data  
**API**: `@forge/api` → `storage.*` or `api.asApp().requestStorage()`  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- Persistent key-value storage
- Tenant isolation (cloudId-scoped)
- Encryption at rest
- Backup/disaster recovery (unverified)

**What App Cannot Control**:
- Storage quotas (undocumented by Atlassian)
- Storage region/residency
- Encryption algorithm or key management
- Backup frequency or retention
- Storage performance (latency, throughput)

**Known Unknowns**:
- **Storage Quota**: No public documentation of limits
- **Backup Policy**: Unknown if Forge Storage is backed up
- **Data Residency**: Unknown if storage location matches Jira Cloud region
- **Disaster Recovery**: Unknown RTO/RPO for Forge Storage failures

**Risk**: Storage quota exhaustion → data loss (silent truncation).

**Mitigation**: Disclosure envelopes (`missingDataList`) track incomplete data.

---

### 3. Jira REST API

**Dependency**: Read-only Jira metadata via REST API  
**API**: `api.asUser().requestJira()` (Forge-provided wrapper)  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- REST API access (scoped by manifest permissions)
- Rate limiting enforcement
- API versioning and deprecation
- Authentication/authorization

**What App Cannot Control**:
- API rate limits (Atlassian sets limits per-tenant)
- API response schema changes
- API deprecation timeline
- API availability/uptime

**Known Rate Limits**:
- UNKNOWN (Atlassian does not publish Forge-specific limits)
- Different from public Jira API limits (Forge has separate quotas)

**Risk**: API rate limits → incomplete data ingestion.

**Mitigation**: Disclosure envelopes mark data as `PARTIAL`.

---

### 4. Forge Scheduled Triggers

**Dependency**: Cron-like scheduled function invocations  
**API**: `scheduledTrigger` module in manifest.yml  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- Automatic invocation at specified intervals (`day`, `week`, `fiveMinute`, etc.)
- Execution guarantees (best effort)
- Distributed scheduling (multi-tenant)

**What App Cannot Control**:
- Exact execution time (Forge chooses time within interval)
- Execution guarantees (may skip on platform issues)
- Concurrency limits (Forge may serialize or parallelize)

**Known Unknowns**:
- **Execution Timing**: No guarantee of exact time (e.g., "daily" may run any time that day)
- **Missed Executions**: Unknown if Forge retries missed schedules
- **Concurrency**: Unknown if multiple scheduled functions run concurrently

**Risk**: Missed scheduled runs → stale data.

**Mitigation**: Phase 5 scheduler tracks last run timestamp (detects missed runs).

---

### 5. Forge UI Framework

**Dependency**: Admin page rendering via `@forge/ui`  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- UI component library (limited set)
- Iframe sandbox for admin pages
- Browser-side rendering within Jira

**What App Cannot Control**:
- UI component availability or deprecation
- Browser compatibility (Forge determines supported browsers)
- UI performance or rendering latency

**Risk**: Forge UI deprecation → admin page breaks.

**Mitigation**: None (accept platform risk).

---

### 6. Authentication & Authorization

**Dependency**: User authentication and app permissions  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- User authentication (Atlassian SSO)
- App authorization (manifest scopes)
- `api.asUser()` vs `api.asApp()` context
- Permission enforcement

**What App Cannot Control**:
- Authentication method (Atlassian SSO only)
- Session management or expiration
- Scope enforcement logic
- Permission escalation attacks (Forge sandbox prevents)

**Scopes Declared** (manifest.yml):
- `read:jira-work`: Read Jira issues, projects, metadata
- `read:jira-user`: Read Jira user metadata (for accountId)
- `storage:app`: Access app-scoped Forge Storage

**Risk**: Scope changes require manifest update + customer re-approval.

**Mitigation**: Minimal scopes declared (read-only).

---

### 7. Network Isolation

**Dependency**: Forge sandbox prevents arbitrary outbound network calls  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- Network sandbox (only Forge APIs allowed)
- No raw socket access
- No arbitrary HTTP/HTTPS requests

**What App Cannot Control**:
- Sandbox enforcement (trust Atlassian)
- Egress whitelist (Forge determines allowed destinations)

**Risk**: Zero (network isolation is security feature, not risk).

**Verification**: See [EXTERNAL_APIS.md](EXTERNAL_APIS.md) for zero-egress proof.

---

### 8. Logging & Observability

**Dependency**: Forge runtime logs for debugging  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- Runtime logs (via Forge CLI `forge logs`)
- Error tracking (exceptions logged by platform)

**What App Cannot Control**:
- Log retention (unknown duration)
- Log access (only app developer can view via Forge CLI)
- Log format or structure

**Known Unknowns**:
- **Log Retention**: How long Forge retains runtime logs
- **Customer Log Access**: Customers cannot view Forge runtime logs (only Atlassian)

**Risk**: Limited observability for customers (no app-level logs exported).

**Mitigation**: None (accept platform limitation).

---

### 9. Deployment & Updates

**Dependency**: Forge deployment pipeline  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- App deployment via Forge CLI (`forge deploy`)
- Version management (Forge tracks app versions)
- Customer approval flow (Jira admins approve updates)

**What App Cannot Control**:
- Deployment region (Forge chooses)
- Rollout speed or phasing
- Rollback mechanisms

**Risk**: Bad deployment → app broken until next release.

**Mitigation**: Pre-deployment testing via [tests/](../tests/).

---

### 10. Availability & SLA

**Dependency**: Forge platform uptime  
**Control**: Atlassian-managed  

**What Atlassian Provides**:
- Platform availability (no published SLA for Forge)
- Multi-tenant infrastructure
- Platform status page: https://status.atlassian.com

**What App Cannot Control**:
- Forge uptime (no independent availability)
- Incident response time
- Disaster recovery procedures

**Known Unknowns**:
- **Forge SLA**: No published SLA for Forge platform availability
- **Incident Response**: Unknown response time for Forge platform issues

**Risk**: Forge outage = app unavailable (no workaround).

**Mitigation**: Document in [SUPPORT.md](SUPPORT.md) that app availability depends on Forge platform.

---

## Trust Boundaries

### What App Trusts Atlassian For

✅ **Security**:
- Tenant isolation (cloudId-scoped storage)
- Authentication (SSO)
- Authorization (scope enforcement)
- Encryption at rest (Forge Storage)
- Encryption in transit (TLS)
- Network sandbox (egress prevention)

✅ **Reliability**:
- Platform availability
- Storage durability
- Scheduled trigger execution
- API rate limiting (fair queuing)

✅ **Compliance**:
- GDPR compliance (as data processor)
- SOC 2 / ISO certifications (Atlassian-level)
- Data residency (Jira Cloud region)

### What App DOES NOT Trust Atlassian For

❌ **Application Logic**: App is responsible for correct data processing  
❌ **Data Accuracy**: App is responsible for correct Jira metadata interpretation  
❌ **Disclosure**: App is responsible for transparent reporting of limitations  

---

## Platform-Dependent Risks

### Documented Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Forge Storage Quota Exhaustion** | Data loss (silent truncation) | Medium | Disclosure envelopes (`missingDataList`) |
| **Jira API Rate Limiting** | Incomplete data ingestion | Medium | Disclosure envelope (`PARTIAL` status) |
| **Scheduled Trigger Missed** | Stale data | Low | Timestamp tracking detects missed runs |
| **Forge Runtime Forced Upgrade** | App compatibility break | Low | Accept risk (no mitigation) |
| **Forge Platform Outage** | App unavailable | Low | Document in SUPPORT.md (no SLA) |

### Unknown Risks

- **Forge Storage Backup Failure**: Unknown if data can be recovered after storage failure
- **Cross-Tenant Data Leakage**: Trust Forge sandbox (not independently verifiable)
- **Forge API Behavior Changes**: Undocumented API changes may break app

---

## Compliance Inheritance

### What App Inherits from Atlassian

✅ **SOC 2 Type II** (Atlassian-level)  
✅ **ISO 27001** (Atlassian-level)  
✅ **GDPR Compliance** (Atlassian as data processor)  
✅ **Cloud Fortified** (Atlassian Marketplace program)  

**Source**: https://www.atlassian.com/trust/compliance

**Important**: App **inherits** these certifications but makes **no independent claims**.

### What App Does NOT Claim

❌ App-level SOC 2 audit (no separate audit for this app)  
❌ App-level ISO certification (covered by Atlassian)  
❌ App-level GDPR DPA (Atlassian provides DPA)  

---

## Platform Documentation

### Forge Platform Docs

**URL**: https://developer.atlassian.com/platform/forge/  
**Coverage**: API reference, runtime behavior, security model  

**Gaps**:
- No published storage quotas
- No published rate limits for Forge API wrappers
- No published Forge SLA

### Atlassian Trust Center

**URL**: https://www.atlassian.com/trust  
**Coverage**: Compliance certifications, security practices, incident response  

---

## Dependency Verification

### How to Verify Platform Behavior

**Storage Quotas**: Attempt to fill storage until quota error  
**Rate Limits**: Trigger rate limit errors via heavy API usage  
**Scheduled Triggers**: Monitor execution timestamps over time  
**Tenant Isolation**: Trust Forge sandbox (not independently testable)  

**Verification Status**: See [tests/credibility/](../tests/credibility/) for platform behavior tests.

---

## Contact

**Platform Issues**: Contact Atlassian Forge support via https://support.atlassian.com  
**App Issues**: https://github.com/Global-domination/Firstry/issues  

**Boundary**:
- Forge runtime errors → Atlassian support
- App logic errors → GitHub issues

---

## Disclaimer

This app **cannot function without Atlassian Forge platform**.

All platform dependencies are **UNKNOWN or BEST-EFFORT** unless explicitly documented by Atlassian.

Customers must accept platform risk as documented in this file.

See LICENSE for warranty disclaimer.

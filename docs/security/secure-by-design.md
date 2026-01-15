# Secure-by-Design: FirstTry Atlassian Forge App

**Last Updated**: January 5, 2026  
**Audience**: Marketplace Reviewers, Security Teams, Enterprise Architects

---

## Overview

FirstTry is built with security-by-design principles enforced at three levels:

1. **Platform level** (Atlassian Forge) — Structural constraints
2. **Application level** (Manifest & code) — Functional restrictions  
3. **Operational level** (No-admin-access) — Minimal trust surface

This document explains how these principles protect user data.

---

## 1. No External Egress (Platform + Application Enforced)

### Mechanism
- **Forge Constraint**: Atlassian Forge restricts app network access to Jira Cloud APIs only
- **Manifest Declaration**: FirstTry manifest declares NO `external:fetch` scope
- **Code Verification**: No external URLs, no `fetch()` calls to non-Atlassian endpoints
- **Result**: Impossible for FirstTry to transmit data outside Atlassian ecosystem

### Trustworthiness
External egress requires explicit permission:
1. Atlassian must enable `external:fetch` scope in Forge runtime
2. FirstTry manifest must declare `permissions.external`
3. Marketplace review would catch unauthorized scope escalation

**Status**: ❌ ABSENT (by design, not by oversight)

### Evidence
- Manifest: `atlassian/forge-app/manifest.yml` — NO `external:fetch` scope
- Code: `src/resolvers/governance_status.ts` — GET-only; no fetch() to external URLs
- Static analysis: Audit artifact `02_manifest_scopes/MANIFEST_ANALYSIS.md` confirms no egress capability

---

## 2. Read-Only Mode (Application Enforced)

### Mechanism
- **Scope Constraint**: FirstTry declares ONLY `read:jira-work` scope (read-only)
- **No Write Scopes**: Manifest declares NO `write:jira-issue` or `delete:jira-issue` scopes
- **Code Implementation**: Resolver only uses Jira GET APIs; no POST/PUT/DELETE to Jira
- **Result**: FirstTry cannot create, modify, or delete Jira data

### Why This Matters
1. **Safety**: Prevents accidental or malicious data mutation
2. **Trust**: Single-purpose tool (monitoring only, not enforcement)
3. **Compliance**: Aligns with "read-only operational visibility" promise

### Evidence
- Manifest: `atlassian/forge-app/manifest.yml` — `read:jira-work` scope ONLY
- Code: `src/resolvers/governance_status.ts` — GET-only resolver
- Static analysis: `05_static_scans/STATIC_SCAN_SUMMARY.md` confirms no Jira write methods

---

## 3. Workspace Isolation (Forge Enforced)

### Mechanism
- **Forge Runtime Model**: Each installed app instance is scoped to one Jira workspace
- **Storage Isolation**: `storage:app` scope provides tenant-scoped key-value storage
- **API Isolation**: All Forge APIs enforce workspace context; cross-workspace access is impossible
- **Result**: FirstTry running on workspace A cannot read/write workspace B's data

### Trust Surface
Isolation is structural (enforced by Forge runtime), not policy-based:
- No cross-workspace credentials
- No multi-tenant backend
- No shared storage keys across workspaces

### Evidence
- Manifest: `atlassian/forge-app/manifest.yml` declares single-workspace scope
- Code: `src/resolvers/governance_status.ts` uses tenant-scoped storage keys
- Platform capability: Forge API documentation (external, Atlassian-maintained)

---

## 4. No Admin/User Configurability (By Design)

### Mechanism
- **Zero Configuration**: FirstTry requires no setup steps, no policy files, no configuration UI
- **Automatic Execution**: Scheduled triggers run autonomously (no user action needed)
- **No Custom Code**: No admin can upload scripts, webhooks, or custom logic
- **Result**: Reduces attack surface; no misconfiguration risk

### Why This Matters
1. **Reduces Risk**: Fewer configuration options = fewer ways to misconfigure
2. **Predictable Behavior**: All instances run identical logic (no customization)
3. **Auditability**: Security team can review single code path (not 1000 customer configs)

### Evidence
- Code: `src/core/constants.ts` — hardcoded intervals, thresholds (no runtime config)
- Manifest: No `adminPage` module (no admin UI)
- Operations: Scheduled triggers in manifest are fixed; no customer-defined schedules

---

## 5. No Sensitive Data Persistence (By Code Design)

### Mechanism
- **Data Anonymization**: Personal data (emails, user IDs) is never logged or stored
- **Hashing**: Any user context is hashed (SHA256) before storage
- **Metadata Only**: FirstTry stores only governance metrics, not PII
- **Result**: Even if storage is compromised, no personal data is exposed

### Data Types Actually Stored
✅ Issue counts, project names, status distributions (aggregated)  
✅ Metadata timestamps, field names, workflow state (non-personal)  
❌ User emails, user IDs, IP addresses  
❌ Issue descriptions, comments, attachments  

### Evidence
- Code: `tests/p1_logging_safety.test.ts` verifies no PII in logs
- Code: `src/core/constants.ts` defines anonymization strategies
- Documentation: `docs/PRIVACY.md` lists what is NOT collected

---

## 6. Threat Model & Mitigation

| Threat | Risk | Mitigation | Residual Risk |
|--------|------|-----------|---|
| **Data exfiltration** | Medium | No external:fetch scope (Forge enforces) | ✅ ELIMINATED |
| **Data mutation** | Medium | No write scopes; read-only resolver | ✅ ELIMINATED |
| **Cross-tenant data leak** | Medium | Forge workspace isolation (structural) | ✅ ELIMINATED |
| **Misconfiguration** | Low | Zero-touch (no config UI) | ✅ ELIMINATED |
| **PII exposure** | Low | No PII stored; metadata only | ✅ ELIMINATED |
| **Forge platform compromise** | Medium | Delegated to Atlassian | ⚠️ **INHERITED** |
| **Supply chain (npm deps)** | Low | Minimal deps; npm audit in CI | ✅ **MONITORED** |

---

## 7. Security Assurance Level

**Design Assurance**: ⭐⭐⭐⭐⭐ (5/5)
- Constraints enforced by platform (not by convention)
- Code audit confirms constraints are respected
- Manifest prevents escalation (no write/external scopes declared)

**Implementation Assurance**: ⭐⭐⭐⭐ (4/5)
- Resolver code is minimal and auditable
- Tests verify no PII in logs
- No external dependencies on untrusted npm packages

**Operational Assurance**: ⭐⭐⭐⭐ (4/5)
- Runs on Atlassian-managed Forge infrastructure
- Automated deployment (no manual ops)
- Audit logging in Jira (admin activity)

---

## 8. Attestation

This secure-by-design document reflects the actual implementation as of January 5, 2026.

- ✅ **No external egress**: Forge platform + manifest + code audit confirm this
- ✅ **Read-only**: Manifest scopes + resolver code confirm this
- ✅ **Workspace-isolated**: Forge runtime + storage keys confirm this
- ✅ **Zero-config**: Resolver + scheduled triggers confirm this
- ✅ **No PII stored**: Anonymization code + test suite confirm this

**Conclusion**: FirstTry's security posture is enforced at multiple layers (platform, code, manifest). No single-point-of-failure introduces security risk.

---

## Contact

For security questions or vulnerability reports:
- **Email**: contact@firsttry.run  
- **Security Disclosure**: Please follow responsible disclosure practices

---

## Changes to This Document

Security-by-design claims are updated when code, manifest, or Forge platform constraints change.

Last audit date: January 5, 2026

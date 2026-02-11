---
title: Security
permalink: /security/
---

> **Source of truth**  
> This document mirrors the content used for Atlassian Marketplace review.  
> Any functional claims are constrained by the app manifest, scopes, and runtime behavior.

# Security

**App**: FirstTry Audit Evidence for Jira  
**Version**: 2.0.0  
**Last Updated**: 2026-02-10

---

## Security Posture

This document describes the security characteristics of the FirstTry Audit Evidence for Jira app. 

**Important**: This app does not claim security certifications (e.g., SOC2, ISO 27001) or compliance attestations (e.g., GDPR compliant). Security is provided by the Atlassian Forge platform on which this app runs.

---

## Read-Only Guarantee

This app is **read-only** and does not perform write, delete, or admin operations on your Jira data.

**Permission Scopes Requested**:
- `storage:app` - Forge platform storage (app-scoped, isolated)
- `read:jira-work` - Read Jira work items (no write capability)

**Permission Scopes NOT Requested**:
- ❌ `write:jira-work` - No write operations
- ❌ `delete:jira-work` - No delete operations
- ❌ `admin:jira-work` - No admin operations
- ❌ `write:jira-user` - No user modifications
- ❌ `admin` - No administrative access

**Verification**: See `manifest.yml` in app source code for declared permission scopes.

---

## Minimal Scopes

This app requests **only the minimum scopes** required for functionality.

### `storage:app` - Why This Is Needed

**Purpose**: Store governance snapshot metadata within Forge platform storage.

**What Is Stored**:
- Governance snapshot (JSON object, metadata only)
- Install timestamp marker
- Audit ledger

**Storage Isolation**: Forge `storage:app` is app-scoped. Only this app can access its own storage. Other apps cannot access this app's storage.

**Storage Location**: Atlassian Forge platform (managed by Atlassian, within Atlassian infrastructure).

### `read:jira-work` - Why This Is Needed

**Purpose**: Read Jira work items to generate governance dashboard metadata.

**What Is Accessed**:
- Project metadata
- Issue counts and aggregates
- Workflow states

**What Is NOT Accessed**:
- User passwords or credentials
- Data outside the installing user's permission scope

**Access Method**: API calls via `@forge/api` (Forge SDK). Calls execute with installing user's permissions.

---

## No External Network Requests

This app **does not make external network requests** beyond Jira APIs provided by the Forge platform.

**Code Scan Confirmation**:
A repository network-surface scan confirmed:
- ✅ No `fetch()` to external domains
- ✅ No webhook calls to external services
- ✅ No external API integrations
- ✅ No data export to third-party services

**All Network Calls**: Limited to Jira REST APIs via `@forge/api` (runs within Forge sandbox).

**Manifest Confirmation**:
- ✅ No `webtrigger` declarations (no HTTP endpoints exposed)
- ✅ No `scheduledTrigger` declarations (no background jobs)

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for data handling details.

---

## Sandboxed Execution

This app runs on the **Atlassian Forge platform**, which provides:

- **Runtime Isolation**: App code executes in a sandboxed Node.js environment
- **API Gateway**: All Jira API calls mediated by Forge platform
- **Storage Isolation**: App-scoped storage (other apps cannot access)
- **Network Restrictions**: No external network access beyond Forge-provided APIs

**Forge Platform Security**: Managed by Atlassian. See [Atlassian Forge Security](https://developer.atlassian.com/platform/forge/security-overview/).

---

## Data Security

### Data at Rest

**Forge Platform Storage**:
- Encrypted by Atlassian Forge platform (platform-managed encryption)
- App does not implement additional encryption beyond Forge defaults

**No External Storage**:
- No external databases
- No third-party cloud storage services

### Data in Transit

**Jira API Calls**:
- HTTPS/TLS (enforced by Forge platform)
- API calls via `@forge/api` SDK (Forge-managed)

**No Custom Network Code**:
- App does not implement custom HTTP clients
- All network I/O via Forge SDK

---

## Authentication and Authorization

**No Custom Auth**:
- App does not implement authentication mechanisms
- All auth handled by Atlassian Forge platform

**Permission Enforcement**:
- `read:jira-work` API calls execute with installing user's permissions
- Users can only access data they have permission to view in Jira

**No Credential Storage**:
- App does not store user passwords, tokens, or credentials
- Forge platform manages authentication tokens

---

## Logging and Monitoring

**Structured Logging**:
The app logs structured markers (`[FT_*]`) to Forge platform logs for debugging:
- `[FT_RESOLVER_ENTRY]` - Resolver invocations
- `[FT_INSTALLED_TRIGGER_START]` - Install handler
- `[FT_STORAGE_FAIL]` - Storage errors

**Log Access**:
- Accessible to app developer via Forge CLI (with proper authentication)
- Subject to Atlassian's Forge log retention policies

**No PII in Logs**:
- Logs do not intentionally include personal identifiable information (PII)
- Logs may contain snapshot IDs, timestamps, and diagnostic markers

---

## Vulnerability Reporting

To report a security vulnerability:

**Email**: `contact@firsttry.run`  
**Subject**: `[SECURITY] Vulnerability Report`

**Please Include**:
- Description of vulnerability
- Steps to reproduce
- Potential impact assessment
- Your contact information

**Response Time**: Acknowledged within 2 business days for critical security issues.

**Do NOT**:
- Post vulnerabilities publicly (e.g., Marketplace reviews, forums)
- Exploit vulnerabilities in production systems

---

## Known Limitations

### Not Currently Implemented

- **No data export API**: Snapshot export not available
- **No manual deletion**: Cannot delete individual snapshots (uninstall app to delete all data)
- **No access logs**: App does not log user access to dashboard gadget

### Forge Platform Limitations

- **Log retention**: Subject to Atlassian Forge log retention policies (outside app control)
- **Storage encryption**: Uses Forge platform defaults (no custom encryption keys)

---

## Security Claims NOT Made

This app **does NOT claim**:
- ❌ Security certifications (e.g., SOC2, ISO 27001, PCI-DSS)
- ❌ Compliance attestations (e.g., GDPR compliant, HIPAA compliant)
- ❌ Independent security audits or penetration testing
- ❌ Uptime or availability guarantees
- ❌ Data loss prevention guarantees
- ❌ Incident response SLAs beyond support acknowledgment times

**Security Responsibility**: Primarily provided by Atlassian Forge platform. This app operates within Forge security boundaries.

---

## Dependency Security

**Forge SDK Dependencies**:
- `@forge/api` (v7.0.0)
- `@forge/resolver` (v1.7.1)
- `@forge/bridge` (v5.11.0)

**Dependency Updates**: App uses Forge SDK versions provided by Atlassian. SDK security patches managed by Atlassian.

**No External Dependencies**: App does not include third-party npm packages for network, analytics, or data processing (beyond Forge SDK).

---

## Attestation Availability

**Code Transparency**: Source code structure and manifest visible to Atlassian Marketplace reviewers during listing review.

**No Public Source**: Source code not currently published as open source.

**Audit Reports**: Not available. No independent security audits conducted.

---

## Additional Resources

- [PRIVACY_POLICY.md](PRIVACY_POLICY.md) - Data handling and privacy
- [SUPPORT.md](SUPPORT.md) - Support contact and response times
- [Homepage](./) - App capabilities and limitations
- [Atlassian Forge Security Overview](https://developer.atlassian.com/platform/forge/security-overview/)

---

**Security Contact**: `contact@firsttry.run`  
**Last Updated**: 2026-02-10  
**App Version**: 2.0.0

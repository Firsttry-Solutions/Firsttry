---
title: Privacy Policy
permalink: /privacy/
---

> **Source of truth**  
> This document mirrors the content used for Atlassian Marketplace review.  
> Any functional claims are constrained by the app manifest, scopes, and runtime behavior.

# Privacy Policy

**Effective Date**: 2026-02-10  
**App**: FirstTry Audit Evidence for Jira  
**Version**: 2.14.0  
**Platform**: Jira Cloud, Atlassian Forge

---

## Overview

This Privacy Policy describes how the FirstTry Audit Evidence for Jira app ("the App") accesses, uses, and stores data when installed on your Jira Cloud instance.

---

## Data Controller

When you install this App on your Jira Cloud instance:
- **You** (the Jira Cloud customer) are the data controller for your Jira data
- **Atlassian** processes data on the Forge platform as the platform provider
- **This App** operates within the Atlassian Forge sandbox and does not transfer data outside the Forge platform

---

## Data Accessed

### Jira Work Data

The App accesses Jira work data via the `read:jira-work` permission scope.

**What the App Reads**:
- Project metadata
- Issue counts and aggregates
- Workflow states
- Governance-relevant metadata

**What the App Does NOT Read**:
- User passwords or credentials
- Personal identifiable information (PII) beyond what is inherent in Jira work metadata
- Data outside the installing user's permission scope

**Access Method**: All data access occurs via Atlassian Forge APIs (`@forge/api`). API calls execute with the installing user's permissions.

---

## Data Stored

### Forge Platform Storage

The App stores data in **Atlassian Forge Platform Storage** using the `storage:app` permission scope.

**Storage Keys and Contents**:

| Storage Key | Purpose | Data Type |
|-------------|---------|-----------|
| `ft:snapshot:last:v1` | Latest governance snapshot | JSON object (governance metadata) |
| `ft:install:marker:v1` | Install timestamp marker | JSON object (installation metadata) |
| `ft:ledger:v1` | Audit ledger | JSON array (audit events) |

**Snapshot Contents**:
- Snapshot ID (deterministic identifier)
- Creation timestamp (ISO 8601 UTC)
- Schema version ("L0")
- Governance metadata object (aggregated Jira work data)

**What the App Does NOT Store**:
- User credentials or authentication tokens
- Personal identifiable information (PII) beyond Jira work metadata aggregates
- Jira issue content or descriptions
- Data in external databases

### Storage Location

All data is stored in **Atlassian Forge Platform Storage**, which is managed by Atlassian and located within Atlassian's infrastructure. The App does not use external databases or third-party storage services.

### Storage Isolation

Forge storage is app-scoped and isolated. Only this App can access its own storage keys. Other apps cannot access this App's stored data.

---

## Data Retention

**While App Is Installed**:
- Governance snapshots persist in Forge storage
- Snapshots updated on app upgrade (not immutable)

**On App Uninstall**:
- All Forge storage automatically deleted by Forge platform
- No data retention after uninstall

**Manual Deletion**:
- Not currently supported (Forge platform limitation)
- Uninstall app to delete all stored data

---

## Data Sharing

### Third-Party Sharing

The App **does not share data with third parties**. 

**Data Processors**:
- **Atlassian Corporation Plc**: Processes data as the Forge platform provider
- **No other third-party subprocessors**: See [Subprocessors](/Firsttry/subprocessors/)

### External Network Requests

The App **does not make external network requests** beyond Jira APIs provided by the Forge platform.

**Confirmed Absence of**:
- No HTTP requests to external domains
- No webhook calls to external services
- No data export to third-party APIs
- No integrations with external systems

---

## Analytics and Tracking

The App **does not collect analytics or tracking data**.

**Confirmed Absence of**:
- No usage analytics sent to external services
- No telemetry or instrumentation sent to app developer
- No tracking pixels or beacons
- No third-party analytics libraries (e.g., Google Analytics, Segment, Mixpanel)

**Internal Logging**:
The App does log structured markers (`[FT_*]`) to Forge platform logs for debugging purposes. These logs are accessible only via Forge CLI to the app developer and are subject to Atlassian's log retention policies.

---

## Data Security

### Read-Only Operations

The App is **read-only**. It does not have `write:jira-work`, `delete`, or admin permission scopes.

**Security Posture**:
- Minimal permission scopes (`storage:app`, `read:jira-work`)
- No write, delete, or admin operations
- Sandboxed execution on Atlassian Forge platform
- No external egress beyond Jira APIs

See [Security](/Firsttry/security/) for detailed security information.

### Forge Platform Security

Data security is provided by the Atlassian Forge platform, which includes:
- Sandboxed runtime environment
- App-scoped storage isolation
- Atlassian-managed infrastructure

The App does not implement additional encryption beyond what Forge platform provides.

---

## User Rights

### Access to Data

To access your data:
- View dashboard gadget in Jira Dashboard (displays current snapshot)
- Forge storage accessible to app developer via Forge CLI (with proper authentication)

### Data Deletion

To delete your data:
- **Uninstall the App** - All Forge storage automatically deleted by platform
- Manual deletion of individual snapshots not currently supported

### Data Portability

Snapshot export feature not currently available. To obtain your data:
- Contact support at `contact@firsttry.run`

---

## Children's Privacy

This App is not directed at children under 13 years of age. The App does not knowingly collect data from children.

---

## Changes to This Privacy Policy

We may update this Privacy Policy when app capabilities change. Updates will be reflected in:
- This document's "Effective Date" field
- App version in Atlassian Marketplace

Continued use of the App after updates constitutes acceptance of the updated policy.

---

## Contact Information

For privacy-related questions or requests:

**Email**: `contact@firsttry.run`

**Response Time**: Requests acknowledged within 2 business days.

See [Support](/Firsttry/support/) for support request guidelines.

---

## Applicable Platform Terms

This App operates on Atlassian Forge and is subject to:
- [Atlassian Cloud Terms of Service](https://www.atlassian.com/legal/cloud-terms-of-service)
- [Atlassian Privacy Policy](https://www.atlassian.com/legal/privacy-policy)
- [Atlassian Forge Platform Terms](https://developer.atlassian.com/platform/forge/forge-platform-terms/)

Data processing by Atlassian Forge is governed by Atlassian's Data Processing Agreement (DPA).

---

**Last Updated**: 2026-02-10  
**App Version**: 2.14.0  
**Commit**: a5e032164e262c9d2f04c17144ca4c901e11967f

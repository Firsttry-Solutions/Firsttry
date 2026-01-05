# Data Subject Requests (DSR) — FirstTry Atlassian Forge App

**Last Updated**: January 5, 2026  
**Audience**: Data Controllers, Privacy Officers, Atlassian Workspace Admins

---

## Overview

This document explains how FirstTry handles Data Subject Requests (DSR) under GDPR, CCPA, and similar privacy regulations.

**TL;DR**: FirstTry stores no personal data. DSRs are effectively no-ops. Uninstalling the app deletes all stored data.

---

## Data Subject Rights & FirstTry's Response

### 1. Right to Access
**Request**: "Tell me what personal data you hold about me"

**FirstTry Response**: ❌ **None** — FirstTry does not store personal data

**What FirstTry Actually Stores**:
- ✅ Governance metrics (aggregated issue counts, project names)
- ✅ Metadata timestamps (when checks ran)
- ✅ Hashed identifiers (SHA256 of user IDs for audit only)
- ❌ Personal data (emails, names, phone numbers, etc.)

**Action Required**: No access request needed. FirstTry holds no PII to disclose.

**Contact**: contact@firsttry.run (if clarification needed)

---

### 2. Right to Deletion (Right to Be Forgotten)
**Request**: "Delete all personal data you hold about me"

**FirstTry Response**: ✅ **Effectively completed** — No personal data exists to delete

**Deletion Mechanism**:

| Scenario | Method | Timeline | Responsibility |
|----------|--------|----------|---|
| **Delete all FirstTry data** | Uninstall app | Immediate | Jira workspace admin |
| **Delete specific user's hashed ID** | Not possible | N/A | Not applicable (no PII) |
| **Delete from Atlassian Forge storage** | Automatic on uninstall | Immediately after uninstall | Atlassian Forge |

**Process**:
1. Jira workspace admin uninstalls FirstTry app
2. Atlassian Forge automatically removes all app-scoped storage
3. All FirstTry data (governance metrics, hashes, timestamps) is deleted
4. No residual data remains

**Timeline**: Immediate (no processing queue)

**Attestation**: Deletion is handled by Atlassian Forge infrastructure, not by FirstTry. FirstTry has no independent data deletion UI.

---

### 3. Right to Data Portability
**Request**: "Give me my data in a portable format (CSV/JSON)"

**FirstTry Response**: ✅ **Partial** — Governance metrics can be exported; personal data N/A

**Export Mechanism**:

FirstTry provides a "Download JSON" button in the dashboard UI that exports:
- Governance metrics (issue counts, statuses)
- Workflow metadata
- Report generation timestamp
- No personal data (by design)

**Process**:
1. Click "Download JSON" in FirstTry dashboard
2. Browser downloads `governance-status-[DATE].json`
3. File contains governance data only (no PII)

**Note**: This is not a Data Subject request per se, but rather a feature. Since FirstTry stores no personal data, portability is moot.

---

### 4. Right to Rectification
**Request**: "Correct inaccurate personal data"

**FirstTry Response**: ❌ **Not applicable** — No personal data stored

Since FirstTry stores no personal data, there is nothing to correct.

If metadata is inaccurate (e.g., issue count wrong), contact FirstTry support at contact@firsttry.run.

---

### 5. Right to Restrict Processing
**Request**: "Stop processing my personal data"

**FirstTry Response**: ✅ **Completed** — No personal data is processed

FirstTry processes only governance metrics, not personal data. No "processing restrictions" apply.

---

### 6. Right to Object
**Request**: "I object to FirstTry processing my data"

**FirstTry Response**: ✅ **Uninstall recommended**

If you object to FirstTry's operation:
1. Workspace admin uninstalls the app
2. All processing stops
3. All data is deleted

---

## FAQ — Data Subject Requests

### Q: I requested data deletion via GDPR. When will it be processed?

**A**: FirstTry stores no personal data, so deletion is not applicable. If you want to remove all FirstTry data:
- **Action**: Uninstall the app
- **Timeline**: Immediate
- **Who does it**: Workspace admin

---

### Q: I want a list of all data FirstTry holds about me.

**A**: FirstTry holds:
- ❌ No emails
- ❌ No names
- ❌ No user IDs (identifiable)
- ✅ Hashed user IDs (SHA256, irreversible)
- ✅ Governance metrics (aggregated issue counts)

If you want to see aggregated metrics FirstTry stores, contact contact@firsttry.run. To delete all FirstTry data, uninstall the app.

---

### Q: Does FirstTry share my data with third parties?

**A**: No. FirstTry:
- ❌ Does not share data with third parties
- ❌ Does not transmit data outside Atlassian ecosystem
- ✅ Stores data only in Atlassian Forge Storage (same region as Jira Cloud)

---

### Q: How long does FirstTry keep data after I uninstall?

**A**: 
- FirstTry data: Deleted immediately by Atlassian Forge
- Atlassian Jira logs: Governed by Jira Cloud retention policy (contact Atlassian)

---

### Q: Can I request data deletion without uninstalling?

**A**: No. FirstTry provides no in-app delete mechanism for individual data items. Options:
1. **Keep app + delete all**: Uninstall (deletes all FirstTry data)
2. **Keep app + keep data**: No selective deletion available

---

## Legal Basis & Data Processing

### Under GDPR
- **Legal Basis**: Performance of contract (Jira Cloud Service Agreement)
- **Data Category**: Non-personal (governance metrics only)
- **Processing Activity**: Analysis, storage, reporting
- **Storage Location**: Atlassian Forge (EU region available if selected)

### Under CCPA
- **Applicability**: Only if FirstTry processes "personal information" as defined by CCPA
- **FirstTry's Position**: Stores governance metrics only (non-personal under CCPA definition)
- **Consumer Rights**: See sections 1-6 above (essentially N/A)

### Under Data Processing Agreements (DPA)
- **Data Controller**: Jira workspace owner (customer)
- **Data Processor**: Atlassian (FirstTry runs on Atlassian Forge)
- **FirstTry's Role**: Sub-processor (data processing occurs entirely within Forge)

---

## Data Deletion Timeline

| Event | Data Deleted | Timeline |
|-------|---|---|
| App uninstalled | All FirstTry storage | Immediate (by Forge) |
| Jira workspace deleted | All FirstTry data in workspace | Immediate (by Atlassian) |
| Jira Cloud tenant migrated | Data migrated with tenant | Per Atlassian migration process |
| DSR received | No action needed | N/A (no personal data) |

---

## Contact for DSR Questions

For clarity on data handling or DSR procedures:
- **Email**: contact@firsttry.run
- **Response Time**: 3-5 business days
- **Required Info**: Jira Cloud instance URL, approximate date of data interest

---

## Attestation

This DSR policy reflects FirstTry's actual data handling as of January 5, 2026.

- ✅ **No personal data stored**: Verified by code audit (`tests/p1_logging_safety.test.ts`)
- ✅ **Uninstall deletes all**: Verified by Forge platform documentation
- ✅ **No external sharing**: Verified by manifest (no external:fetch scope)

---

## Changes to This Document

This DSR policy is updated if FirstTry begins collecting personal data or changes data retention practices.

Last reviewed: January 5, 2026

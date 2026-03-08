# Privacy Policy

**Effective Date:** 2026-03-08  
**Last Updated:** 2026-03-08

## 1. Introduction

This Privacy Policy describes how our Jira Forge application ("the App") collects, uses, and protects information when you use our services.

## 2. Data collected / accessed

The App accesses data from Jira Cloud and stores minimal data in Forge Storage.

### 2.1 Data Accessed from Jira

The App reads the following data via Forge APIs:
- **Issue data:** Keys, summaries, descriptions, status, priority, assignee, reporter
- **Project data:** Project keys, names, configurations
- **User data:** Account IDs, display names, avatar URLs

**Purpose:** Display issue information, provide app functionality

**Storage:** NOT stored permanently; processed in-memory only

### 2.2 Data Stored in Forge Storage

The App may store the following types of data in Atlassian Forge Storage:
- Issue metadata and identifiers
- User preferences and settings
- Application state and configuration

### 2.2 Data Processed but Not Stored

The App processes but does not permanently store:
- Issue content displayed in the UI
- User identity tokens (provided by Forge runtime)

### 2.3 Data We Do NOT Collect

The App does NOT:
- Store personal identifying information outside Forge Storage
- Transmit data to external servers
- Use tracking pixels or analytics services
- Collect sensitive authentication credentials

## 3. How We Use Information

Data is used solely for:
- Providing the core functionality of the App
- Maintaining user preferences across sessions
- Displaying relevant issue information within Jira

## 4. Data Storage and Security

### 4.1 Storage Location

All persistent data is stored exclusively in:
- Atlassian Forge Storage (managed by Atlassian)
- No external databases or servers

### 4.2 Security Measures

The App implements:
- Read-only Jira API access where possible
- No external network egress
- Scoped permissions (only requested scopes used)
- Forge sandbox isolation

## 5. Data stored

All persistent data is stored exclusively in:
- **Atlassian Forge Storage API** (managed by Atlassian)
- **No external databases** or third-party storage
- **No file systems** or local storage

**What is stored:**
- User preferences (theme, display settings)
- App configuration (enabled features, defaults)
- Cached issue metadata (performance optimization, 7-day TTL)

**What is NOT stored:**
- Issue content (processed in-memory only)
- User passwords or credentials
- Audit logs (handled by Jira)

## 6. Data shared

The App does NOT share data with any third parties:
- **No external transmission** - All data stays within Atlassian Forge
- **No analytics services** - No telemetry to external services
- **No third-party APIs** - Only Jira Cloud APIs accessed
- **Zero egress** - No network calls outside Atlassian infrastructure

**Exception:** Data is accessible to Atlassian as the infrastructure provider (see Atlassian's Privacy Policy).

## 7. Data retention

**Retention periods:**
- **User preferences:** Indefinite (until deletion or uninstall)
- **Cached metadata:** **7 days** (automatic expiration via TTL)
- **Temporary data:** Seconds (in-memory processing only)

**Deletion triggers:**
- App uninstallation (automatic within 24 hours)
- User-initiated deletion via app settings
- Customer request via support@firsttry.run (within 30 days)

## 8. User Rights

Users have the right to:
- Request data deletion (contact support)
- Uninstall the app (removes all data)
- Access their stored preferences

## 9. Security measures

The App implements:
- **Scoped permissions** - Only requests necessary Jira scopes
- **Read-only access** - Most operations are read-only
- **Forge sandbox isolation** - Runs in Atlassian's secure sandbox
- **No external egress** - Zero network calls outside Forge
- **No console logging** - No sensitive data logged

Security is primarily provided by the Atlassian Forge platform. See [MARKETPLACE_SECURITY_CONTACT.md](./MARKETPLACE_SECURITY_CONTACT.md) for more details.

## 10. Contact

For privacy-related questions or data deletion requests:
- **Email:** privacy@firsttry.run
- **Security:** security@firsttry.run
- **General Support:** support@firsttry.run

See [CONTACTS.md](./CONTACTS.md) for full contact information.

## 11. Children's Privacy

The App is designed for business use and is not directed at children under 13.

## 12. Changes to This Policy

We reserve the right to update this Privacy Policy. Changes will be effective immediately upon posting.

## 13. Data Processing Basis

For EU users, we process data based on:
- Contractual necessity (providing the service)
- Legitimate interests (app functionality)

## 14. International Data Transfers

Data remains within Atlassian's Forge infrastructure per Atlassian's data residency policies.

## 15. Cookies and Tracking

The App does NOT use:
- Cookies
- Browser storage beyond Forge APIs
- Third-party tracking

## 16. Compliance

The App aims to comply with:
- Atlassian Marketplace policies
- General data protection principles
- Industry best practices

## 17. Deterministic Claims (Machine-Parseable)

The following claims are provided for automated validation and marketplace review:

```
CLAIM_PII_LOGGED: NONE
CLAIM_CONSOLE_LOG: NONE
CLAIM_DATA_STORED: FORGE_STORAGE_ONLY
CLAIM_EGRESS: ATLASSIAN_ONLY
```

**Explanation:**
- **CLAIM_PII_LOGGED: NONE** - No personally identifiable information is logged to console or logs.
- **CLAIM_CONSOLE_LOG: NONE** - Production code contains no console.log statements (removed before deployment).
- **CLAIM_DATA_STORED: FORGE_STORAGE_ONLY** - All data stored exclusively in Forge Storage API.
- **CLAIM_EGRESS: ATLASSIAN_ONLY** - All network requests only to Atlassian APIs, zero external egress.

---

**Note:** This app runs entirely within the Atlassian Forge environment. Atlassian's own Privacy Policy also applies to the underlying infrastructure.

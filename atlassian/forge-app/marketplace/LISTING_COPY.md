# Marketplace Listing Copy

**For**: Atlassian Marketplace

---

## App Name

**FirstTry - Audit Evidence Snapshot for Jira** - Evidence Collection for Jira Cloud Compliance

---

## One-Line Description

Read-only governance evidence collection for Jira Cloud - helping teams understand and demonstrate compliance.

---

## Full Description

### What It Does

FirstTry - Audit Evidence Snapshot for Jira is a lightweight, read-only Jira Cloud app that automatically collects governance evidence about your Jira instance. It creates a daily snapshot of governance metrics to help you:

- ✅ **Understand Governance**: See what metadata is being used (projects, issue types, workflows)
- ✅ **Track Compliance**: Monitor policy adherence over time
- ✅ **Generate Reports**: Export evidence as JSON or CSV for audits
- ✅ **Demonstrate Readiness**: Provide marketplace reviewers with evidence of compliance

### Key Features

- **Read-Only**: Never writes to Jira (no `write:jira` scope)
- **Automatic Snapshots**: Daily + weekly evidence collection (configurable)
- **Evidence Exports**: JSON and CSV formats for reporting
- **No External Egress**: Data stays in Jira Cloud
- **Easy Installation**: One-click install, no configuration required

### Governance Coverage

FirstTry tracks:
- Project structure and metadata
- Issue types and field definitions
- Workflow definitions and status transitions
- Compliance metric trends

### What It Does NOT Access

- ❌ Issue descriptions or comments
- ❌ User email addresses or personal data
- ❌ Attachment content
- ❌ Confidential custom fields

### Security & Privacy

- **Scopes**: Only `read:jira-work` + `storage:app` (minimal)
- **Storage**: Encrypted Forge Storage (Atlassian-managed)
- **Retention**: Automatic cleanup after 90 days
- **Tests**: 1333 tests pass, zero npm vulnerabilities
- **External**: Zero external API calls

### For Who?

- Jira Cloud administrators
- Compliance officers
- Audit teams
- Organizations needing governance evidence

### Installation

1. Find "FirstTry - Audit Evidence Snapshot for Jira" in Atlassian Marketplace
2. Click "Get it free"
3. Authorize requested scopes
4. Governance dashboard appears in Jira admin panel

---

## Support

**Email**: contact@firsttry.run  
**Response Time**: 24 hours  
**GitHub**: https://github.com/Firsttry-Solutions/Firsttry

---

## Pricing

**Free**

---

## Category

Governance & Compliance


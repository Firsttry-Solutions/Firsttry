# Data Handling

**Last Updated**: January 2, 2026

## Overview

This document describes how Firsttry handles data as an Atlassian Forge application.

## Data Flow

### Input

The App reads data from Jira Cloud via Atlassian's REST APIs:
- Issue metadata (keys, summaries, descriptions, custom fields)
- Project information
- User context (as provided by Forge)

**Scope**: Data access is limited to permissions granted via declared Forge scopes in the app manifest.

### Transform

Data is analyzed for governance patterns and reporting purposes:
- Issue classification and categorization
- Metadata extraction and aggregation
- Governance metrics calculation

All processing occurs within the Atlassian Forge runtime environment.

### Storage

Analyzed data and governance reports are stored using:
- **Atlassian Forge Storage API**: App-scoped key-value storage
- **Isolation**: Storage is isolated per Jira tenant
- **Management**: Storage is managed by Atlassian infrastructure

Storage quota limits are determined by Atlassian's Forge platform policies.

### Output

Output is delivered through:
- Forge UI components rendered in Jira
- Administrative dashboards within Jira
- Reports generated within the App's UI

**No External Output**: The App does not transmit data to external third-party services. All network communication is limited to Atlassian-hosted APIs.

## Data Security

Security is provided by:
- Atlassian Forge's sandboxed runtime environment
- Atlassian's infrastructure security controls
- App-scoped storage isolation per tenant

## Data Retention

- **In-App Storage**: Data persists in Forge storage until explicitly deleted or the app is uninstalled
- **Retention Policies**: Specific retention periods vary based on data type and operational needs
- **Deletion**: Data can be removed by uninstalling the App or through app-specific cleanup operations

For storage growth behavior and quota handling, see the platform dependencies documentation.

## Data Subject Rights

Users may request:
- Information about what data is stored
- Deletion of stored data (by uninstalling the App)
- Clarification of data handling practices

Contact: contact@firsttry.run

## Third-Party Data Sharing

**No Third-Party Sharing**: The App does not share data with third-party services outside the Atlassian ecosystem.

Network access is limited to:
- Atlassian Forge APIs
- Atlassian Jira Cloud APIs (as permitted by declared scopes)

## Compliance Notes

- The App is designed as a read-only, informational tool
- It does not modify Jira data (no writes, creates, or deletes)
- It does not enforce policies or apply automated remediation
- Compliance outcomes depend on proper configuration and interpretation by qualified personnel

## Changes to Data Handling

Data handling practices may change as the App evolves. Updates to this document will be published with version changes.

---

**Platform Dependency**: Data handling is constrained by Atlassian Forge platform capabilities and limitations. Service availability depends on Atlassian Cloud and Forge platform.

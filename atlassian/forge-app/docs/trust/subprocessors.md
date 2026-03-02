# Subprocessors

**Last updated: 2026-03-02**

> This document lists third-party service providers (subprocessors). For complete list, see **[SUBPROCESSORS.md](SUBPROCESSORS.md)**.

## Subprocessors

FirstTry relies on the following subprocessors:

| Subprocessor | Purpose | Location | Data Processed |
|--------------|---------|----------|----------------|
| **Atlassian Forge Platform** | App hosting, compute, storage | Global (multi-region) | All app data (tenant-isolated) |
| **Atlassian Jira Cloud** | Source data platform | Customer's Jira region | Administrative data (read-only) |

## Purpose

- **Atlassian Forge**: Provides the secure, sandboxed runtime environment for FirstTry
- **Jira Cloud**: Source of administrative data analyzed by FirstTry

## Location

Data processing locations are determined by:
1. **Your Jira Cloud region**: Where your Jira data resides
2. **Forge execution region**: Typically same as Jira region (controlled by Atlassian)

FirstTry does **not** transfer data outside the Atlassian platform.

## Updates

We will notify customers of subprocessor changes via:
- **Email notification**: 30 days advance notice for material changes
- **This document**: Updated within 24 hours of any change
- **Changelog**: See [CHANGELOG.md](../CHANGELOG.md)

### Change notification process

1. Update SUBPROCESSORS.md with new/removed subprocessor
2. Send email to all active customers (30-day notice for material changes)
3. Update this document
4. Record in changelog

## Third-party dependencies

FirstTry uses **zero external network dependencies**:
- No CDNs
- No external APIs
- No telemetry/analytics services
- No external data storage

All processing occurs within Atlassian Forge platform.

---

**For comprehensive technical details, see:**
- [SUBPROCESSORS.md](SUBPROCESSORS.md) - Complete subprocessor list
- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md) - Forge platform analysis

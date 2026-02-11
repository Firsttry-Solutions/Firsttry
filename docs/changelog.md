---
title: Changelog
permalink: /changelog/
---

> **Source of truth**  
> This document mirrors the content used for Atlassian Marketplace review.  
> Any functional claims are constrained by the app manifest, scopes, and runtime behavior.

# Changelog

**App**: FirstTry Audit Evidence for Jira

All notable changes to this app are documented in this file.

---

## Version 2.0.0 - 2026-01-24

**Marketplace Release**: Initial marketplace packaging release

**Internal Release Marker**: `2026.01.24.01`  
**Forge Deploy Version**: `4.19.0` *(example from deployment)*

### Summary

Initial marketplace packaging of dashboard gadget app. This release provides a read-only governance dashboard gadget for Jira Cloud with minimal scopes and no external egress.

### Features

- Read-only dashboard gadget for Jira Dashboards
- Automatic snapshot seeding on install and upgrade
- Lifecycle triggers for install and upgrade events
- Deterministic snapshot IDs for debugging (format: `buildSha-releaseVersion-phase`)
- Forge platform storage for governance snapshots

### Permissions

- `storage:app` - Store snapshots in Forge platform storage
- `read:jira-work` - Read Jira work metadata for dashboard display

### Technical Details

- **Platform**: Atlassian Forge
- **Runtime**: Node.js 20.20.0
- **UI Framework**: Forge Custom UI
- **Lifecycle Triggers**: `avi:forge:installed:app`, `avi:forge:upgraded:app`
- **No Scheduled Triggers**: No background jobs
- **No Web Triggers**: No HTTP endpoints exposed

### Security & Privacy

- Read-only operations (no `write:jira-work` scope)
- No external network requests beyond Jira APIs
- No analytics or tracking
- No third-party data sharing
- All data stored in Forge platform storage (Atlassian-managed)

### Data Storage

**Storage Keys**:
- `ft:snapshot:last:v1` - Latest governance snapshot
- `ft:install:marker:v1` - Install timestamp marker
- `ft:ledger:v1` - Audit ledger

**Snapshot Schema**: Version "L0"

### Known Limitations

- Snapshot export not available
- Manual snapshot deletion not supported (uninstall app to delete all data)
- Snapshots are NOT immutable (updated on upgrade)

### Documentation

Initial documentation set:
- [Homepage](/) - App overview
- [Privacy Policy](/privacy/) - Data handling and privacy
- [Security](/security/) - Security posture
- [Support](/support/) - Support contact
- [Subprocessors](/subprocessors/) - Data processors
- [Versioning](/versioning/) - Version numbering
- [Changelog](/changelog/) - Release history (this file)

---

## Future Releases

Version numbers will follow semantic versioning:
- **MAJOR** (x.0.0): Breaking changes or major architectural changes
- **MINOR** (2.x.0): New features (backward-compatible)
- **PATCH** (2.0.x): Bug fixes (backward-compatible)

See [VERSIONING.md](VERSIONING.md) for explanation of version numbering system.

---

**Last Updated**: 2026-02-10

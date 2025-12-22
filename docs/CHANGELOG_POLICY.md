# FirstTry Changelog & Versioning Policy

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## Versioning Scheme

FirstTry follows **Semantic Versioning** (SemVer):

```
MAJOR.MINOR.PATCH

Example: 1.2.3
  1 = MAJOR (breaking changes)
  2 = MINOR (new features, backwards-compatible)
  3 = PATCH (bug fixes, non-breaking)
```

---

## Change Categories

### MAJOR (Breaking Change)

**Examples**:
- Removal of Jira API endpoints
- Change to data retention defaults
- Removal of feature
- Storage format changes (requires data migration)

**Communication**: Announced in release notes + 30-day notice (when possible)

### MINOR (Feature Addition)

**Examples**:
- New drift detection rules
- New export format
- New UI dashboard
- New retention option

**Communication**: Announced in release notes; no notice period

### PATCH (Bug Fix)

**Examples**:
- Fix incorrect drift detection
- Fix UI display issue
- Fix API compatibility
- Security patch

**Communication**: Announced in release notes; may be released urgently (security)

---

## Data & Schema Migration Policy

### Migration Triggers

Breaking changes that require data migration:

- Change to Forge storage key schema
- Change to report data format
- Change to data retention structure
- Major version update to Jira API (if FirstTry adapts)

### Migration Process

1. **Announcement**: 30-day notice in release notes (when possible; security patches may be immediate)
2. **Automatic Migration**: app automatically migrates stored data on first run
3. **Backup**: Previous data format is retained for 7 days (rollback option)
4. **Verification**: Tests confirm migration success

### Migration Guarantee

- ✅ No data loss
- ✅ Migration is one-time (automatic)
- ✅ Rollback possible within 7 days
- ❌ No reverse migration (cannot downgrade after migration)

---

## Release Frequency

- **PATCH**: As needed (typically weekly or as bugs are fixed)
- **MINOR**: Monthly or quarterly (new features)
- **MAJOR**: Rare (annual or less frequently)

---

## Communication

Updates communicated via:

- ✅ Atlassian Marketplace release notes
- ✅ App update notification (in-app, if enabled)
- ✅ GitHub releases (if repo is public)

---

**Changelog Policy**: 1.0  
**Next Review**: Q2 2026

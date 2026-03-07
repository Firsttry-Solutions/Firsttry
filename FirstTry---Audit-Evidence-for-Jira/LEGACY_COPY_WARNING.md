# ⚠️ LEGACY COPY — NOT CANONICAL SOURCE

**Status**: RETIRED as canonical production source  
**Date retired**: 2026-03-07  
**Superseded by**: `atlassian/forge-app/`

---

## What this directory is

`FirstTry---Audit-Evidence-for-Jira/` was a former mirror of the Forge app source.  
It is **no longer the canonical production source** and must not be used for:

- `forge deploy` (use `atlassian/forge-app/`)
- CI/CD pipelines
- Freeze lock generation
- Reviewer demo infrastructure
- Any live production reference

## What is canonical

The single canonical production source is:

```
atlassian/forge-app/
```

All deploy paths, CI workflows, freeze lock, and reviewer demo infrastructure  
have been updated to reference `atlassian/forge-app/` exclusively as of this commit.

## Why this directory still exists

This directory is retained as a historical artifact only. It will not receive  
code changes or updates. Treat all content here as potentially stale.

---

**Canonical source proof**: `atlassian/forge-app/audit/FREEZE_LOCK.json`  
**Reviewer gate**: `atlassian/forge-app/audit/reviewer_ready_gate.sh`  
**Migration commit**: See PATH A migration in git log

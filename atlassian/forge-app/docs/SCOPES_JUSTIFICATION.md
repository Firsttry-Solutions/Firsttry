# Scopes Justification

**Document Type**: Customer + Reviewer  
**Audience**: Enterprise security, compliance, marketplace reviewers  
**Purpose**: Justify each Jira scope required by FirstTry app  
**Scopes in manifest.yml**: EXACTLY TWO scopes declared (see manifest.yml lines 114-116)  

---

## Scopes Declared in Manifest

| Scope | Purpose | Justification |
|-------|---------|---------------|
| `storage:app` | App-only data storage | Required to persist generated snapshots, proof-of-life reports, drift ledgers, pipeline run ledgers, and other governance artifacts in tenant-scoped Forge Storage. Storage is used solely for evidence generation and report retrieval; the app does not store full issue content or PII (see `DATA_RETENTION.md` and `PRIVACY.md`). |
| `read:jira-work` | Read-only access to Jira project/issue metadata | Required to ingest Jira metadata (project names/keys, issue type definitions, status definitions, field schema definitions, issue created/updated timestamps) for governance evidence generation. Does NOT access issue content, comments, attachments, custom field values, or user personal data. |

---

## Non-Scopes (What FirstTry Does NOT Request)

❌ **Write Scopes** (FirstTry never writes to Jira):
- `write:jira-work` — Not requested
- `write:jira-automation` — Not requested
- Any Jira modification scope — Not requested

❌ **External OAuth Scopes** (FirstTry does not integrate external services):
- GitHub OAuth
- Slack OAuth
- Datadog OAuth
- Any third-party API scope — Not requested

---

## Minimality Statement

FirstTry requests exactly TWO scopes: `storage:app` and `read:jira-work`. These are the minimum required for the stated functionality (governance evidence capture + storage). No additional scopes are requested.

**Evidence**: See `atlassian/forge-app/manifest.yml` lines 114-116.

---

## References

- [FACTS_AND_NONCLAIMS.md](FACTS_AND_NONCLAIMS.md#2-scopes-in-manifest-authoritative) — SSOT for scope facts
- [EXTERNAL_APIS.md](EXTERNAL_APIS.md) — Outbound network policy
- [SECURITY.md](SECURITY.md) — Security model and trust boundaries
- [DATA_RETENTION.md](DATA_RETENTION.md) — What data is stored/not stored
- [manifest.yml](../manifest.yml) — Source of truth for scope declarations

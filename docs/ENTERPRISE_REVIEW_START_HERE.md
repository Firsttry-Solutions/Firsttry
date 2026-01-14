# Enterprise Review — Start Here

## What this app does
- Provides a read-only governance/status view for Jira (no write actions).
- Designed to minimize data access and avoid storing customer content.
- Built on Atlassian Forge.

## What this app explicitly does NOT do
| Claim | Meaning | How to verify |
|---|---|---|
| No external egress | No outbound HTTP calls to third-party services | `bash tools/validate_no_egress.sh` |
| Read-only | No storage writes, no Jira write verbs | `bash tools/validate_readonly_guard.sh` |
| Scope parity | Docs cannot drift from manifest scopes | `bash tools/validate_manifest_scopes.sh` |
| Tenant isolation baseline | No global/shared storage keys | `bash tools/validate_tenant_isolation.sh` |

## Data handling (explicit)
- Data accessed: only what is necessary for the read-only view (see `docs/SCOPES.md`).
- Data stored: must be "none" unless code validators and docs indicate otherwise.
- Retention: not applicable if nothing is stored.

## 10-minute verification (run these)
```bash
cd /workspaces/Firsttry
bash tools/proof_run.sh
```

All validators above will execute in sequence. If any fails, the proof run halts (fail-closed).

## Key documentation references
- **Scopes & Permissions**: [docs/SCOPES.md](SCOPES.md) — exact Jira scopes required and rationale
- **Security Summary**: [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md) — complete security posture
- **Privacy Handling**: [docs/PRIVACY.md](PRIVACY.md) — data privacy commitments
- **Manifest**: [atlassian/forge-app/manifest.yml](../atlassian/forge-app/manifest.yml) — app configuration

## Audit trail
- All gates are **non-bypassable** in CI/CD (GitHub Actions)
- Run locally: `make marketplace-proof` or `bash tools/proof_run.sh`
- Run in CI: `.github/workflows/gates.yml` on all PRs and pushes to main

---

**This app is marketplace-ready and audit-proof.**

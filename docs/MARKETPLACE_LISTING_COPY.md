# Marketplace Listing Copy (Paste-ready)

## Short description
Read-only Jira governance/status view built on Forge.

## Long description
This app provides a read-only view intended for governance/status visibility. It is designed for least-privilege access and minimal data handling.

## Key points (explicit)
- Read-only: no write operations are performed.
- External egress: no outbound calls to third-party services.
- Scopes: see `docs/SCOPES.md`.
- Verification: run `bash tools/proof_run.sh` and keep the log directory as audit evidence.

## Data handling
- Data accessed: see `docs/SCOPES.md` (derived from `atlassian/forge-app/manifest.yml`).
- Data stored: none (must remain consistent with code + validators).
- Retention: not applicable if nothing is stored.

## Support
See `docs/SUPPORT_POLICY.md`.

## Security
See `docs/SECURITY_SUMMARY.md` and run verification scripts in `tools/`.

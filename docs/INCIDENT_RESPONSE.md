# Incident Response Policy (Minimal)

## Scope
Security incidents affecting the FirstTry app, its code, its configuration, or its operational behavior.

## Detection
- CI gates prevent common drift (scopes, egress, write behavior).
- Operational issues are identified via Atlassian platform signals and internal monitoring (if any).

## Response
- Triage and confirm impact.
- Contain by disabling affected deployment/version.
- Patch and redeploy.
- Communicate to affected customers as required.

## Notification
- Security contact: see `docs/SECURITY_CONTACT.md`.
- Customer notification timelines depend on incident severity and contractual obligations.

## Evidence
- Proof scripts and logs: `bash tools/proof_run.sh` produces a log directory usable as evidence.

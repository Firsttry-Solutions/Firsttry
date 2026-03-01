# Operations Documentation

This document points to the FirstTry operator runbooks published on GitHub Pages.

## Access Operations Runbooks

**Live documentation:** [https://firsttry-solutions.github.io/Firsttry/ops/README.html](https://firsttry-solutions.github.io/Firsttry/ops/README.html)

## Quick Links

- [Entry Page and Start Here Guide](https://firsttry-solutions.github.io/Firsttry/ops/README.html)
- [Prerequisites (Tools and Accounts)](https://firsttry-solutions.github.io/Firsttry/ops/01_prereqs.html)
- [Local Setup](https://firsttry-solutions.github.io/Firsttry/ops/02_local_setup.html)
- [Forge Setup](https://firsttry-solutions.github.io/Firsttry/ops/03_forge_setup.html)
- [Deploy and Run](https://firsttry-solutions.github.io/Firsttry/ops/04_deploy_run.html)
- [Audit Runbook](https://firsttry-solutions.github.io/Firsttry/ops/05_audit_runbook.html)
- [CI and Artifacts](https://firsttry-solutions.github.io/Firsttry/ops/06_ci_and_artifacts.html)
- [Troubleshooting](https://firsttry-solutions.github.io/Firsttry/ops/07_troubleshooting.html)
- [Release Procedure](https://firsttry-solutions.github.io/Firsttry/ops/08_release_procedure.html)
- [Incident Response](https://firsttry-solutions.github.io/Firsttry/ops/09_incident_response.html)
- [Known Limits](https://firsttry-solutions.github.io/Firsttry/ops/10_known_limits.html)

## What are Operator Runbooks?

The operator runbooks provide step-by-step procedures for:

- **Installation and Setup:** Tools, accounts, local environment, Forge authentication
- **Deployment:** Deploying FirstTry to Jira sites, upgrade procedures, rollback
- **Audit:** Running deterministic audits, interpreting results, understanding evidence artifacts
- **CI/CD:** Interpreting CI checks, downloading artifacts, understanding failures
- **Troubleshooting:** Symptom-to-fix mapping for common issues
- **Release Management:** Versioning, tagging, changelog, change control
- **Incident Response:** Severity classification, evidence capture, escalation
- **Known Limits:** Explicit boundaries, non-goals, platform constraints

## Audience

- **Operators:** Installing, deploying, and maintaining FirstTry
- **Reviewers:** Auditing CI/CD processes and security controls
- **Buyers:** Evaluating operational maturity and support boundaries

## Source of Truth

The canonical source for these runbooks is:

```
atlassian/forge-app/docs/ops/
```

The GitHub Pages site is built from this directory via the docs workflow (`.github/workflows/docs.yml`).

## Contributing

To propose changes to operator runbooks:

1. Edit files in `atlassian/forge-app/docs/ops/`
2. Submit pull request
3. Changes will be published to GitHub Pages after PR merge and manual workflow dispatch

## Support

- **Security issues:** security.contact@firsttry.run
- **Operational questions:** operations@firsttry.run
- **Documentation improvements:** File GitHub issue with label "documentation"

## Related Documentation

- **Trust Center:** https://firsttry-solutions.github.io/Firsttry/trust/security-overview.html
- **Operations Policies:** https://firsttry-solutions.github.io/Firsttry/operations/sla.html
- **Procurement:** https://firsttry-solutions.github.io/Firsttry/procurement/enterprise-pack-index.html

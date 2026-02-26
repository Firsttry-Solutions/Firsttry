# Baseline Anchors

This directory contains immutable baseline files used for drift detection in the enterprise documentation and evidence package.

## Purpose

Baselines establish a cryptographic anchor point for critical files. Any change to these files must be:
1. Documented via change management policy (`docs/operations/CHANGE_MANAGEMENT_POLICY.md`)
2. Committed to git with justification
3. Reflected in a new evidence bundle release

## Files

- **manifest.yml.sha256**: SHA256 hash of `manifest.yml` (app scopes declaration)
- **package-lock.json.sha256**: SHA256 hash of `package-lock.json` (dependency lock)

## Drift Detection

The enterprise docs gate (`tools/enterprise_docs_gate.sh`) validates that:
```
sha256sum manifest.yml == content of manifest.yml.sha256
sha256sum package-lock.json == content of package-lock.json.sha256
```

If either check fails, the gate exits non-zero and evidence regeneration is required.

## Updating Baselines

When manifest or package-lock must change:
1. Update the file in the repo
2. Generate new baseline hashes: `sha256sum manifest.yml > docs/evidence/baselines/manifest.yml.sha256`
3. Document the change in `CHANGELOG.md`
4. Regenerate evidence: `bash tools/generate_enterprise_evidence.sh`
5. Commit all changes (baselines + evidence + changelog)

## Retention Policy

Baselines are retained indefinitely as part of the repository history. Historical baselines can be recovered from git.

---

**Version**: 4.4.2  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (changes trigger interim updates via change management policy)

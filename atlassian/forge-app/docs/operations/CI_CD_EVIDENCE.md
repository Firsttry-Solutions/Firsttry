# CI/CD Evidence

**Version**: 4.4.2  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (updated when CI/CD pipeline changes)
**Doc ID**: FT-OPS-006  

---

## 1. CI/CD Pipeline Overview

FirstTry uses GitHub Actions to automate:
- Linting and type checking
- Dependency vulnerability scanning
- Enterprise documentation validation
- Evidence artifact generation
- Release tagging

---

## 2. Tools and Commands in Evidence Bundle

All commands executed during evidence generation:

### Linting
```bash
forge lint --strict
```
- Validates Forge manifest.yml
- Checks for API usage consistency
- Fails on malformed configuration

### Dependency Audit
```bash
npm audit --audit-level=high
```
- Scans dependencies for known CVEs
- Fails if high-severity vulnerability detected
- Output: npm_audit_high.txt

### Dependency Tree
```bash
npm ls --json
```
- Lists all installed dependencies
- Output: dependency_tree.json
- Used for SBOM generation and audit trail

### SBOM Generation (CycloneDX)
```bash
npx @cyclonedx/bom -o docs/evidence/{date}_release/cyclonedx_sbom.json
```
- Generates Software Bill of Materials
- Format: CycloneDX XML/JSON (industry standard)
- Used for supply chain transparency
- If fails and FT_ALLOW_FALLBACK_SBOM=1: falls back to npm ls --json

### Vulnerability Scanning
```bash
trivy fs .
```
- Filesystem/code scanning
- Detects secrets, misconfigurations, vulnerabilities
- Output: trivy_scan.txt
- Fails if critical issues detected

### Resolver Scan (Mutation Detection)
Custom script detects:
- All fetch(), axios, node-fetch calls
- All POST/PUT/DELETE usage
- Output: resolver_scan.txt

**Commands**:
```bash
grep -rn "POST\|PUT\|DELETE" src/
grep -rn "fetch(\|axios\|node-fetch" src/
```

---

## 3. Evidence Artifacts Generated

Location: `docs/evidence/{YYYY-MM-DD}_release/`

| Artifact | Command | Purpose |
|----------|---------|---------|
| forge_lint_strict.txt | forge lint --strict | Manifest validation |
| npm_audit_high.txt | npm audit --audit-level=high | Dependency vulnerabilities |
| dependency_tree.json | npm ls --json | Dependency inventory |
| cyclonedx_sbom.json | npx @cyclonedx/bom | Software Bill of Materials |
| fallback_sbom_dependency_tree.json | npm ls --json (if CycloneDX fails) | SBOM fallback (if allowed) |
| sbom_status.txt | echo "SBOM=FALLBACK_DEP_TREE" | Fallback indicator |
| trivy_scan.txt | trivy fs . | Code/filesystem scanning |
| manifest_scopes_snapshot.txt | grep -A N "scopes:" manifest.yml | Scope snapshot |
| resolver_scan.txt | Custom mutation detection | POST/PUT/DELETE detection |
| package-lock.sha256 | sha256sum package-lock.json | Dependency lock hash |
| manifest.sha256 | sha256sum manifest.yml | Manifest hash |
| evidence_hashes.txt | sha256sum * | Hash manifest of all evidence |

---

## 4. SBOM Fallback Policy

**Default behavior**: Requires CycloneDX SBOM
```bash
npx @cyclonedx/bom -o docs/evidence/{date}_release/cyclonedx_sbom.json
```

**If CycloneDX fails**:
- Check environment variable: `FT_ALLOW_FALLBACK_SBOM`
- If not set or `FT_ALLOW_FALLBACK_SBOM=0`:
  - Print error: "ERROR: CycloneDX SBOM generation failed. Set FT_ALLOW_FALLBACK_SBOM=1 to allow fallback..."
  - Exit code 2 (fail-closed)
- If `FT_ALLOW_FALLBACK_SBOM=1`:
  - Generate fallback from `npm ls --json`
  - Save as: `docs/evidence/{date}_release/fallback_sbom_dependency_tree.json`
  - Write marker file: `docs/evidence/{date}_release/sbom_status.txt` with content: `SBOM=FALLBACK_DEP_TREE`
  - Continue (allow build to proceed)

**Caveat**: Fallback SBOM is less granular than CycloneDX; not recommended for production unless necessary.

---

## 5. Failure Conditions

CI/CD build fails (exit code ≠ 0) if:
- ✅ forge lint --strict reports errors
- ✅ npm audit detects high-severity vulnerability
- ✅ trivy fs detects critical issue
- ✅ resolver_scan.txt contains POST/PUT/DELETE in production code
- ✅ manifest_scopes_snapshot.txt cannot be generated
- ✅ CycloneDX fails AND FT_ALLOW_FALLBACK_SBOM != 1
- ✅ Evidence hashes cannot be computed
- ✅ Package-lock or manifest hash doesn't match expected baseline

**No soft failures**: All errors are hard failures (exit non-zero).

---

## 6. GitHub Actions Workflow

**File**: `.github/workflows/docs.yml`

**Triggers**: 
- Push with git tag matching `v*` (e.g., v0.4.2)
- Manual trigger (if needed)

**Steps**:
1. Checkout code
2. Setup Node.js v20
3. npm ci (clean install)
4. bash tools/check_tooling_prereqs.sh (verify node, npm, forge, trivy)
5. node tools/md_link_check.mjs (check doc links)
6. bash tools/enterprise_docs_gate.sh (validate all controls)
7. Status: Pass/Fail reported in workflow UI

**Node version**: Pinned to v20 (exact requirement)

---

## 7. Manual Evidence Generation

For local testing or offline generation:

```bash
# Generate evidence for today
bash tools/generate_enterprise_evidence.sh

# OR specify date
bash tools/generate_enterprise_evidence.sh 2026-02-26

# Check output
ls -la docs/evidence/2026-02-26_release/
```

**Requirements**:
- bash 4+ (macOS/Linux)
- node 20, npm, forge CLI, trivy installed
- Current directory = app root

---

## 8. Evidence Retention

**Retention period**: Minimum 12 months

**Storage**:
- Committed to git (docs/evidence/)
- Immutable history via git
- Can be recovered: `git log --all -- docs/evidence/`

**Deletion**: 
- After 12 months, old evidence bundles may be archived
- Requires change management approval (CHANGE_MANAGEMENT_POLICY.md)
- Document deletion in CHANGELOG.md

---

## 9. Evidence Transparency

All evidence artifacts are:
- ✅ Deterministic (same input → same output)
- ✅ Testable (reproduce locally with same tools)
- ✅ Human-readable (JSON, plaintext, no binaries)
- ✅ Committed to git (version-controlled)
- ✅ Immutable (content hash anchors in baselines)

---

## References

- [tools/generate_enterprise_evidence.sh](../trust/generated/repo_refs.md): Script source
- [tools/enterprise_docs_gate.sh](../trust/generated/repo_refs.md): Gate validation script
- [CHANGE_MANAGEMENT_POLICY.md](CHANGE_MANAGEMENT_POLICY.md): Evidence regeneration triggers

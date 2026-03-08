#!/bin/bash
set -euo pipefail

# generate_enterprise_evidence.sh
# Generates enterprise evidence bundle deterministically
# Exit code 2 on hard failures (fail-closed policy)

# Prerequisite check
bash "$(dirname "$0")/check_tooling_prereqs.sh" || exit 2

# Determine date
DATE_UTC="${1:-$(date -u +%Y-%m-%d)}"
DIR="docs/evidence/${DATE_UTC}_release"

# Create directory
mkdir -p "$DIR"

echo "Generating evidence bundle for $DATE_UTC..."
echo "Output directory: $DIR"

# Artifact 1: forge lint strict
echo "Running: forge lint --strict"
if ! forge lint --strict > "$DIR/forge_lint_strict.txt" 2>&1; then
  echo "ERROR: forge lint --strict failed" >&2
  exit 2
fi
echo "✓ forge_lint_strict.txt"

# Artifact 2: npm audit high
echo "Running: npm audit --audit-level=high"
if ! npm audit --audit-level=high > "$DIR/npm_audit_high.txt" 2>&1; then
  echo "ERROR: npm audit --audit-level=high failed (high-severity CVEs found)" >&2
  exit 2
fi
echo "✓ npm_audit_high.txt"

# Artifact 3: dependency tree
echo "Running: npm ls --json"
if ! npm ls --json > "$DIR/dependency_tree.json" 2>&1; then
  echo "ERROR: npm ls --json failed" >&2
  exit 2
fi
echo "✓ dependency_tree.json"

# Artifact 4: CycloneDX SBOM
echo "Running: npx @cyclonedx/bom -o $DIR/cyclonedx_sbom.json"
if npx @cyclonedx/bom -o "$DIR/cyclonedx_sbom.json" > /dev/null 2>&1; then
  echo "✓ cyclonedx_sbom.json"
else
  # Check fallback policy
  if [[ "${FT_ALLOW_FALLBACK_SBOM:-0}" == "1" ]]; then
    echo "⚠️  CycloneDX failed; using fallback"
    cp "$DIR/dependency_tree.json" "$DIR/fallback_sbom_dependency_tree.json"
    echo "SBOM=FALLBACK_DEP_TREE" > "$DIR/sbom_status.txt"
    echo "✓ fallback_sbom_dependency_tree.json (fallback mode)"
  else
    echo "ERROR: CycloneDX SBOM generation failed. Set FT_ALLOW_FALLBACK_SBOM=1 to allow fallback or fix npx access." >&2
    exit 2
  fi
fi

# Artifact 5: trivy scan
echo "Running: trivy fs ."
if ! trivy fs . > "$DIR/trivy_scan.txt" 2>&1; then
  echo "ERROR: trivy scan failed" >&2
  exit 2
fi
echo "✓ trivy_scan.txt"

# Artifact 6: manifest scopes snapshot
echo "Extracting scopes from manifest.yml"
if ! grep -A 20 "^scopes:" manifest.yml > "$DIR/manifest_scopes_snapshot.txt" 2>&1; then
  echo "ERROR: scopes block not found in manifest.yml" >&2
  exit 2
fi
echo "✓ manifest_scopes_snapshot.txt"

# Artifact 7: resolver scan (mutation detection)
echo "Scanning for mutations (POST/PUT/DELETE)..."
{
  echo "# Resolver Scan - Mutation Detection"
  echo "# Command: grep -rn 'POST\|PUT\|DELETE' src/ tools/ (mutation verbs)"
  echo "# Command: grep -rn 'fetch(\|axios\|node-fetch' src/ (external HTTP clients)"
  echo ""
  
  echo "## HTTP Method Grep (POST/PUT/DELETE):"
  grep -rn "POST\|PUT\|DELETE" src/ tools/ 2>/dev/null || echo "No matches found"
  
  echo ""
  echo "## External HTTP Client Grep (fetch/axios/node-fetch):"
  grep -rn "fetch(\|axios\|node-fetch" src/ tools/ 2>/dev/null || echo "No matches found"
} > "$DIR/resolver_scan.txt" 2>&1
echo "✓ resolver_scan.txt"

# Artifact 8: package-lock.json sha256
echo "Computing hashes..."
sha256sum package-lock.json > "$DIR/package-lock.sha256"
echo "✓ package-lock.sha256"

# Artifact 9: manifest.yml sha256
sha256sum manifest.yml > "$DIR/manifest.sha256"
echo "✓ manifest.sha256"

# Artifact 10: evidence hashes
cd "$DIR"
find . -type f ! -name "evidence_hashes.txt" ! -name "sbom_status.txt" -exec sha256sum {} \; > evidence_hashes.txt
cd - > /dev/null
echo "✓ evidence_hashes.txt"

echo ""
echo "✅ Evidence bundle complete: $DIR"
echo "Total files: $(find "$DIR" -type f | wc -l)"

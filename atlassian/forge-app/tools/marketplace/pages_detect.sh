#!/usr/bin/env bash
# pages_detect.sh
# Detect GitHub Pages implementation (offline)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKSPACE_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_gap_closure_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_gap_closure_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

OUTPUT="$E/01_pages/pages_detect.json"

echo "[PAGES DETECT] Analyzing GitHub Pages configuration..."

# Detection results
HAS_PAGES_WORKFLOW=false
PAGES_WORKFLOW_PATH=""
HAS_MKDOCS=false
HAS_DOCUSAURUS=false
HAS_JEKYLL=false
DOCS_DIR_EXISTS=false
DOCS_DIR_PATH=""
IMPLEMENTATION_TYPE="unknown"

# Check for Pages workflow
if [[ -f "$WORKSPACE_ROOT/.github/workflows/pages.yml" ]] || \
   [[ -f "$WORKSPACE_ROOT/.github/workflows/pages-docs.yml" ]] || \
   [[ -f "$WORKSPACE_ROOT/.github/workflows/docs.yml" ]] || \
   [[ -f "$WORKSPACE_ROOT/.github/workflows/gh-pages.yml" ]]; then
  HAS_PAGES_WORKFLOW=true
  # Find the actual file
  for candidate in pages.yml pages-docs.yml docs.yml gh-pages.yml; do
    if [[ -f "$WORKSPACE_ROOT/.github/workflows/$candidate" ]]; then
      PAGES_WORKFLOW_PATH=".github/workflows/$candidate"
      break
    fi
  done
fi

# Check for mkdocs
if [[ -f "$REPO_ROOT/mkdocs.yml" ]] || [[ -f "$WORKSPACE_ROOT/mkdocs.yml" ]]; then
  HAS_MKDOCS=true
  IMPLEMENTATION_TYPE="mkdocs"
fi

# Check for Docusaurus
if [[ -f "$REPO_ROOT/docusaurus.config.js" ]] || [[ -f "$WORKSPACE_ROOT/docusaurus.config.js" ]]; then
  HAS_DOCUSAURUS=true
  IMPLEMENTATION_TYPE="docusaurus"
fi

# Check for Jekyll
if [[ -f "$REPO_ROOT/_config.yml" ]] || [[ -f "$WORKSPACE_ROOT/_config.yml" ]] || \
   [[ -f "$REPO_ROOT/docs/_config.yml" ]]; then
  HAS_JEKYLL=true
  IMPLEMENTATION_TYPE="jekyll"
fi

# Check for docs directory
if [[ -d "$REPO_ROOT/docs" ]]; then
  DOCS_DIR_EXISTS=true
  DOCS_DIR_PATH="atlassian/forge-app/docs"
  if [[ "$IMPLEMENTATION_TYPE" == "unknown" ]]; then
    IMPLEMENTATION_TYPE="static"
  fi
fi

# Generate JSON output
jq -n \
  --arg has_pages_workflow "$HAS_PAGES_WORKFLOW" \
  --arg pages_workflow_path "$PAGES_WORKFLOW_PATH" \
  --arg has_mkdocs "$HAS_MKDOCS" \
  --arg has_docusaurus "$HAS_DOCUSAURUS" \
  --arg has_jekyll "$HAS_JEKYLL" \
  --arg docs_dir_exists "$DOCS_DIR_EXISTS" \
  --arg docs_dir_path "$DOCS_DIR_PATH" \
  --arg implementation_type "$IMPLEMENTATION_TYPE" \
  '{
    has_pages_workflow: ($has_pages_workflow == "true"),
    pages_workflow_path: $pages_workflow_path,
    has_mkdocs: ($has_mkdocs == "true"),
    has_docusaurus: ($has_docusaurus == "true"),
    has_jekyll: ($has_jekyll == "true"),
    docs_dir_exists: ($docs_dir_exists == "true"),
    docs_dir_path: $docs_dir_path,
    implementation_type: $implementation_type,
    pages_ready: ($has_pages_workflow == "true" or $has_mkdocs == "true" or $has_docusaurus == "true" or $has_jekyll == "true")
  }' > "$OUTPUT"

echo "  Pages workflow: $HAS_PAGES_WORKFLOW"
echo "  Implementation: $IMPLEMENTATION_TYPE"
echo "  Docs dir: $DOCS_DIR_EXISTS"
echo "  Output: $OUTPUT"

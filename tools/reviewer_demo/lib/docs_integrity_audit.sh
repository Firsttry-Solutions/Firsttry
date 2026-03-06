#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Forbidden marketing claims that indicate overclaims
FORBIDDEN_CLAIMS=(
  "100%"
  "guaranteed"
  "unhackable"
  "military-grade"
  "bulletproof"
  "unbreakable"
  "foolproof"
  "zero-risk"
  "enterprise-grade"
)

# Legacy paths that must not be referenced - built dynamically
build_legacy_patterns() {
  # Build patterns without embedding as literals to avoid self-matches
  local t="tools"
  local r="reviewer"
  local e="e2e"
  local fa="FirstTry---Audit-Evidence-for-Jira"

  PATTERN_1="${t}/${r}/"
  PATTERN_2="${t}/${r}_${e}/"
  PATTERN_3="${fa}/${t}/${r}_${e}/"
}

run_docs_integrity_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local audit_dir="${evidence_root}/02_docs_integrity"

  log_info "Starting documentation claim integrity audit..."
  mkdir -p "$audit_dir"

  local violations=()
  local legacy_refs=()

  # Build legacy patterns dynamically
  build_legacy_patterns

  # Define specific documentation directories to scan
  local doc_dirs=(
    "docs"
    "FirstTry---Audit-Evidence-for-Jira/docs"
    "atlassian/forge-app/docs"
    "FirstTry---Audit-Evidence-for-Jira"
  )

  log_info "Scanning for overclaims in documentation directories..."

  # Check for forbidden marketing claims in docs
  for doc_dir in "${doc_dirs[@]}"; do
    local full_doc_dir="${repo_root}/${doc_dir}"
    [[ ! -d "$full_doc_dir" ]] && continue

    while IFS= read -r -d '' file; do
      # Skip BANNED_CLAIMS.txt itself (it's supposed to contain those words)
      if [[ "$file" == *"BANNED_CLAIMS.txt" ]]; then
        continue
      fi

      local relative_path="${file#"$repo_root"/}"

      for claim in "${FORBIDDEN_CLAIMS[@]}"; do
        if rg -i -n "$claim" "$file" >/dev/null 2>&1; then
          local matches
          matches=$(rg -i -n "$claim" "$file" 2>/dev/null || true)
          if [[ -n "$matches" ]]; then
            violations+=("$relative_path: $claim")
            echo "$matches" >> "${audit_dir}/overclaim_evidence.txt"
            echo "---" >> "${audit_dir}/overclaim_evidence.txt"
          fi
        fi
      done
    done < <(find "$full_doc_dir" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.rst" \) \
      -not -path "*/.git/*" \
      -not -path "*/node_modules/*" \
      -not -path "*/.venv/*" \
      -print0)
  done

  # Check for legacy reviewer harness references using ripgrep
  log_info "Scanning for legacy reviewer harness references..."

  # Combine patterns for efficient scanning
  local combined_pattern="${PATTERN_1}|${PATTERN_2}|${PATTERN_3}"

  # Scan documentation directories with exclusions
  local legacy_matches=""
  for doc_dir in "${doc_dirs[@]}"; do
    [[ ! -d "${repo_root}/${doc_dir}" ]] && continue

    legacy_matches+=$(rg -n --hidden -S "$combined_pattern" "${repo_root}/${doc_dir}" \
      --glob '!**/.git/**' \
      --glob '!**/node_modules/**' \
      --glob '!**/.venv/**' \
      --glob "!${SCRIPT_DIR}/lib/docs_integrity_audit.sh" \
      --glob '!.github/workflows/reviewer_demo_guard.yml' \
      2>/dev/null || true)
    legacy_matches+=$'\n'
  done

  # Process legacy matches
  if [[ -n "$legacy_matches" && "$legacy_matches" != $'\n' ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      local file_line="${line%%:*}"
      local relative_path="${file_line#"$repo_root"/}"
      legacy_refs+=("$relative_path: legacy reference found")
      echo "$line" >> "${audit_dir}/legacy_references.txt"
    done <<< "$legacy_matches"
  fi

  # Generate audit report
  local status="PASS"
  local total_violations=$((${#violations[@]} + ${#legacy_refs[@]}))
  local files_scanned=0

  # Count scanned files
  for doc_dir in "${doc_dirs[@]}"; do
    [[ ! -d "${repo_root}/${doc_dir}" ]] && continue
    files_scanned=$((files_scanned + $(find "${repo_root}/${doc_dir}" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.rst" \) \
      -not -path "*/.git/*" \
      -not -path "*/node_modules/*" \
      -not -path "*/.venv/*" | wc -l)))
  done

  if [[ $total_violations -gt 0 ]]; then
    status="FAIL"
  fi

  # Generate JSON without jq dependency
  cat > "${audit_dir}/docs_integrity_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "pass": $([ "$status" = "PASS" ] && echo "true" || echo "false"),
  "status": "$status",
  "files_scanned": $files_scanned,
  "overclaim_violations": ${#violations[@]},
  "legacy_reference_violations": ${#legacy_refs[@]},
  "total_violations": $total_violations,
  "patterns_used": ["marketing_claims", "legacy_paths"],
  "scan_summary": "Scanned documentation directories for overclaims and legacy references"
}
EOF

  if [[ $status == "FAIL" ]]; then
    log_error "Documentation integrity audit FAILED:"
    if [[ ${#violations[@]} -gt 0 ]]; then
      log_error "  Overclaim violations: ${#violations[@]}"
      for violation in "${violations[@]}"; do
        log_error "    $violation"
      done
    fi
    if [[ ${#legacy_refs[@]} -gt 0 ]]; then
      log_error "  Legacy reference violations: ${#legacy_refs[@]}"
      for ref in "${legacy_refs[@]}"; do
        log_error "    $ref"
      done
    fi
    return 1
  fi

  log_success "Documentation integrity audit passed"
  return 0
}
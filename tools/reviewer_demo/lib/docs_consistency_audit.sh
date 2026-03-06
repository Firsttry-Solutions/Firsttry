#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Banned marketing phrases that should not appear in documentation
BANNED_PHRASES=(
  "bulletproof"
  "military-grade"
  "unhackable"
  "100% secure"
  "completely secure"
  "absolutely secure"
  "foolproof"
  "unbreakable"
  "impenetrable"
  "guaranteed secure"
  "zero-risk"
  "perfect security"
)

run_docs_consistency_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"
  local audit_dir="${evidence_root}/02_docs_integrity"

  log_info "Starting documentation consistency audit..."
  mkdir -p "$audit_dir"

  # Find all documentation files to scan
  local docs_files=()

  # Scan docs directory
  if [[ -d "${repo_root}/docs" ]]; then
    while IFS= read -r -d '' file; do
      docs_files+=("$file")
    done < <(find "${repo_root}/docs" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.rst" \) -print0 2>/dev/null || true)
  fi

  # Scan README files
  while IFS= read -r -d '' file; do
    docs_files+=("$file")
  done < <(find "$repo_root" -maxdepth 2 -name "README*" -type f -print0 2>/dev/null || true)

  # Scan marketing and marketplace files
  if [[ -d "${repo_root}/marketplace" ]]; then
    while IFS= read -r -d '' file; do
      docs_files+=("$file")
    done < <(find "${repo_root}/marketplace" -type f \( -name "*.md" -o -name "*.txt" \) -print0 2>/dev/null || true)
  fi

  log_info "Scanning ${#docs_files[@]} documentation files for banned phrases..."

  # Initialize tracking arrays
  local banned_phrase_violations=()
  local violation_count=0
  local files_scanned=0
  local status="PASS"

  # Scan each documentation file for banned phrases
  for file in "${docs_files[@]}"; do
    [[ ! -f "$file" ]] && continue
    ((files_scanned++))

    local relative_path="${file#"$repo_root"/}"

    # Check each banned phrase
    for phrase in "${BANNED_PHRASES[@]}"; do
      # Case-insensitive search for banned phrases
      local matches
      matches=$(rg -i -n "$phrase" "$file" 2>/dev/null || true)

      if [[ -n "$matches" ]]; then
        while IFS= read -r match; do
          [[ -z "$match" ]] && continue

          local line_num
          line_num=$(echo "$match" | cut -d: -f1)
          local line_content
          line_content=$(echo "$match" | cut -d: -f2- | xargs)

          banned_phrase_violations+=("$relative_path:$line_num - Banned phrase \"$phrase\": $line_content")
          ((violation_count++))

        done <<< "$matches"
      fi
    done
  done

  # Determine overall status
  if [[ $violation_count -gt 0 ]]; then
    status="FAIL"
    log_error "Documentation consistency audit FAILED: $violation_count banned phrases found"
  else
    log_success "Documentation consistency audit PASSED: No banned phrases detected"
  fi

  # Generate banned phrases violation array for JSON
  local violations_json="["
  local first_violation=true
  for violation in "${banned_phrase_violations[@]}"; do
    if [[ $first_violation == true ]]; then
      first_violation=false
    else
      violations_json+=","
    fi
    # Escape quotes for JSON
    local escaped_violation="${violation//\"/\\\"}"
    violations_json+="\"$escaped_violation\""
  done
  violations_json+="]"

  # Generate banned phrases array for JSON
  local banned_phrases_json="["
  local first_phrase=true
  for phrase in "${BANNED_PHRASES[@]}"; do
    if [[ $first_phrase == true ]]; then
      first_phrase=false
    else
      banned_phrases_json+=","
    fi
    banned_phrases_json+="\"$phrase\""
  done
  banned_phrases_json+="]"

  # Generate documentation consistency report
  cat > "${audit_dir}/docs_claim_scan.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "files_scanned": $files_scanned,
  "violation_count": $violation_count,
  "banned_phrases": $banned_phrases_json,
  "violations": $violations_json,
  "policy": "Documentation must not contain exaggerated security claims or marketing hyperbole",
  "scan_scope": [
    "docs/**/*.md",
    "docs/**/*.txt",
    "docs/**/*.rst",
    "README*",
    "marketplace/**/*.md",
    "marketplace/**/*.txt"
  ]
}
EOF

  # Save detailed violations to text file if any found
  if [[ $violation_count -gt 0 ]]; then
    {
      echo "DOCUMENTATION CONSISTENCY VIOLATIONS"
      echo "===================================="
      echo ""
      echo "Found $violation_count banned phrase violations in documentation:"
      echo ""
      for violation in "${banned_phrase_violations[@]}"; do
        echo "  - $violation"
      done
      echo ""
      echo "These phrases should be replaced with more accurate, verifiable claims."
      echo "See docs/security/analysis_limitations.md for guidance on appropriate language."
    } > "${audit_dir}/docs_consistency_violations.txt"
  fi

  # Return appropriate exit code
  if [[ "$status" == "PASS" ]]; then
    return 0
  else
    log_error "Documentation contains banned marketing phrases"
    log_error "See: $audit_dir/docs_consistency_violations.txt"
    return 1
  fi
}

# Only execute if run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_docs_consistency_audit "${1:-}" "${2:-}" "${3:-}" "${4:-}" || exit $?
fi
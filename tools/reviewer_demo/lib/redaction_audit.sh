#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Patterns to detect PII and secrets
SENSITIVE_PATTERNS=(
  "(?i)authorization:"
  "(?i)bearer[[:space:]]+"
  "(?i)token[[:space:]]*[=:]"
  "(?i)cookie[[:space:]]*[=:]"
  "(?i)accountid[[:space:]]*[=:]"
  "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
  "[A-Z]+-[0-9]+"
  "(?i)password[[:space:]]*[=:]"
  "(?i)secret[[:space:]]*[=:]"
  "(?i)key[[:space:]]*[=:].*[a-zA-Z0-9]{20,}"
  "(?i)api[_-]?key[[:space:]]*[=:]"
)

run_redaction_audit() {
  local evidence_root="$1"
  local audit_dir="${evidence_root}/10_redaction_audit"

  log_info "Starting PII and secret redaction audit..."
  mkdir -p "$audit_dir"

  # Find all evidence files to scan
  local evidence_files=()
  while IFS= read -r -d '' file; do
    evidence_files+=("$file")
  done < <(find "$evidence_root" -type f \( -name "*.txt" -o -name "*.log" -o -name "*.json" -o -name "*.md" \) \
    -not -path "$audit_dir/*" \
    -print0)

  log_info "Scanning ${#evidence_files[@]} evidence files for sensitive data..."

  local violations=()
  local violation_details=()

  # Scan each file for sensitive patterns
  for file in "${evidence_files[@]}"; do
    local relative_path="${file#"$evidence_root"/}"

    for pattern in "${SENSITIVE_PATTERNS[@]}"; do
      local matches
      matches=$(rg -n -i "$pattern" "$file" 2>/dev/null || true)

      if [[ -n "$matches" ]]; then
        while IFS= read -r match; do
          [[ -z "$match" ]] && continue

          local line_num
          line_num=$(echo "$match" | cut -d: -f1)
          local content
          content=$(echo "$match" | cut -d: -f2-)

          # Redact the actual sensitive content for logging
          local redacted_content
          redacted_content=$(echo "$content" | sed -E 's/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/[REDACTED_EMAIL]/g' \
            | sed -E 's/(bearer[[:space:]]+)[a-zA-Z0-9._-]+/\1[REDACTED_TOKEN]/gi' \
            | sed -E 's/(token[[:space:]]*[=:][[:space:]]*)[a-zA-Z0-9._-]+/\1[REDACTED_TOKEN]/gi' \
            | sed -E 's/([A-Z]+-)[0-9]+/\1[REDACTED_ISSUE]/g')

          violations+=("$relative_path:$line_num")
          violation_details+=("$relative_path:$line_num - Pattern: $pattern - Content: $redacted_content")

          # Log detailed match for review (but redacted)
          echo "$relative_path:$line_num - $redacted_content" >> "${audit_dir}/violations_redacted.txt"

        done <<< "$matches"
      fi
    done
  done

  # Remove duplicate violations
  local unique_violations=()
  local seen_violations=()
  for violation in "${violations[@]}"; do
    if [[ ! " ${seen_violations[*]} " =~ " ${violation} " ]]; then
      unique_violations+=("$violation")
      seen_violations+=("$violation")
    fi
  done

  # Generate redaction audit report
  local status="PASS"
  if [[ ${#unique_violations[@]} -gt 0 ]]; then
    status="FAIL"
  fi

  cat > "${audit_dir}/redaction_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "evidence_files_scanned": ${#evidence_files[@]},
  "sensitive_patterns_checked": ${#SENSITIVE_PATTERNS[@]},
  "violations_found": ${#unique_violations[@]},
  "patterns_used": $(printf '%s\n' "${SENSITIVE_PATTERNS[@]}" | jq -R . | jq -s .),
  "violation_locations": $(printf '%s\n' "${unique_violations[@]}" | jq -R . | jq -s .),
  "scan_summary": {
    "emails_found": $(printf '%s\n' "${violation_details[@]}" | grep -c "email" || echo 0),
    "tokens_found": $(printf '%s\n' "${violation_details[@]}" | grep -c -i "token\|bearer" || echo 0),
    "issue_keys_found": $(printf '%s\n' "${violation_details[@]}" | grep -c "REDACTED_ISSUE" || echo 0)
  }
}
EOF

  if [[ $status == "FAIL" ]]; then
    log_error "Redaction audit FAILED - sensitive data found in evidence:"
    log_error "  Violations: ${#unique_violations[@]}"
    log_error "  Files affected: $(printf '%s\n' "${unique_violations[@]}" | cut -d: -f1 | sort -u | wc -l)"
    log_error "  Details saved to: ${audit_dir}/violations_redacted.txt"
    return 1
  fi

  log_success "Redaction audit passed - no sensitive data found in evidence"
  return 0
}
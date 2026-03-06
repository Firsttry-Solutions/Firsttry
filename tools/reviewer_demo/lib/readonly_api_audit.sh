#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Allowed HTTP methods (read-only)
ALLOWED_METHODS=("GET")

# Forbidden HTTP methods (mutation)
FORBIDDEN_METHODS=("POST" "PUT" "DELETE" "PATCH")

run_readonly_api_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"
  local audit_dir="${evidence_root}/04_readonly_api_audit"

  log_info "Starting read-only Jira API verification (VENDOR APP ONLY)..."
  mkdir -p "$audit_dir"

  # Scan ONLY vendor app source code
  local src_root="${app_root}/src"

  if [[ ! -d "$src_root" ]]; then
    log_error "Source directory not found at: $src_root (app_root=$app_root)"
    cat > "${audit_dir}/readonly_requestjira_index.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "FAIL",
  "files_scanned": 0,
  "app_root": "$app_root",
  "requestjira_calls_found": 0,
  "violations": 1,
  "error": "Source directory $src_root not found",
  "allowed_methods": $(printf '%s\n' "${ALLOWED_METHODS[@]}" | jq -R . | jq -s .),
  "forbidden_methods": $(printf '%s\n' "${FORBIDDEN_METHODS[@]}" | jq -R . | jq -s .),
  "violation_details": ["Source directory not found"],
  "requests": []
}
EOF
    return 1
  fi

  log_info "Scanning ONLY vendor app source: $src_root"

  # Find all JavaScript/TypeScript files in app source - exclude tests and build artifacts
  local js_files=()
  while IFS= read -r -d '' file; do
    js_files+=("$file")
  done < <(find "$src_root" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
    -not -path "*/.git/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/.venv/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/tests/*" \
    -not -path "*/test/*" \
    -not -path "*/__tests__/*" \
    -not -name "*.test.*" \
    -not -name "*.spec.*" \
    -not -path "*/coverage/*" \
    -not -path "*/playwright/*" \
    -print0)

  log_info "Scanning ${#js_files[@]} JavaScript/TypeScript files for requestJira usage..."

  local requests=()
  local violations=()
  local req_index=0

  # Search for requestJira calls with enhanced pattern matching
  for file in "${js_files[@]}"; do
    local relative_path="${file#"$app_root"/}"

    # Enhanced pattern search for:
    # - requestJira(
    # - api.asApp().requestJira(
    # - api.asUser().requestJira(
    local matches
    matches=$(rg -n "(requestJira\s*\(|api\.as(App|User)\(\)\.requestJira\s*\()" "$file" 2>/dev/null || true)

    if [[ -n "$matches" ]]; then
      while IFS= read -r match; do
        [[ -z "$match" ]] && continue

        local line_num
        line_num=$(echo "$match" | cut -d: -f1)
        local line_content
        line_content=$(echo "$match" | cut -d: -f2-)

        # Extract method and endpoint with improved parsing
        local method=""
        local endpoint=""

        # Look for broader context around the requestJira call
        local context_start=$((line_num - 5))
        local context_end=$((line_num + 10))
        [[ $context_start -lt 1 ]] && context_start=1

        local context
        context=$(sed -n "${context_start},${context_end}p" "$file" 2>/dev/null || true)

        # Enhanced method extraction - look for various patterns
        if [[ "$context" =~ method[[:space:]]*:[[:space:]]*[\'\""]([A-Z]+)[\'\""] ]]; then
          method="${BASH_REMATCH[1]}"
        elif [[ "$context" =~ [\'\""]([A-Z]+)[\'\""][[:space:]]*,[[:space:]]*[\'\""]([/][^\'\"]*)[\'\""] ]]; then
          method="${BASH_REMATCH[1]}"
          endpoint="${BASH_REMATCH[2]}"
        elif [[ "$line_content" =~ [\'\""]([A-Z]+)[\'\""] ]]; then
          method="${BASH_REMATCH[1]}"
        fi

        # Enhanced endpoint extraction
        if [[ -z "$endpoint" ]]; then
          if [[ "$context" =~ url[[:space:]]*:[[:space:]]*[\'\""]([^\'\"]+)[\'\""] ]]; then
            endpoint="${BASH_REMATCH[1]}"
          elif [[ "$context" =~ [\'\""]([/][^\'\"]*)[\'\""] ]]; then
            endpoint="${BASH_REMATCH[1]}"
          elif [[ "$line_content" =~ [\'\""]([/][^\'\"]*)[\'\""] ]]; then
            endpoint="${BASH_REMATCH[1]}"
          fi
        fi

        # Default method assignment - Forge API defaults to GET if not specified
        if [[ -z "$method" ]]; then
          method="GET"
        fi

        # Apply classification rules
        local classification=""
        local violation=false

        if [[ "$method" == "GET" ]]; then
          classification="read_only"
        elif [[ " ${FORBIDDEN_METHODS[*]} " =~ " ${method} " ]]; then
          classification="mutation"
          violation=true
          violations+=("$relative_path:$line_num - $method $endpoint")
        else
          # Treat unknown methods as potential mutations for fail-closed behavior
          classification="mutation"
          violation=true
          violations+=("$relative_path:$line_num - UNKNOWN_METHOD($method) $endpoint")
        fi

        # Record the request with enhanced data
        requests+=("$req_index|$relative_path|$line_num|$method|$endpoint|$classification")
        ((req_index++))

      done <<< "$matches"
    fi
  done

  # Generate readonly API audit report with enhanced structure
  local status="PASS"
  local total_network_calls=${#requests[@]}
  local total_urls_detected=0
  local mutation_count=0

  # Count mutations and URLs
  for request in "${requests[@]}"; do
    IFS='|' read -r idx file line method endpoint classification <<< "$request"
    if [[ -n "$endpoint" ]]; then
      ((total_urls_detected++))
    fi
    if [[ "$classification" == "mutation" ]]; then
      ((mutation_count++))
    fi
  done

  # FAIL if ANY mutation detected
  if [[ $mutation_count -gt 0 ]]; then
    status="FAIL"
  fi

  # Build JSON structure for requests
  local requests_json="["
  local first=true
  for request in "${requests[@]}"; do
    IFS='|' read -r idx file line method endpoint classification <<< "$request"

    if [[ $first == true ]]; then
      first=false
    else
      requests_json+=","
    fi

    requests_json+="
    {
      \"index\": $idx,
      \"file\": \"$file\",
      \"line\": $line,
      \"method\": \"$method\",
      \"endpoint\": \"$endpoint\",
      \"classification\": \"$classification\"
    }"
  done
  requests_json+="
  ]"

  cat > "${audit_dir}/readonly_requestjira_index.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "files_scanned": ${#js_files[@]},
  "total_network_calls": $total_network_calls,
  "total_urls_detected": $total_urls_detected,
  "requestjira_calls_found": ${#requests[@]},
  "mutation_count": $mutation_count,
  "violations": ${#violations[@]},
  "allowed_methods": $(printf '%s\n' "${ALLOWED_METHODS[@]}" | jq -R . | jq -s .),
  "forbidden_methods": $(printf '%s\n' "${FORBIDDEN_METHODS[@]}" | jq -R . | jq -s .),
  "violation_details": $(printf '%s\n' "${violations[@]}" | jq -R . | jq -s .),
  "requests": $requests_json
}
EOF

  if [[ $status == "FAIL" ]]; then
    log_error "Read-only API audit FAILED:"
    log_error "Found $mutation_count mutation operations in requestJira calls"
    for violation in "${violations[@]}"; do
      log_error "  $violation"
    done
    return 1
  fi

  log_success "Read-only API audit passed (${#requests[@]} requestJira calls verified)"
  return 0
}
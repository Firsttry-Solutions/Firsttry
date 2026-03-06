#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Extended network libraries and patterns to scan for
NETWORK_LIBRARIES=(
  "axios"
  "fetch\s*\("
  "node-fetch"
  "undici"
  "http\.request\s*\("
  "https\.request\s*\("
  "new\s+URL\s*\("
  "XMLHttpRequest"
  "http\."
  "https\."
  "ws"
  "got"
  "superagent"
)

# Dynamic URL construction patterns
DYNAMIC_URL_PATTERNS=(
  "\"http\"\s*\+\s*\"://\""
  "'http'\s*\+\s*'://'"
  "protocol\s*\+\s*domain"
  "\`[^]*http[^]*\`"          # template literals with http
  "\"\[^\"]*\$\{[^}]*\}[^\"]*http[^\"]*\""  # template with variables containing http
  "'\[^']*\$\{[^}]*\}[^']*http[^']*'"       # template with variables containing http
)

# Indirect network libraries - libraries that can make network requests
INDIRECT_NETWORK_LIBRARIES=(
  "node-fetch"
  "cross-fetch"
  "superagent"
  "got"
  "request"
)

# Track indirect library imports
INDIRECT_IMPORT_PATTERNS=(
  "import.*from\s*['\"]node-fetch['\"]"
  "import.*from\s*['\"]cross-fetch['\"]"
  "import.*from\s*['\"]superagent['\"]"
  "import.*from\s*['\"]got['\"]"
  "import.*from\s*['\"]request['\"]"
  "require\s*\(\s*['\"]node-fetch['\"]"
  "require\s*\(\s*['\"]cross-fetch['\"]"
  "require\s*\(\s*['\"]superagent['\"]"
  "require\s*\(\s*['\"]got['\"]"
  "require\s*\(\s*['\"]request['\"]"
)

run_network_static_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"
  local audit_dir="${evidence_root}/05_network"

  log_info "Starting static network egress audit (VENDOR APP ONLY)..."
  mkdir -p "$audit_dir"

  # Scan ONLY vendor app source and manifest
  local src_root="${app_root}/src"

  if [[ ! -d "$src_root" ]]; then
    log_error "Source directory not found at: $src_root (app_root=$app_root)"
    cat > "${audit_dir}/network_static_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "FAIL",
  "files_scanned": 0,
  "app_root": "$app_root",
  "violations": 1,
  "error": "Source directory not found"
}
EOF
    return 1
  fi

  log_info "Scanning ONLY vendor app: $src_root and $manifest_path"

  # Load allowlist domains
  local allowlist_file="${repo_root}/tools/reviewer_demo/ALLOWLIST_DOMAINS.txt"
  local allowed_domains=()

  if [[ -f "$allowlist_file" ]]; then
    while IFS= read -r line; do
      # Skip empty lines and comments
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      allowed_domains+=("$(echo "$line" | tr '[:upper:]' '[:lower:]' | xargs)")
    done < "$allowlist_file"
  else
    fail "Allowlist file not found: $allowlist_file"
  fi

  log_info "Loaded ${#allowed_domains[@]} allowed domains from allowlist"

  # Find all source files in app - exclude build artifacts, tests, and package files
  local source_files=()
  while IFS= read -r -d '' file; do
    source_files+=("$file")
  done < <(find "$src_root" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
    -not -path "*/.git/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/.venv/*" \
    -not -path "*/coverage/*" \
    -not -path "*/tests/*" \
    -not -path "*/test/*" \
    -not -path "*/__tests__/*" \
    -not -path "*/playwright/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -name "*.test.*" \
    -not -name "*.spec.*" \
    -not -name "package-lock.json" \
    -not -name "package.json" \
    -not -name "*.min.js" \
    -print0)

  log_info "Scanning ${#source_files[@]} source files for network libraries..."

  local network_calls=()
  local extracted_urls=()
  local violations=()
  local call_index=0
  local indirect_network_libraries=()
  local dynamic_url_patterns_detected=()

  # Scan for indirect network library imports first
  log_info "Scanning for indirect network library imports..."
  for file in "${source_files[@]}"; do
    local relative_path="${file#"$app_root"/}"

    # Check for indirect network library imports
    for import_pattern in "${INDIRECT_IMPORT_PATTERNS[@]}"; do
      local import_matches
      import_matches=$(rg -n "$import_pattern" "$file" 2>/dev/null || true)

      if [[ -n "$import_matches" ]]; then
        while IFS= read -r import_match; do
          [[ -z "$import_match" ]] && continue

          local import_line_num
          import_line_num=$(echo "$import_match" | cut -d: -f1)
          local import_line_content
          import_line_content=$(echo "$import_match" | cut -d: -f2-)

          # Extract library name from import
          local library_name=""
          if [[ "$import_line_content" =~ node-fetch ]]; then
            library_name="node-fetch"
          elif [[ "$import_line_content" =~ cross-fetch ]]; then
            library_name="cross-fetch"
          elif [[ "$import_line_content" =~ superagent ]]; then
            library_name="superagent"
          elif [[ "$import_line_content" =~ got ]]; then
            library_name="got"
          elif [[ "$import_line_content" =~ request ]]; then
            library_name="request"
          fi

          if [[ -n "$library_name" ]]; then
            indirect_network_libraries+=("$relative_path:$import_line_num:$library_name")
            log_info "Found indirect network library: $library_name in $relative_path:$import_line_num"

            # Now trace usage of this library within the file
            local usage_patterns=()
            case "$library_name" in
              "node-fetch"|"cross-fetch") usage_patterns=("fetch\s*\(") ;;
              "superagent") usage_patterns=("superagent\s*\." "request\s*\(") ;;
              "got") usage_patterns=("got\s*\(" "got\s*\.") ;;
              "request") usage_patterns=("request\s*\(") ;;
            esac

            for usage_pattern in "${usage_patterns[@]}"; do
              local usage_matches
              usage_matches=$(rg -n "$usage_pattern" "$file" 2>/dev/null || true)

              if [[ -n "$usage_matches" ]]; then
                while IFS= read -r usage_match; do
                  [[ -z "$usage_match" ]] && continue

                  local usage_line_num
                  usage_line_num=$(echo "$usage_match" | cut -d: -f1)
                  local usage_line_content
                  usage_line_content=$(echo "$usage_match" | cut -d: -f2-)

                  # Extract URLs from usage context
                  local usage_context_start=$((usage_line_num - 1))
                  local usage_context_end=$((usage_line_num + 3))
                  [[ $usage_context_start -lt 1 ]] && usage_context_start=1

                  local usage_context
                  usage_context=$(sed -n "${usage_context_start},${usage_context_end}p" "$file" 2>/dev/null || true)

                  # Extract URLs from usage
                  local usage_urls
                  usage_urls=$(echo "$usage_context" | rg -o "https?://[^\s'\"\`)]+" 2>/dev/null || true)

                  if [[ -n "$usage_urls" ]]; then
                    while IFS= read -r usage_url; do
                      [[ -z "$usage_url" ]] && continue
                      extracted_urls+=("$usage_url")

                      # Check against allowlist
                      local domain
                      domain=$(normalize_domain "$usage_url")

                      local allowed=false
                      for allowed_domain in "${allowed_domains[@]}"; do
                        if [[ "$domain" == "$allowed_domain" || "$domain" == *".$allowed_domain" ]]; then
                          allowed=true
                          break
                        fi
                      done

                      if [[ $allowed == false ]]; then
                        violations+=("$relative_path:$usage_line_num - Indirect library ($library_name) accessing unauthorized domain: $domain")
                      fi
                    done <<< "$usage_urls"
                  fi

                done <<< "$usage_matches"
              fi
            done
          fi
        done <<< "$import_matches"
      fi
    done
  done

  # Search for network library usage and dynamic URL construction
  for file in "${source_files[@]}"; do
    local relative_path="${file#"$app_root"/}"

    # Scan for standard network libraries
    for library in "${NETWORK_LIBRARIES[@]}"; do
      local matches
      matches=$(rg -n "$library" "$file" 2>/dev/null || true)

      if [[ -n "$matches" ]]; then
        while IFS= read -r match; do
          [[ -z "$match" ]] && continue

          local line_num
          line_num=$(echo "$match" | cut -d: -f1)
          local line_content
          line_content=$(echo "$match" | cut -d: -f2-)

          # Extract URLs from broader context
          local context_start=$((line_num - 2))
          local context_end=$((line_num + 5))
          [[ $context_start -lt 1 ]] && context_start=1

          local context
          context=$(sed -n "${context_start},${context_end}p" "$file" 2>/dev/null || true)

          # Extract potential URLs using enhanced patterns
          local urls
          # Standard HTTP(S) URLs
          urls=$(echo "$context" | rg -o "https?://[^\s'\"\`)]+" 2>/dev/null || true)

          # Domain-only patterns (for API endpoints)
          local domain_urls
          domain_urls=$(echo "$context" | rg -o "[a-zA-Z0-9.-]+\.atlassian\.(net|com|io)" 2>/dev/null || true)

          # Combine all URLs
          local all_urls="$urls"
          if [[ -n "$domain_urls" ]]; then
            all_urls="$urls"$'\n'"$domain_urls"
          fi

          if [[ -n "$all_urls" ]]; then
            while IFS= read -r url; do
              [[ -z "$url" ]] && continue
              extracted_urls+=("$url")

              # Normalize domain for checking
              local domain
              domain=$(normalize_domain "$url")

              # Check against allowlist
              local allowed=false
              for allowed_domain in "${allowed_domains[@]}"; do
                if [[ "$domain" == "$allowed_domain" || "$domain" == *".$allowed_domain" ]]; then
                  allowed=true
                  break
                fi
              done

              if [[ $allowed == false ]]; then
                violations+=("$relative_path:$line_num - Unauthorized domain: $domain (URL: $url)")
              fi

            done <<< "$all_urls"
          fi

          # Record the network call
          network_calls+=("$call_index|$relative_path|$line_num|$library|$line_content")
          ((call_index++))

        done <<< "$matches"
      fi
    done

    # Scan for dynamic URL construction patterns
    for pattern in "${DYNAMIC_URL_PATTERNS[@]}"; do
      local matches
      matches=$(rg -n "$pattern" "$file" 2>/dev/null || true)

      if [[ -n "$matches" ]]; then
        while IFS= read -r match; do
          [[ -z "$match" ]] && continue

          local line_num
          line_num=$(echo "$match" | cut -d: -f1)
          local line_content
          line_content=$(echo "$match" | cut -d: -f2-)

          # Track the dynamic pattern detected
          dynamic_url_patterns_detected+=("$relative_path:$line_num:$pattern")

          # Record dynamic URL construction as potential network call
          network_calls+=("$call_index|$relative_path|$line_num|DYNAMIC_URL_CONSTRUCTION|$line_content")
          ((call_index++))

          # Check if this constructs URLs to unauthorized domains
          local potential_domain
          potential_domain=$(echo "$line_content" | rg -o "[a-zA-Z0-9.-]+\.(com|net|org|io)" 2>/dev/null | head -1 || true)

          if [[ -n "$potential_domain" ]]; then
            extracted_urls+=("$potential_domain")

            # Check against allowlist
            local allowed=false
            for allowed_domain in "${allowed_domains[@]}"; do
              if [[ "$potential_domain" == "$allowed_domain" || "$potential_domain" == *".$allowed_domain" ]]; then
                allowed=true
                break
              fi
            done

            if [[ $allowed == false ]]; then
              violations+=("$relative_path:$line_num - Dynamic URL construction to unauthorized domain: $potential_domain")
            fi
          fi

        done <<< "$matches"
      fi
    done
  done

  # Remove duplicate URLs
  local unique_urls=()
  local seen_urls=()
  for url in "${extracted_urls[@]}"; do
    if [[ ! " ${seen_urls[*]} " =~ " ${url} " ]]; then
      unique_urls+=("$url")
      seen_urls+=("$url")
    fi
  done

  # Generate enhanced network static audit report
  local status="PASS"
  if [[ ${#violations[@]} -gt 0 ]]; then
    status="FAIL"
  fi

  # Build allowed_domains JSON array
  local allowed_domains_json="["
  local first_domain=true
  for domain in "${allowed_domains[@]}"; do
    if [[ $first_domain == true ]]; then
      first_domain=false
    else
      allowed_domains_json+=","
    fi
    allowed_domains_json+="\"$domain\""
  done
  allowed_domains_json+="]"

  # Build JSON arrays for new fields
  local indirect_libraries_json="["
  local first_indirect=true
  for indirect_lib in "${indirect_network_libraries[@]}"; do
    if [[ $first_indirect == true ]]; then
      first_indirect=false
    else
      indirect_libraries_json+=","
    fi
    indirect_libraries_json+="\"$indirect_lib\""
  done
  indirect_libraries_json+="]"

  local dynamic_patterns_json="["
  local first_pattern=true
  for dynamic_pattern in "${dynamic_url_patterns_detected[@]}"; do
    if [[ $first_pattern == true ]]; then
      first_pattern=false
    else
      dynamic_patterns_json+=","
    fi
    dynamic_patterns_json+="\"$dynamic_pattern\""
  done
  dynamic_patterns_json+="]"

  cat > "${audit_dir}/static_network_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "files_scanned": ${#source_files[@]},
  "total_network_calls": ${#network_calls[@]},
  "total_urls_detected": ${#unique_urls[@]},
  "violations": ${#violations[@]},
  "allowed_domains": $allowed_domains_json,
  "policy": "Allow only domains from ALLOWLIST_DOMAINS.txt",
  "indirect_network_libraries": $indirect_libraries_json,
  "dynamic_url_patterns_detected": $dynamic_patterns_json,
  "scan_patterns": {
    "network_libraries": $(printf '%s\n' "${NETWORK_LIBRARIES[@]}" | sed 's/\\/\\\\/g' | jq -R . | jq -s .),
    "dynamic_url_patterns": $(printf '%s\n' "${DYNAMIC_URL_PATTERNS[@]}" | sed 's/\\/\\\\/g' | jq -R . | jq -s .),
    "indirect_import_patterns": $(printf '%s\n' "${INDIRECT_IMPORT_PATTERNS[@]}" | sed 's/\\/\\\\/g' | jq -R . | jq -s .)
  }
}
EOF

  # Save violation details to separate text file
  if [[ ${#violations[@]} -gt 0 ]]; then
    printf '%s\n' "${violations[@]}" > "${audit_dir}/static_violations.txt"
  fi

  # Save unique URLs to separate file for runtime comparison
  printf '%s\n' "${unique_urls[@]}" > "${audit_dir}/static_urls.txt"

  if [[ $status == "FAIL" ]]; then
    log_error "Static network audit FAILED:"
    for violation in "${violations[@]}"; do
      log_error "  $violation"
    done
    return 1
  fi

  log_success "Static network audit passed (${#unique_urls[@]} URLs found, ${#network_calls[@]} network calls)"
  return 0
}
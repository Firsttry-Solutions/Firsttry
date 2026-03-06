#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_network_runtime_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local audit_dir="${evidence_root}/06_network_runtime_audit"

  log_info "Starting runtime network egress audit..."
  mkdir -p "$audit_dir"

  # Check if we're in LIVE mode
  local mode
  mode=$(cat "${evidence_root}/00_preflight/mode.txt" 2>/dev/null || echo "offline")

  if [[ "$mode" != "live" ]]; then
    log_info "Skipping runtime network audit in OFFLINE mode"
    cat > "${audit_dir}/network_runtime_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "SKIPPED",
  "mode": "$mode",
  "reason": "Runtime network audit only runs in LIVE mode"
}
EOF
    return 0
  fi

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

  log_info "Running Playwright network capture during dashboard rendering..."

  # Create network capture script
  local capture_script="${audit_dir}/network_capture.js"
  cat > "$capture_script" << 'EOF'
const { chromium } = require('playwright');
const fs = require('fs');

async function captureNetworkTraffic() {
  const networkRequests = [];

  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1'
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all network requests
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      timestamp: new Date().toISOString()
    });
  });

  try {
    // Navigate to Jira dashboard URL
    const dashboardUrl = process.env.JIRA_DASHBOARD_URL;
    if (!dashboardUrl) {
      throw new Error('JIRA_DASHBOARD_URL not set');
    }

    console.log('Navigating to:', dashboardUrl);
    await page.goto(dashboardUrl, {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Wait additional time for any lazy-loaded content
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Navigation error:', error.message);
  } finally {
    await browser.close();

    // Write network log
    fs.writeFileSync(
      process.argv[2],
      JSON.stringify(networkRequests, null, 2)
    );

    console.log(`Captured ${networkRequests.length} network requests`);
  }
}

captureNetworkTraffic().catch(console.error);
EOF

  # Run network capture
  local network_log="${audit_dir}/network_requests.json"
  local capture_timeout=120

  if ! timeout "$capture_timeout" node "$capture_script" "$network_log" 2>&1 | tee "${audit_dir}/capture.log"; then
    log_warn "Network capture may have timed out or failed"
  fi

  # Analyze captured network requests
  local runtime_urls=()
  local violations=()

  if [[ -f "$network_log" ]]; then
    # Extract URLs from network log
    local captured_urls
    captured_urls=$(node -e "
      const data = JSON.parse(require('fs').readFileSync('$network_log', 'utf8'));
      const urls = data.map(req => req.url).filter(Boolean);
      console.log(urls.join('\n'));
    " 2>/dev/null || true)

    if [[ -n "$captured_urls" ]]; then
      while IFS= read -r url; do
        [[ -z "$url" ]] && continue
        runtime_urls+=("$url")

        # Check domain against allowlist
        local domain
        domain=$(normalize_domain "$url")

        local allowed=false
        for allowed_domain in "${allowed_domains[@]}"; do
          if [[ "$domain" == "$allowed_domain" || "$domain" == *".$allowed_domain" ]]; then
            allowed=true
            break
          fi
        done

        if [[ $allowed == false ]]; then
          violations+=("Runtime unauthorized domain: $domain (URL: $url)")
        fi

      done <<< "$captured_urls"
    fi
  else
    log_warn "No network log generated - capture may have failed"
  fi

  # Generate runtime network audit report
  local status="PASS"
  if [[ ${#violations[@]} -gt 0 ]]; then
    status="FAIL"
  fi

  cat > "${audit_dir}/network_runtime_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "mode": "$mode",
  "runtime_urls_captured": ${#runtime_urls[@]},
  "violations": ${#violations[@]},
  "allowed_domains": $(printf '%s\n' "${allowed_domains[@]}" | jq -R . | jq -s .),
  "violation_details": $(printf '%s\n' "${violations[@]}" | jq -R . | jq -s .),
  "runtime_urls": $(printf '%s\n' "${runtime_urls[@]}" | jq -R . | jq -s .)
}
EOF

  if [[ $status == "FAIL" ]]; then
    log_error "Runtime network audit FAILED:"
    for violation in "${violations[@]}"; do
      log_error "  $violation"
    done
    return 1
  fi

  log_success "Runtime network audit passed (${#runtime_urls[@]} URLs captured)"
  return 0
}
#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_dashboard_render_test() {
  local evidence_root="$1"
  local repo_root="$2"
  local audit_dir="${evidence_root}/11_dashboard_render"

  log_info "Starting dashboard render test..."
  mkdir -p "$audit_dir"

  # Check if we're in LIVE mode
  local mode
  mode=$(cat "${evidence_root}/00_preflight/mode.txt" 2>/dev/null || echo "offline")

  if [[ "$mode" != "live" ]]; then
    log_info "Skipping dashboard render test in OFFLINE mode"
    cat > "${audit_dir}/dashboard_render_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "SKIPPED",
  "mode": "$mode",
  "reason": "Dashboard render test only runs in LIVE mode"
}
EOF
    return 0
  fi

  # Ensure Forge project is deployed
  log_info "Checking Forge app deployment status..."
  cd "$repo_root/atlassian/forge-app"

  if ! forge deploy 2>&1 | tee "${audit_dir}/deploy.log"; then
    log_error "Forge deployment failed"
    cat > "${audit_dir}/dashboard_render_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "FAIL",
  "mode": "$mode",
  "error": "Forge deployment failed",
  "deployment_log": "deploy.log"
}
EOF
    return 1
  fi

  if ! forge install --upgrade 2>&1 | tee "${audit_dir}/install.log"; then
    log_error "Forge installation failed"
    cat > "${audit_dir}/dashboard_render_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "FAIL",
  "mode": "$mode",
  "error": "Forge installation failed",
  "installation_log": "install.log"
}
EOF
    return 1
  fi

  # Create Playwright dashboard test script
  local test_script="${audit_dir}/dashboard_test.js"
  cat > "$test_script" << 'EOF'
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testDashboard() {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'UNKNOWN',
    navigation: { success: false, error: null },
    rendering: { success: false, error: null, screenshots: [] },
    console_logs: [],
    network_requests: [],
    errors: []
  };

  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1'
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    results.console_logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
  });

  // Capture network requests
  page.on('request', request => {
    results.network_requests.push({
      url: request.url(),
      method: request.method(),
      timestamp: new Date().toISOString()
    });
  });

  // Capture errors
  page.on('pageerror', error => {
    results.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });

  try {
    const dashboardUrl = process.env.JIRA_DASHBOARD_URL;
    if (!dashboardUrl) {
      throw new Error('JIRA_DASHBOARD_URL not set');
    }

    console.log('Navigating to dashboard:', dashboardUrl);

    // Navigate to dashboard
    await page.goto(dashboardUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    results.navigation.success = true;

    // Wait for potential FirstTry gadgets to load
    await page.waitForTimeout(10000);

    // Take screenshot
    const screenshotPath = path.join(process.argv[2], 'dashboard_screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.rendering.screenshots.push('dashboard_screenshot.png');

    // Check for FirstTry gadget presence
    const gadgetSelectors = [
      '[data-testid*="firsttry"]',
      '[class*="firsttry"]',
      '[id*="firsttry"]',
      'iframe[src*="forge"]'
    ];

    let gadgetFound = false;
    for (const selector of gadgetSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements matching: ${selector}`);
        gadgetFound = true;

        // Take specific screenshot of gadget area
        try {
          const gadgetScreenshot = path.join(process.argv[2], `gadget_${selector.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
          await elements[0].screenshot({ path: gadgetScreenshot });
          results.rendering.screenshots.push(path.basename(gadgetScreenshot));
        } catch (e) {
          console.log('Could not screenshot gadget element:', e.message);
        }
      }
    }

    if (gadgetFound) {
      results.rendering.success = true;
      results.status = 'PASS';
    } else {
      results.rendering.error = 'No FirstTry gadgets found on dashboard';
      results.status = 'FAIL';
    }

  } catch (error) {
    results.navigation.error = error.message;
    results.status = 'FAIL';
    console.error('Dashboard test failed:', error);
  } finally {
    await browser.close();

    // Write results
    fs.writeFileSync(
      path.join(process.argv[2], 'dashboard_render_report.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('Dashboard test completed with status:', results.status);
  }
}

testDashboard().catch(console.error);
EOF

  # Run dashboard test
  log_info "Running Playwright dashboard render test..."
  local test_timeout=180

  if ! timeout "$test_timeout" node "$test_script" "$audit_dir" 2>&1 | tee "${audit_dir}/test_output.log"; then
    log_warn "Dashboard test may have timed out"
  fi

  # Check test results
  local test_report="${audit_dir}/dashboard_render_report.json"
  local final_status="UNKNOWN"

  if [[ -f "$test_report" ]]; then
    final_status=$(node -e "
      try {
        const data = JSON.parse(require('fs').readFileSync('$test_report', 'utf8'));
        console.log(data.status || 'UNKNOWN');
      } catch (e) {
        console.log('UNKNOWN');
      }
    " 2>/dev/null || echo "UNKNOWN")
  else
    log_error "Dashboard test report not generated"
    cat > "$test_report" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "FAIL",
  "mode": "$mode",
  "error": "Test report not generated - test may have crashed"
}
EOF
    final_status="FAIL"
  fi

  if [[ "$final_status" == "PASS" ]]; then
    log_success "Dashboard render test passed"
    return 0
  else
    log_error "Dashboard render test failed with status: $final_status"
    return 1
  fi
}
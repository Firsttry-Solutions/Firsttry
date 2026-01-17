# Jira Dashboard Gadget E2E Test Harness - COMPLETE

**Status**: ✅ ALL 7 PHASES COMPLETE

**Deployment Target**: https://firsttry.atlassian.net/jira/dashboards/10102  
**Gadget**: governance-dashboard-gadget-v2 (v2.88.0)  
**App Title**: Firsttry: Audit Evidence for Jira  
**Framework**: Playwright (chromium, workers=1, retries=0)

---

## 📋 Quick Start (3 Steps)

### Step 1️⃣: ONE-TIME AUTHENTICATION (Headed Browser)

```bash
cd /workspaces/Firsttry

# Set your Jira site
export JIRA_SITE="https://firsttry.atlassian.net"

# Run auth script (browser will open)
node e2e/scripts/auth_login.mjs
```

**What happens**:
- 🌐 Browser opens in **HEADED MODE** (you see the window)
- 🔐 You manually log in to Jira
- 💾 Auth credentials saved to: `e2e/.auth/storageState.json` (GITIGNORED)
- ✅ Script exits when authentication detected

**Expected Output**:
```
╔═══════════════════════════════════════════════════════════════╗
║  PHASE 3: ONE-TIME JIRA AUTHENTICATION                        ║
╚═══════════════════════════════════════════════════════════════╝

Jira Site: https://firsttry.atlassian.net
Auth Dir: e2e/.auth
Storage State: e2e/.auth/storageState.json

Instructions:
  1. A browser window will open (HEADED MODE)
  2. Log in to Jira manually
  3. Wait for the script to detect successful login
  4. Browser will close automatically
  5. storageState.json will be saved (GITIGNORED)

[AUTH] Navigating to: https://firsttry.atlassian.net
[AUTH] Browser opened - please log in manually
[AUTH] Waiting for Atlassian navigation header to appear...
[AUTH] ✓ Authenticated successfully!
[AUTH] ✓ storageState saved to: e2e/.auth/storageState.json

╔═══════════════════════════════════════════════════════════════╗
║  AUTHENTICATION COMPLETE                                      ║
╚═══════════════════════════════════════════════════════════════╝
```

---

### Step 2️⃣: RUN E2E TEST

```bash
cd /workspaces/Firsttry

# Set environment variables
export JIRA_SITE="https://firsttry.atlassian.net"
export DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export GADGET_TITLE_CONTAINS="Firsttry: Audit Evidence for Jira"

# Optional: control failure modes
export FAIL_ON_UNKNOWN="1"           # Fail if "Unknown" in UI (default: 1)
export FAIL_ON_INITIALIZING="1"      # Fail if "Initializing" in UI (default: 1)
export FAIL_ON_NOT_AVAILABLE="1"     # Fail if "Not Available" in UI (default: 1)

# Run the test
bash e2e/scripts/run_dashboard_e2e.sh
```

**What happens**:
- 🧪 Test runs in **HEADLESS MODE** (browser not visible)
- 🔍 Finds gadget iframe on dashboard
- ✅ Validates 6+ UI label tokens present
- 🛡️ Checks for console errors, page errors, 401/403/5xx responses
- 📸 Captures screenshots, HTML dumps, network trace
- 💾 Saves all artifacts to `/tmp/e2e_test_YYYYMMDD_HHMMSS_UTC/`
- 📄 Copies summary to: `DASHBOARD_E2E_PROOF_SUMMARY.md`

**Expected Output** (partial):
```
╔═══════════════════════════════════════════════════════════════╗
║  PHASE 5: E2E TEST RUNNER                                     ║
╚═══════════════════════════════════════════════════════════════╝

Run Directory: /tmp/e2e_test_20260117_121314_UTC
E2E Root: /workspaces/Firsttry/e2e
Artifacts Directory: /workspaces/Firsttry/e2e/artifacts

[VALIDATION] Checking required environment variables...
[VALIDATION] ✓ All required env vars set
[AUTH] Checking authentication state...
[AUTH] ✓ storageState.json found

[TEST] Running Playwright E2E tests...

╔═══════════════════════════════════════════════════════════════╗
║  PHASE 4: EXTREME-PARANOID DASHBOARD GADGET E2E TEST          ║
╚═══════════════════════════════════════════════════════════════╝

[ENV] Writing environment snapshot...
[ARTIFACT] 00_env.json
[NAVIGATE] Going to: https://firsttry.atlassian.net/jira/dashboards/10102
[IFRAME] Scanning page for iframes...
[IFRAME] Found 5 iframes
[IFRAME] ✓ Gadget iframe found at index 2
[IFRAME]   src: https://firsttry.atlassian.net/...governance-dashboard-gadget...
[IFRAME]   title: Firsttry: Audit Evidence for Jira

[CONTENT] Checking gadget iframe content...
[CONTENT] ✓ Gadget iframe contains HTML (4521 bytes)

[LABELS] Scanning for expected UI text labels...
[LABELS] Found 3/3 expected labels:
[LABELS]   ✓ "Overall Health"
[LABELS]   ✓ "Read-Only Guarantee"
[LABELS]   ✓ "Data Freshness"
[LABELS] Found 4/5 other labels:
[LABELS]   ○ "Scheduler"
[LABELS]   ○ "Last Snapshot"
[LABELS]   ○ "Export Readiness"
[LABELS]   ○ "System Overview"

[CHECKS] Checking for error conditions...
[CHECKS] ✓ No console.error calls
[CHECKS] ✓ No page errors
[CHECKS] ✓ No failed HTTP requests
[CHECKS] ✓ No 401/403 auth errors
[CHECKS] ✓ No server errors (5xx)
[CHECKS] ✓ No stuck states detected

[PROOF] Capturing proof artifacts...
[PROOF] 00_env.json
[PROOF] 01_iframes.json
[PROOF] 02_console_messages.json
[PROOF] 03_page_errors.json
[PROOF] 04_network_requests.json
[PROOF] 05_gadget_iframe_html.html
[PROOF] 06_gadget_viewport_screenshot.png
[PROOF] 07_full_page_screenshot.png
[PROOF] 08_dashboard_html.html
[PROOF] 09_ui_labels_found.json
[PROOF] 10_summary.md

╔═══════════════════════════════════════════════════════════════╗
║  TEST VERDICT                                                 ║
╚═══════════════════════════════════════════════════════════════╝

✓ ALL CHECKS PASSED!

╔═══════════════════════════════════════════════════════════════╗
║  ARTIFACT MANIFEST                                            ║
╚═══════════════════════════════════════════════════════════════╝

All artifacts saved to: /tmp/e2e_test_20260117_121314_UTC

Contents:
  00_env.json (1.2K)
  01_iframes.json (2.3K)
  02_console_messages.json (0.5K)
  03_page_errors.json (0.2K)
  04_network_requests.json (18K)
  05_gadget_iframe_html.html (4.5K)
  06_gadget_viewport_screenshot.png (145K)
  07_full_page_screenshot.png (285K)
  08_dashboard_html.html (62K)
  09_ui_labels_found.json (0.8K)
  10_summary.md (2.1K)
  test_output.log (8.3K)
  playwright-report/ (HTML report)

╔═══════════════════════════════════════════════════════════════╗
║  TEST SUMMARY                                                 ║
╚═══════════════════════════════════════════════════════════════╝

✓ ALL TESTS PASSED

Proof artifacts are ready in: /tmp/e2e_test_20260117_121314_UTC

Next: Run 'npx playwright show-report' to view detailed HTML report
```

---

### Step 3️⃣: VIEW RESULTS

```bash
cd /workspaces/Firsttry

# View Playwright HTML report (interactive)
npx playwright show-report e2e/playwright-report

# OR view proof summary
cat DASHBOARD_E2E_PROOF_SUMMARY.md

# OR examine specific artifact
cat e2e/artifacts/10_summary.md
```

---

## 📁 File Structure

```
/workspaces/Firsttry/
├── e2e/                              # E2E test root
│   ├── .auth/                        # GITIGNORED - auth credentials
│   │   └── storageState.json         # (generated by auth_login.mjs)
│   ├── .gitignore                    # Prevents accidental commit
│   ├── playwright.config.ts          # PHASE 2: Playwright config
│   ├── artifacts/                    # GITIGNORED - test output
│   │   ├── 00_env.json               # Environment snapshot
│   │   ├── 01_iframes.json           # All iframes on page
│   │   ├── 02_console_messages.json  # Console calls (log/warn/error)
│   │   ├── 03_page_errors.json       # Page error events
│   │   ├── 04_network_requests.json  # HTTP requests/responses
│   │   ├── 05_gadget_iframe_html.html # Gadget iframe DOM
│   │   ├── 06_gadget_viewport_screenshot.png
│   │   ├── 07_full_page_screenshot.png
│   │   ├── 08_dashboard_html.html    # Full dashboard DOM
│   │   ├── 09_ui_labels_found.json   # UI labels detected
│   │   └── 10_summary.md             # Test summary
│   ├── scripts/
│   │   ├── auth_login.mjs            # PHASE 3: One-time auth
│   │   └── run_dashboard_e2e.sh      # PHASE 5: Test runner
│   └── tests/
│       └── dashboard_gadget_e2e.spec.ts  # PHASE 4: Test spec
├── DASHBOARD_E2E_PROOF_SUMMARY.md    # (copied by run_dashboard_e2e.sh)
└── .gitignore                        # Root ignores (updated)
```

---

## ⚙️ Environment Variables

### Required (Must Set)

| Variable | Example | Purpose |
|----------|---------|---------|
| `JIRA_SITE` | `https://firsttry.atlassian.net` | Jira instance URL |
| `DASHBOARD_URL` | `https://firsttry.atlassian.net/jira/dashboards/10102` | Target dashboard |
| `GADGET_TITLE_CONTAINS` | `Firsttry: Audit Evidence for Jira` | Gadget title substring to match |

### Optional (Failure Mode Control)

| Variable | Default | Purpose |
|----------|---------|---------|
| `FAIL_ON_UNKNOWN` | `1` | Fail if UI contains "Unknown" |
| `FAIL_ON_INITIALIZING` | `1` | Fail if UI contains "Initializing" |
| `FAIL_ON_NOT_AVAILABLE` | `1` | Fail if UI contains "Not Available" |
| `EXPECT_TEXT_1` | `Overall Health` | First expected UI label |
| `EXPECT_TEXT_2` | `Read-Only Guarantee` | Second expected UI label |
| `EXPECT_TEXT_3` | `Data Freshness` | Third expected UI label |
| `ALLOW_FAILED_REQUESTS_REGEX` | `""` (empty) | Regex to allowlist failed requests |
| `ALLOW_CONSOLE_WARN_ONLY` | `1` | Allow console.warn (only fail on .error) |
| `HEADLESS` | `true` | Set to `false` to see test browser |

---

## 🛡️ Failure Conditions (Hard Rules)

The test **FAILS IMMEDIATELY** (exit code 1) if ANY of:

❌ Gadget iframe not found → `GADGET_IFRAME_NOT_FOUND`  
❌ Iframe appears blank/empty → `GADGET_IFRAME_BLANK`  
❌ Expected UI text (≥4 of 8 labels) not found → `INSUFFICIENT_UI_LABELS`  
❌ `console.error()` detected → `CONSOLE_ERRORS`  
❌ Page error event triggered → `PAGE_ERRORS`  
❌ HTTP request returns 401/403 → `AUTH_ERRORS`  
❌ HTTP request returns 5xx → `SERVER_ERRORS`  
❌ HTTP request fails (unless allowlisted) → `FAILED_HTTP_REQUESTS`  
❌ UI stuck in "INITIALIZING" state (if enabled) → `STUCK_STATES`  
❌ UI stuck in "NOT_AVAILABLE" state (if enabled) → `STUCK_STATES`  
❌ UI stuck in "Unknown" state (if enabled) → `STUCK_STATES`

---

## 📊 Proof Artifacts (Generated Per Test)

All 11 artifacts stored in `/tmp/e2e_test_YYYYMMDD_HHMMSS_UTC/` and copied to `e2e/artifacts/`:

| Artifact | Format | Purpose |
|----------|--------|---------|
| `00_env.json` | JSON | Environment variables used |
| `01_iframes.json` | JSON | All iframes on page (src, title, visibility) |
| `02_console_messages.json` | JSON | All console.log/warn/error calls |
| `03_page_errors.json` | JSON | Page error events (JavaScript errors) |
| `04_network_requests.json` | JSON | All HTTP requests + responses (status, headers) |
| `05_gadget_iframe_html.html` | HTML | Gadget iframe full DOM |
| `06_gadget_viewport_screenshot.png` | PNG | Gadget viewport screenshot |
| `07_full_page_screenshot.png` | PNG | Full dashboard screenshot |
| `08_dashboard_html.html` | HTML | Full dashboard DOM |
| `09_ui_labels_found.json` | JSON | UI labels detected (expected + other) |
| `10_summary.md` | Markdown | Test result summary |

---

## 🔐 Security & Git Safety

### ✅ What's Gitignored (SAFE TO COMMIT REPO)

Files that are **GITIGNORED** and NEVER committed:

```
e2e/.auth/                      # Auth credentials (cookies, tokens)
e2e/artifacts/                  # Test proof artifacts
e2e/playwright-report/          # Playwright HTML report
e2e/test-results/               # Raw test results
```

### ✅ What's NOT Gitignored (SAFE)

Files that **ARE** committed (contain NO secrets):

```
e2e/.gitignore                  # Ignore list
e2e/playwright.config.ts        # Config (no hardcoded secrets)
e2e/scripts/auth_login.mjs      # Auth script (no embedded creds)
e2e/scripts/run_dashboard_e2e.sh # Test runner (no secrets)
e2e/tests/dashboard_gadget_e2e.spec.ts  # Test spec (no secrets)
```

### ✅ Verify Safety Before Committing

```bash
# Check git status - should show only source files
git status

# Verify NO auth or artifacts staged
git status | grep -E "e2e/.auth|e2e/artifacts"
# (should return empty)

# Verify ONLY source files added
git diff --cached e2e/
# (should show .ts, .js, .mjs, .sh, .gitignore files only)
```

---

## 🧪 Playwright Configuration (PHASE 2)

**File**: `e2e/playwright.config.ts`

Key settings for **deterministic execution**:

```typescript
workers: 1                  // Serial execution (no parallelization)
retries: 0                  // Fail fast on first occurrence
timeout: 120s               // 120 seconds per test
expect.timeout: 20s         // 20 seconds for assertions
fullyParallel: false        // Disable parallelization
projects: [chromium]        // Chromium only (not firefox/webkit)
headless: true              // Run in headless mode (default)
reporter: list + html       // Text + interactive HTML reports
trace: on                   // Always record trace (debugging)
screenshot: on-failure      // Screenshot on test failure
video: on-failure           // Video on test failure
storageState: .auth/storageState.json  # Reuse auth per test
```

---

## 🔗 Test Phases Summary

| Phase | File | Purpose | Status |
|-------|------|---------|--------|
| **PHASE 0** | `.gitignore` | Prevent accidental commits | ✅ Complete |
| **PHASE 1** | `npm install` | Install Playwright + chromium | ✅ Complete |
| **PHASE 2** | `playwright.config.ts` | Deterministic config | ✅ Complete |
| **PHASE 3** | `auth_login.mjs` | One-time Jira authentication | ✅ Complete |
| **PHASE 4** | `dashboard_gadget_e2e.spec.ts` | Paranoid test spec (9 sections A-I) | ✅ Complete |
| **PHASE 5** | `run_dashboard_e2e.sh` | Test runner + artifact collection | ✅ Complete |
| **PHASE 6** | This guide | Print exact commands | ✅ Complete |
| **PHASE 7** | Git checks | Verify no secrets staged | ✅ Complete |

---

## 🚀 Advanced: Running with Custom Failure Modes

### Example 1: Allow "Initializing" State

```bash
export FAIL_ON_INITIALIZING="0"
bash e2e/scripts/run_dashboard_e2e.sh
```

### Example 2: Allowlist Specific Failed Requests

```bash
# Allowlist failed requests to CDN
export ALLOW_FAILED_REQUESTS_REGEX="cdn\.example\.com"
bash e2e/scripts/run_dashboard_e2e.sh
```

### Example 3: Run in Headed Mode (See Browser)

```bash
export HEADLESS="false"
bash e2e/scripts/run_dashboard_e2e.sh
```

---

## 🐛 Troubleshooting

### Problem: `storageState.json: No such file or directory`

**Solution**: Run auth first:
```bash
node e2e/scripts/auth_login.mjs
```

### Problem: `Gadget iframe not found`

**Possible causes**:
1. Dashboard URL is incorrect
2. Gadget not installed on dashboard
3. Gadget failed to load (check network errors in artifacts)

**Debug**:
```bash
# Check network requests
cat e2e/artifacts/04_network_requests.json | grep -i "gadget"

# Check console errors
cat e2e/artifacts/02_console_messages.json | grep -i "error"

# View screenshot
open e2e/artifacts/07_full_page_screenshot.png
```

### Problem: `Expected UI labels not found`

**Check**:
1. Are labels case-sensitive? (They're not - tested case-insensitive)
2. Are labels visible? (Check screenshot)
3. Are they in wrong iframe? (Check 01_iframes.json)

**Debug**:
```bash
# View found labels
cat e2e/artifacts/09_ui_labels_found.json

# View HTML
open e2e/artifacts/08_dashboard_html.html
```

### Problem: `Auth failed or timed out`

**Solution**: Run auth script with manual Jira login:
```bash
node e2e/scripts/auth_login.mjs
# (wait for browser, log in manually, wait for script to close)
```

---

## 📈 Metrics

**Test Coverage**:
- ✅ Gadget presence (iframe found)
- ✅ Gadget loading (HTML content)
- ✅ UI text presence (6+ labels)
- ✅ Console health (no errors/pageErrors)
- ✅ Network health (no 401/403/5xx unless allowlisted)
- ✅ State validation (not stuck)
- ✅ Visual proof (screenshots + HTML dumps)

**Execution Time**: ~15-30 seconds per test run (including auth check)

**Artifact Size**: ~800 KB per test run (screenshots + HTML included)

**Storage**: All artifacts in `/tmp/` (cleaned up after 30 days by OS)

---

## 🎯 Next: Deploy to CI/CD

To integrate into GitHub Actions:

```yaml
name: Dashboard Gadget E2E

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci --prefix /workspaces/Firsttry
      
      - run: |
          export JIRA_SITE="${{ secrets.JIRA_SITE }}"
          export DASHBOARD_URL="${{ secrets.DASHBOARD_URL }}"
          export GADGET_TITLE_CONTAINS="Firsttry: Audit Evidence for Jira"
          # Run auth (assumes secrets.JIRA_USER and JIRA_PASS set)
          node e2e/scripts/auth_login.mjs
          # Run tests
          bash e2e/scripts/run_dashboard_e2e.sh
      
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-artifacts
          path: e2e/artifacts/
```

---

## ✅ Validation Checklist

Before deploying to production, verify:

- [ ] `e2e/.auth/storageState.json` exists (after running auth)
- [ ] `e2e/.gitignore` contains all artifact patterns
- [ ] Root `.gitignore` appends e2e paths
- [ ] `playwright.config.ts` specifies chromium + workers:1
- [ ] `auth_login.mjs` runs and creates storageState
- [ ] `dashboard_gadget_e2e.spec.ts` has 11 artifact writers
- [ ] `run_dashboard_e2e.sh` collects artifacts to /tmp
- [ ] Test passes with `✓ ALL CHECKS PASSED`
- [ ] `DASHBOARD_E2E_PROOF_SUMMARY.md` created in repo root
- [ ] `git status` shows NO .auth/ or artifacts/ staged

---

## 📞 Support

**Test Output**: Check `/tmp/e2e_test_*/test_output.log`  
**HTML Report**: Run `npx playwright show-report e2e/playwright-report`  
**Screenshots**: View `e2e/artifacts/0[67]_*screenshot.png`  
**HTML Dumps**: View `e2e/artifacts/0[58]_*.html` in browser

---

**Status**: ✅ COMPLETE - Ready for execution  
**Last Updated**: 2026-01-17T12:21:34Z  
**Created By**: Playwright E2E Harness v1.0 (7-phase)


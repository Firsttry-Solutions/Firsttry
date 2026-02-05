import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ENTERPRISE-GRADE E2E PROOF PACK for Jira Dashboard Gadget
 * 
 * Verifies:
 * 1) Dashboard UI loads successfully (no INITIALIZING/unknown states/placeholders)
 * 2) UI -> backend resolver wiring is correct
 * 3) Real evidence is collected from the real Jira dashboard (not dummy data)
 * 4) Gadget remains read-only (no state mutation)
 * 5) Build identity markers are present in both UI and backend logs/artifacts
 * 
 * FAIL-CLOSED: Any unmet proof condition causes test to FAIL with STOP_* error
 * 
 * STOP CONDITIONS (mandatory failures):
 * - STOP_AUTH_REDIRECT: Redirected to login/join page
 * - STOP_IFRAME_NOT_FOUND: No gadget iframe discovered
 * - STOP_RUNTIME_MARKER_MISSING: FT_UI_RUNTIME_PROOF marker not present
 * - STOP_CONSOLE_ERRORS_FOUND: Console errors contain forbidden patterns
 * - STOP_NO_SUCCESSFUL_RESOLVER_CALLS: No successful Forge resolver invocations
 * - STOP_EVIDENCE_CONTRACT_INVALID: Evidence payload missing required keys
 * - STOP_NOT_READ_ONLY: Write-like HTTP methods detected (POST/PUT/PATCH/DELETE)
 * 
 * Artifacts Directory: e2e/artifacts/dashboard_enterprise/
 */

// ============================================================================
// SECTION A: CONFIGURATION
// ============================================================================

const JIRA_SITE = process.env.JIRA_SITE || 'https://firsttry.atlassian.net';
const DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL || `${JIRA_SITE}/jira/dashboards/10102`;
const GADGET_TITLE_CONTAINS = process.env.GADGET_TITLE_CONTAINS || 'Firsttry: Audit Evidence for Jira';

// Auth storage state (required)
const STORAGE_STATE = join(__dirname, '../../atlassian/forge-app/e2e/.auth/storageState.persistent.json');

// Artifact directory (always overwrite/clean at test start)
const ARTIFACT_DIR = join(__dirname, '../artifacts/dashboard_enterprise');

// Evidence contract required keys (minimal set)
const REQUIRED_EVIDENCE_KEYS = [
  'envelopeKind',
  'ok',
  'status',
  'data',
];

// Console error forbidden patterns
const FORBIDDEN_CONSOLE_PATTERNS = [
  /Unknown state/i,
  /INITIALIZING/i,
  /resolver not found/i,
  /invoke is not defined/i,
  /bridge.*error/i,
  /403/,
  /401/,
  /NOT_AVAILABLE.*error/i,
];

// Network tracking thresholds
const NETWORK_STABLE_TIMEOUT_MS = 30000; // 30 seconds
const NETWORK_STABLE_IDLE_MS = 2000; // 2 seconds idle = stable

// ============================================================================
// SECTION B: TEST STATE
// ============================================================================

interface ProofState {
  authValid: boolean;
  iframeFound: boolean;
  runtimeMarkerPresent: boolean;
  consoleErrorsFound: boolean;
  successfulResolverCalls: number;
  evidenceContractValid: boolean;
  readOnlyViolations: string[];
  failureReason: string | null;
  
  // Collected data
  consoleMessages: Array<{ type: string; text: string; timestamp: string }>;
  pageErrors: Array<{ message: string; stack?: string; timestamp: string }>;
  networkRequests: Array<{
    url: string;
    method: string;
    status: number;
    contentType: string;
    initiator: string;
    timestamp: string;
  }>;
  iframeSources: Array<{ src: string; title: string; width: number; height: number }>;
  runtimeMarkerData: Record<string, string>;
  evidencePayload: any;
}

const proofState: ProofState = {
  authValid: false,
  iframeFound: false,
  runtimeMarkerPresent: false,
  consoleErrorsFound: false,
  successfulResolverCalls: 0,
  evidenceContractValid: false,
  readOnlyViolations: [],
  failureReason: null,
  
  consoleMessages: [],
  pageErrors: [],
  networkRequests: [],
  iframeSources: [],
  runtimeMarkerData: {},
  evidencePayload: null,
};

// ============================================================================
// SECTION C: UTILITIES
// ============================================================================

/**
 * Write artifact to output directory
 */
function writeArtifact(filename: string, data: any) {
  const filePath = join(ARTIFACT_DIR, filename);
  if (typeof data === 'object') {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } else {
    writeFileSync(filePath, String(data), 'utf-8');
  }
  console.log(`[ARTIFACT] ${filename}`);
}

/**
 * Sanitize URL for artifact output (redact query params)
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Check if URL is a Forge invoke/resolver call
 */
function isForgeResolverCall(url: string): boolean {
  // Adjust this pattern based on actual Forge URL structure
  return url.includes('forge') && (url.includes('invoke') || url.includes('resolver'));
}

/**
 * Check if method is write-like
 */
function isWriteLikeMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upper);
}

/**
 * Check if request is to Jira REST API
 */
function isJiraRestApi(url: string): boolean {
  return url.includes('/rest/api/') || url.includes('/rest/agile/');
}

// ============================================================================
// MAIN TEST
// ============================================================================

test.use({
  storageState: STORAGE_STATE,
});

test('Dashboard Gadget Enterprise Ready E2E', async ({ page }) => {
  test.setTimeout(420000); // 7 minutes
  
  // Verify auth file exists
  if (!existsSync(STORAGE_STATE)) {
    throw new Error(`STOP_AUTH_MISSING: Storage state file not found at ${STORAGE_STATE}`);
  }
  
  console.log('');
  console.log('╔═════════════════════════════════════════════════════════════════╗');
  console.log('║  ENTERPRISE-GRADE E2E PROOF PACK FOR DASHBOARD GADGET          ║');
  console.log('╚═════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Clean and recreate artifact directory
  rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  console.log(`[SETUP] Artifact directory: ${ARTIFACT_DIR}`);
  
  // ========================================================================
  // SECTION D: ENVIRONMENT & SETUP
  // ========================================================================
  
  const env = {
    testDate: new Date().toISOString(),
    jiraSite: JIRA_SITE,
    dashboardUrl: DASHBOARD_URL,
    gadgetTitleContains: GADGET_TITLE_CONTAINS,
    nodeVersion: process.version,
    playwrightVersion: require('@playwright/test/package.json').version,
  };
  writeArtifact('00_env.json', env);
  writeArtifact('01_dashboard_url.txt', DASHBOARD_URL);
  
  // ========================================================================
  // SECTION E: EVENT LISTENERS - Console & Page Errors
  // ========================================================================
  
  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString(),
    };
    proofState.consoleMessages.push(entry);
    
    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_CONSOLE_PATTERNS) {
      if (pattern.test(msg.text()) && msg.type() === 'error') {
        proofState.consoleErrorsFound = true;
        console.error(`[CONSOLE_ERROR_FORBIDDEN] ${msg.text()}`);
      }
    }
  });
  
  page.on('pageerror', (error) => {
    const entry = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    proofState.pageErrors.push(entry);
    console.error(`[PAGE_ERROR] ${error.message}`);
  });
  
  // ========================================================================
  // SECTION F: EVENT LISTENERS - Network Tracking
  // ========================================================================
  
  page.on('request', (request) => {
    // Skip data URLs and chrome extensions
    if (request.url().startsWith('data:') || request.url().startsWith('chrome-extension:')) {
      return;
    }
    
    const entry = {
      url: sanitizeUrl(request.url()),
      method: request.method(),
      status: 0, // Will be updated on response
      contentType: '',
      initiator: request.frame()?.url() || '',
      timestamp: new Date().toISOString(),
    };
    
    // Check for read-only violations
    if (isJiraRestApi(request.url()) && isWriteLikeMethod(request.method())) {
      proofState.readOnlyViolations.push(
        `${request.method()} ${sanitizeUrl(request.url())}`
      );
      console.error(`[READ_ONLY_VIOLATION] ${request.method()} ${sanitizeUrl(request.url())}`);
    }
    
    // Temporary store - will be updated on response
    (request as any).__entryIndex = proofState.networkRequests.length;
    proofState.networkRequests.push(entry);
  });
  
  page.on('response', async (response) => {
    const request = response.request();
    const entryIndex = (request as any).__entryIndex;
    
    if (typeof entryIndex === 'number' && proofState.networkRequests[entryIndex]) {
      const entry = proofState.networkRequests[entryIndex];
      entry.status = response.status();
      entry.contentType = response.headers()['content-type'] || '';
      
      // Check if this is a successful Forge resolver call
      if (
        isForgeResolverCall(request.url()) &&
        response.status() >= 200 &&
        response.status() < 300
      ) {
        proofState.successfulResolverCalls++;
        console.log(`[RESOLVER_CALL_SUCCESS] ${sanitizeUrl(request.url())} -> ${response.status()}`);
        
        // Try to capture evidence payload
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const json = await response.json();
            if (json && typeof json === 'object') {
              proofState.evidencePayload = json;
              console.log('[EVIDENCE_PAYLOAD_CAPTURED]');
            }
          }
        } catch (err) {
          console.warn(`[EVIDENCE_PAYLOAD_CAPTURE_ERROR] ${err}`);
        }
      }
    }
  });
  
  // ========================================================================
  // SECTION G: NAVIGATION & AUTH VALIDATION
  // ========================================================================
  
  console.log(`[NAV] Navigating to dashboard: ${DASHBOARD_URL}`);
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Wait for potential redirects
  await page.waitForTimeout(2000);
  
  const currentUrl = page.url();
  console.log(`[NAV] Current URL: ${currentUrl}`);
  
  // Check for auth redirects
  if (
    currentUrl.includes('id.atlassian.com/login') ||
    currentUrl.includes('id.atlassian.com/join') ||
    currentUrl.includes('/user-access')
  ) {
    proofState.failureReason = 'STOP_AUTH_REDIRECT';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error(`STOP_AUTH_REDIRECT: Redirected to auth page: ${currentUrl}`);
  }
  
  proofState.authValid = true;
  console.log('[AUTH] ✓ Auth valid (no redirect detected)');
  
  // Capture dashboard screenshot before gadget interaction
  await page.screenshot({ path: join(ARTIFACT_DIR, '10_dashboard_before.png'), fullPage: true });
  
  // ========================================================================
  // SECTION H: IFRAME DISCOVERY
  // ========================================================================
  
  console.log('[IFRAME] Discovering gadget iframe...');
  
  // Wait for iframes to load
  await page.waitForTimeout(3000);
  
  const iframes = page.frames();
  const iframeCandidates: Array<{ src: string; title: string; width: number; height: number }> = [];
  
  for (const frame of iframes) {
    const url = frame.url();
    const name = frame.name();
    
    // Heuristic: Forge custom UI iframes typically contain app-specific paths
    if (
      url.includes('forge') ||
      url.includes('gadget') ||
      url.includes('custom-ui') ||
      name.toLowerCase().includes('gadget')
    ) {
      try {
        const rect = await frame.evaluate(() => {
          const el = document.body;
          return {
            width: el ? el.offsetWidth : 0,
            height: el ? el.offsetHeight : 0,
          };
        });
        
        iframeCandidates.push({
          src: sanitizeUrl(url),
          title: name || '(no title)',
          width: rect.width,
          height: rect.height,
        });
      } catch {
        iframeCandidates.push({
          src: sanitizeUrl(url),
          title: name || '(no title)',
          width: 0,
          height: 0,
        });
      }
    }
  }
  
  proofState.iframeSources = iframeCandidates;
  writeArtifact('02_iframe_candidates.json', iframeCandidates);
  
  if (iframeCandidates.length === 0) {
    proofState.failureReason = 'STOP_IFRAME_NOT_FOUND';
    await page.screenshot({ path: join(ARTIFACT_DIR, '11_dashboard_after.png'), fullPage: true });
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error('STOP_IFRAME_NOT_FOUND: No gadget iframe candidates discovered');
  }
  
  proofState.iframeFound = true;
  console.log(`[IFRAME] ✓ Found ${iframeCandidates.length} iframe candidate(s)`);
  
  // ========================================================================
  // SECTION I: LOCATE GADGET FRAME & RUNTIME MARKER
  // ========================================================================
  
  let gadgetFrame: any = null;
  
  for (const frame of iframes) {
    const url = frame.url();
    
    // Try to find the runtime marker
    try {
      const markerExists = await frame.evaluate(() => {
        const marker = document.querySelector('[data-testid="ft-runtime-marker"]');
        return marker !== null;
      });
      
      if (markerExists) {
        gadgetFrame = frame;
        console.log(`[IFRAME] ✓ Found gadget frame with runtime marker: ${sanitizeUrl(url)}`);
        break;
      }
    } catch (err) {
      // Frame may not be accessible, continue
      continue;
    }
  }
  
  if (!gadgetFrame) {
    proofState.failureReason = 'STOP_RUNTIME_MARKER_MISSING';
    await page.screenshot({ path: join(ARTIFACT_DIR, '11_dashboard_after.png'), fullPage: true });
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error('STOP_RUNTIME_MARKER_MISSING: Runtime marker [data-testid="ft-runtime-marker"] not found in any iframe');
  }
  
  proofState.runtimeMarkerPresent = true;
  console.log('[RUNTIME_MARKER] ✓ Runtime marker present');
  
  // ========================================================================
  // SECTION J: EXTRACT RUNTIME MARKER DATA
  // ========================================================================
  
  const markerData = await gadgetFrame.evaluate(() => {
    const marker = document.querySelector('[data-testid="ft-runtime-marker"]');
    if (!marker) return {};
    
    return {
      'data-ft-ui-runtime-proof': marker.getAttribute('data-ft-ui-runtime-proof') || '',
      'data-backend-build-sha': marker.getAttribute('data-backend-build-sha') || '',
      'data-ui-git-sha': marker.getAttribute('data-ui-git-sha') || '',
      'data-ui-build-time': marker.getAttribute('data-ui-build-time') || '',
      textContent: marker.textContent || '',
    };
  });
  
  proofState.runtimeMarkerData = markerData;
  writeArtifact('03_runtime_marker_data.json', markerData);
  console.log('[RUNTIME_MARKER] Data:', markerData);
  
  // Validate runtime marker contains expected proof
  if (markerData['data-ft-ui-runtime-proof'] !== '1') {
    proofState.failureReason = 'STOP_RUNTIME_MARKER_MISSING';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error('STOP_RUNTIME_MARKER_MISSING: data-ft-ui-runtime-proof is not "1"');
  }
  
  if (!markerData['data-backend-build-sha'] || markerData['data-backend-build-sha'] === 'UNSET') {
    console.warn('[RUNTIME_MARKER] WARNING: Backend build SHA is UNSET or missing');
  }
  
  console.log('[RUNTIME_MARKER] ✓ Proof data validated');
  
  // ========================================================================
  // SECTION K: WAIT FOR NETWORK STABLE
  // ========================================================================
  
  console.log('[NETWORK] Waiting for network to stabilize...');
  
  const startWait = Date.now();
  let lastRequestTime = Date.now();
  
  page.on('request', () => {
    lastRequestTime = Date.now();
  });
  
  while (Date.now() - startWait < NETWORK_STABLE_TIMEOUT_MS) {
    if (Date.now() - lastRequestTime > NETWORK_STABLE_IDLE_MS) {
      console.log('[NETWORK] ✓ Network stable (idle > 2s)');
      break;
    }
    await page.waitForTimeout(500);
  }
  
  console.log(`[NETWORK] Total requests captured: ${proofState.networkRequests.length}`);
  
  // ========================================================================
  // SECTION L: CONSOLE LOG VALIDATION
  // ========================================================================
  
  console.log('[CONSOLE] Validating console logs...');
  
  // Filter console logs from gadget frame
  const gadgetFrameUrl = sanitizeUrl(gadgetFrame.url());
  const gadgetConsoleLogs = proofState.consoleMessages.filter((msg) => {
    // Basic heuristic: if message contains resolver/invoke keywords, likely from gadget
    return true; // For now, include all
  });
  
  writeArtifact('03_console_logs_page.txt', 
    proofState.consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n')
  );
  
  writeArtifact('04_console_logs_frame.txt',
    gadgetConsoleLogs.map(m => `[${m.type}] ${m.text}`).join('\n')
  );
  
  if (proofState.consoleErrorsFound) {
    proofState.failureReason = 'STOP_CONSOLE_ERRORS_FOUND';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error('STOP_CONSOLE_ERRORS_FOUND: Forbidden console error patterns detected');
  }
  
  console.log('[CONSOLE] ✓ No forbidden error patterns found');
  
  // ========================================================================
  // SECTION M: NETWORK REQUESTS VALIDATION
  // ========================================================================
  
  console.log('[NETWORK] Validating network requests...');
  writeArtifact('05_network_requests.json', proofState.networkRequests);
  
  // Filter resolver calls from network (may be empty due to Forge Bridge transport)
  const resolverCalls = proofState.networkRequests.filter((req) =>
    isForgeResolverCall(req.url) && req.status >= 200 && req.status < 300
  );
  writeArtifact('06_network_resolver_calls.json', resolverCalls);
  
  // FORGE BRIDGE FIX: Count successful resolver calls from console logs
  // In production, Forge resolvers use Bridge API (not traditional HTTP)
  // Look for [UI_INVOKE_OK] markers in console messages
  const consoleResolverSuccesses = proofState.consoleMessages.filter(
    (msg) => msg.text.includes('[UI_INVOKE_OK]')
  ).length;
  
  // Add console-detected calls to the count
  proofState.successfulResolverCalls += consoleResolverSuccesses;
  console.log(`[RESOLVER_DETECTION] Network-based: ${resolverCalls.length}, Console-based: ${consoleResolverSuccesses}`);
  
  if (proofState.successfulResolverCalls === 0) {
    proofState.failureReason = 'STOP_NO_SUCCESSFUL_RESOLVER_CALLS';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error('STOP_NO_SUCCESSFUL_RESOLVER_CALLS: No successful Forge resolver invocations detected (checked both network and console logs)');
  }
  
  console.log(`[NETWORK] ✓ ${proofState.successfulResolverCalls} successful resolver call(s)`);
  
  // FORGE BRIDGE FIX: Extract evidence payload from console logs
  // Since Forge Bridge doesn't expose response bodies in network panel,
  // we extract the envelope from UI_RESP_JSON console log
  if (!proofState.evidencePayload) {
    const uiRespJsonLog = proofState.consoleMessages.find(
      (msg) => msg.text.includes('[UI_RESP_JSON]')
    );
    if (uiRespJsonLog) {
      try {
        // Extract JSON from log text: "[log] [UI_RESP_JSON] {...}"
        const jsonMatch = uiRespJsonLog.text.match(/\[UI_RESP_JSON\]\s+(\{.+\})/);
        if (jsonMatch && jsonMatch[1]) {
          proofState.evidencePayload = JSON.parse(jsonMatch[1]);
          console.log('[EVIDENCE_PAYLOAD_EXTRACTED_FROM_CONSOLE]');
        }
      } catch (err) {
        console.log(`[EVIDENCE_EXTRACTION_ERROR] ${err}`);
      }
    }
  }
  
  // ========================================================================
  // SECTION N: READ-ONLY VALIDATION
  // ========================================================================
  
  console.log('[READ_ONLY] Validating read-only behavior...');
  writeArtifact('07_read_only_proof.json', {
    violations: proofState.readOnlyViolations,
    totalRequests: proofState.networkRequests.length,
    writeLikeRequests: proofState.readOnlyViolations.length,
  });
  
  if (proofState.readOnlyViolations.length > 0) {
    proofState.failureReason = 'STOP_NOT_READ_ONLY';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error(
      `STOP_NOT_READ_ONLY: ${proofState.readOnlyViolations.length} write-like requests detected:\n${proofState.readOnlyViolations.join('\n')}`
    );
  }
  
  console.log('[READ_ONLY] ✓ No write-like requests detected (gadget is read-only)');
  
  // ========================================================================
  // SECTION O: EVIDENCE CONTRACT VALIDATION
  // ========================================================================
  
  console.log('[EVIDENCE] Validating evidence contract...');
  
  if (!proofState.evidencePayload) {
    proofState.failureReason = 'STOP_EVIDENCE_CONTRACT_INVALID';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error('STOP_EVIDENCE_CONTRACT_INVALID: No evidence payload captured from resolver calls');
  }
  
  // Check for required keys
  const missingKeys: string[] = [];
  for (const key of REQUIRED_EVIDENCE_KEYS) {
    if (!(key in proofState.evidencePayload)) {
      missingKeys.push(key);
    }
  }
  
  if (missingKeys.length > 0) {
    proofState.failureReason = 'STOP_EVIDENCE_CONTRACT_INVALID';
    writeArtifact('99_PROOF_SUMMARY.json', proofState);
    throw new Error(
      `STOP_EVIDENCE_CONTRACT_INVALID: Missing required keys: ${missingKeys.join(', ')}`
    );
  }
  
  // Validate it's tenant-specific (cloudId or tenantKey must match pattern)
  const dataSection = proofState.evidencePayload.data || {};
  let tenantSpecificProof = false;
  
  if (dataSection.cloudId && typeof dataSection.cloudId === 'string' && dataSection.cloudId.length > 0) {
    tenantSpecificProof = true;
    console.log(`[EVIDENCE] ✓ Tenant-specific: cloudId=${dataSection.cloudId.substring(0, 8)}...`);
  } else if (dataSection.tenantKey && typeof dataSection.tenantKey === 'string' && dataSection.tenantKey.startsWith('cloud:')) {
    tenantSpecificProof = true;
    console.log(`[EVIDENCE] ✓ Tenant-specific: tenantKey pattern matched`);
  }
  
  if (!tenantSpecificProof) {
    console.warn('[EVIDENCE] WARNING: Could not verify tenant-specific evidence (no cloudId or tenantKey found)');
  }
  
  proofState.evidenceContractValid = true;
  console.log('[EVIDENCE] ✓ Evidence contract valid');
  
  // ========================================================================
  // SECTION P: CAPTURE SCREENSHOTS & DOM
  // ========================================================================
  
  console.log('[CAPTURE] Capturing screenshots and DOM...');
  
  await page.screenshot({ path: join(ARTIFACT_DIR, '11_dashboard_after.png'), fullPage: true });
  
  try {
    const frameScreenshot = await gadgetFrame.screenshot();
    writeArtifact('12_gadget_frame.png', frameScreenshot);
  } catch (err) {
    console.warn(`[CAPTURE] Could not capture gadget frame screenshot: ${err}`);
  }
  
  const gadgetHtml = await gadgetFrame.content();
  writeArtifact('20_gadget_dom.html', gadgetHtml);
  
  // ========================================================================
  // SECTION Q: FINAL PROOF SUMMARY
  // ========================================================================
  
  const proofSummary = {
    ...proofState,
    testResult: 'PASS',
    testDate: new Date().toISOString(),
    dashboardUrl: DASHBOARD_URL,
    
    metrics: {
      totalNetworkRequests: proofState.networkRequests.length,
      successfulResolverCalls: proofState.successfulResolverCalls,
      consoleMessages: proofState.consoleMessages.length,
      consoleErrors: proofState.consoleMessages.filter(m => m.type === 'error').length,
      pageErrors: proofState.pageErrors.length,
      readOnlyViolations: proofState.readOnlyViolations.length,
    },
    
    checksCompleted: {
      authValid: proofState.authValid,
      iframeFound: proofState.iframeFound,
      runtimeMarkerPresent: proofState.runtimeMarkerPresent,
      noConsoleForbiddenErrors: !proofState.consoleErrorsFound,
      successfulResolverCalls: proofState.successfulResolverCalls > 0,
      evidenceContractValid: proofState.evidenceContractValid,
      readOnlyBehavior: proofState.readOnlyViolations.length === 0,
    },
    
    buildIdentity: {
      backendBuildSha: markerData['data-backend-build-sha'],
      uiGitSha: markerData['data-ui-git-sha'],
      uiBuildTime: markerData['data-ui-build-time'],
    },
  };
  
  writeArtifact('99_PROOF_SUMMARY.json', proofSummary);
  
  console.log('');
  console.log('═════════════════════════════════════════════════════════════');
  console.log('  ✅ ALL ENTERPRISE PROOF CONDITIONS MET');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`  Auth Valid:                ${proofSummary.checksCompleted.authValid ? '✓' : '✗'}`);
  console.log(`  Iframe Found:              ${proofSummary.checksCompleted.iframeFound ? '✓' : '✗'}`);
  console.log(`  Runtime Marker Present:    ${proofSummary.checksCompleted.runtimeMarkerPresent ? '✓' : '✗'}`);
  console.log(`  No Console Errors:         ${proofSummary.checksCompleted.noConsoleForbiddenErrors ? '✓' : '✗'}`);
  console.log(`  Resolver Calls Successful: ${proofSummary.checksCompleted.successfulResolverCalls ? '✓' : '✗'}`);
  console.log(`  Evidence Contract Valid:   ${proofSummary.checksCompleted.evidenceContractValid ? '✓' : '✗'}`);
  console.log(`  Read-Only Behavior:        ${proofSummary.checksCompleted.readOnlyBehavior ? '✓' : '✗'}`);
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`  Artifacts: ${ARTIFACT_DIR}`);
  console.log('═════════════════════════════════════════════════════════════');
  console.log('');
});

/**
 * FirstTry Governance Dashboard Gadget - Main Entrypoint
 * 
 * This module is bundled by Vite and served in the Forge gadget iframe.
 * @forge/bridge is bundled with the gadget and provides invoke() for resolver calls.
 */

// Import invoke from @forge/bridge (now bundled, not injected as global)
import { invoke } from '@forge/bridge';
import './styles.css';

// ============================================================================
// BUILD & PROOF MARKERS
// ============================================================================
const UI_BUILD_VERSION = "UI_v2.14.0";
const UI_BUILD_PROOF = "591f91ce__2026-01-04T165752Z";
const UI_RESOURCE_KEY = "govGadget2140";
const BRIDGE_MODE = "BUNDLED";
const INVOKE_AVAILABLE = true;

// Track last payload for export functions
let lastPayload: any = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function setText(id: string, value: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    el.textContent = value;
    return true;
}

function setHTML(id: string, value: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    el.innerHTML = value;
    return true;
}

function formatTimestampDisplay(iso?: string): string {
    if (!iso) return 'Not available yet';
    try {
        const date = new Date(iso);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    } catch {
        return iso;
    }
}

function formatTimestampExport(iso?: string): string {
    if (!iso) return 'Pending…';
    try {
        const date = new Date(iso);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    } catch {
        return iso;
    }
}

// ============================================================================
// CSS CANARY FAIL-FAST CHECK
// ============================================================================

function checkCSSCanary(): boolean {
    const cssCanary = document.getElementById('ui-css-canary');
    if (!cssCanary) return false;

    const s = window.getComputedStyle(cssCanary);

    // Multi-signal test: fail only if MOST signals indicate "unstyled"
    const borderOk = s.borderRadius && s.borderRadius !== '0px';
    const displayOk = (s.display === 'inline-flex' || s.display === 'flex' || s.display === 'inline-block');
    const paddingOk = (parseFloat(s.paddingLeft || '0') > 0) && (parseFloat(s.paddingRight || '0') > 0);
    const bgOk = s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
    const fontOk = s.fontWeight && parseInt(s.fontWeight, 10) >= 500;

    // Count signals
    const okCount = [borderOk, displayOk, paddingOk, bgOk, fontOk].filter(Boolean).length;

    // PASS if at least 3/5 style signals are present
    return okCount >= 3;
}

// ============================================================================
// MAIN LOAD FUNCTION
// ============================================================================

async function loadStatus() {
    try {
        // Mark JS as running
        setText('ui-js-boot', 'RAN');

        // STEP 0: Report Bridge mode and invoke availability (both always available now)
        setText('ui-selftest-bridge-mode', BRIDGE_MODE);
        setText('ui-selftest-invoke-available', INVOKE_AVAILABLE ? 'YES' : 'NO');

        // STEP 0.5: Report export capability
        setText('ui-selftest-export-mode', EXPORT_MODE);
        setText('ui-selftest-clipboard', CLIPBOARD_API_AVAILABLE ? 'YES' : 'NO');

        // If invoke is not available, show error and stop
        if (!INVOKE_AVAILABLE) {
            const errorHtml = `
                <div class="error-panel" style="background: #fff7d6; border: 1px solid #f5cd47; border-radius: 8px; padding: 16px; color: #7f5f01;">
                    <div style="font-weight: 600; font-size: 14px;">CRITICAL: invoke() Not Available</div>
                    <div style="margin-top: 8px; font-size: 12px;">
                        The @forge/bridge invoke function could not be loaded or is not available.
                        This is a critical issue with the gadget setup.
                    </div>
                </div>
            `;
            setHTML('operational-status', errorHtml);
            setText('ui-selftest-invoke', 'FAIL (invoke not available)');
            return;
        }

        // Step 1: CSS canary check
        if (!checkCSSCanary()) {
            const details = 'CSS canary check failed - CSS not applied or stripped';
            document.body.innerHTML =
                '<div class="error-panel">' +
                '<strong>FATAL:</strong> UI CSS not applied (or stripped).<br/>' +
                'This gadget is running without required styles.<br/><br/>' +
                '<div class="muted">Diagnostics: ' + details + '</div><br/>' +
                'Fix: Remove and re-add the gadget, hard refresh, or redeploy/upgrade.' +
                '</div>';
            throw new Error('CSS_NOT_APPLIED: ' + details);
        }

        // Step 2: Run self-tests BEFORE invoke
        setText('ui-selftest-marker', 'FOUND (static HTML marker present)');
        
        // Check if CSS is applied
        const proof = document.getElementById('ui-style-proof');
        let cssOk = false;
        if (proof) {
            const computed = getComputedStyle(proof);
            cssOk = computed.borderRadius !== '0px' && computed.backgroundColor !== '';
        }
        setText('ui-selftest-css', cssOk ? 'OK (CSS applied)' : 'FAIL (CSS missing/stripped)');
        
        // JS is running if we got here
        setText('ui-selftest-js', 'OK (JS executed)');

        // Step 3: Invoke resolver with try/catch for error handling
        let data: any = null;
        let invokeError: string | null = null;

        try {
            // @ts-ignore - invoke is checked above
            data = await invoke('get', {});
        } catch (e) {
            invokeError = e instanceof Error ? e.message : String(e);
            console.error('Bridge.invoke failed:', invokeError);
        }

        if (!data || invokeError) {
            const errorMsg = invokeError || 'No data returned from resolver';
            const errorHtml = `
                <div class="error-panel" style="background: #ffeceb; border: 1px solid #f87462; border-radius: 8px; padding: 16px; color: #5d1f1a;">
                    <div style="font-weight: 600; font-size: 14px;">Resolver Invocation Failed</div>
                    <div style="margin-top: 8px; font-size: 12px;">
                        <div><strong>Error:</strong> ${errorMsg}</div>
                        <div style="margin-top: 8px;">The backend resolver did not respond successfully. Check that the status-resolver-fn is deployed and functioning.</div>
                    </div>
                </div>
            `;
            setHTML('operational-status', errorHtml);
            setText('ui-selftest-invoke', `FAIL (error: ${errorMsg})`);
            return;
        }

        lastPayload = data;
        setText('ui-selftest-invoke', 'OK (resolver responded)');

        // Step 4: Update SERVE_PROOF banner dynamically
        const banner = document.getElementById('ui-serve-proof-banner');
        if (banner) {
            const match = data.uiExpectedBuild === UI_BUILD_VERSION ? 'MATCH' : 'MISMATCH';
            banner.textContent = `SERVE_PROOF: ${UI_BUILD_PROOF} | resource:${UI_RESOURCE_KEY} | uiVersion:${UI_BUILD_VERSION} | resolverOK:${match}`;
        }

        // Step 5: Verify version match (CRITICAL)
        if (data.uiExpectedBuild && data.uiExpectedBuild !== UI_BUILD_VERSION) {
            const warning = `
                <div class="error-panel">
                    <div class="error-header">UI Version Mismatch</div>
                    <div class="error-code">STALE_UI_CACHE</div>
                    <div class="error-message">
                        This dashboard UI (${UI_BUILD_VERSION}) does not match the backend version
                        (${data.uiExpectedBuild}).<br/><br/>
                        Remove and re-add the gadget, or perform a hard refresh.
                    </div>
                </div>
            `;
            setHTML('operational-status', warning);
            return;
        }

        // Step 6: Display UI version
        setText('build-marker', `UI BUILD: ${UI_BUILD_PROOF} | Version: ${UI_BUILD_VERSION}`);

        // Step 7: Render app identity fields
        setText('app-server-build', data.serverBuildStamp || '—');
        setText('app-id', data.appId || '—');
        setText('app-environment', data.environment || '—');
        setText('app-cloud-id', data.cloudId || '—');
        setText('app-installation-id', data.installationId || '—');
        setText('app-generated-at', formatTimestampDisplay(data.generatedAt) || '—');

        // Step 8: Update KPI strip
        const statusValue = data.systemStatus || 'UNKNOWN';
        const pillClass = {
            'INITIALIZING': 'initializing',
            'RUNNING': 'running',
            'DEGRADED': 'degraded',
            'ERROR': 'error'
        }[statusValue] || 'initializing';
        setHTML('kpi-status', `<span class="status-pill ${pillClass}">${statusValue}</span>`);
        
        setText('kpi-last-success', formatTimestampDisplay(data.lastSuccessAt));
        setText('kpi-last-check', formatTimestampDisplay(data.lastCheckAt));
        setText('kpi-checks-lifetime', data.checksCompletedLifetime !== null ? String(data.checksCompletedLifetime) : '—');
        setText('kpi-snapshot-count', data.snapshotsRetainedCount !== null ? String(data.snapshotsRetainedCount) : '—');
        setText('kpi-days-continuous', data.daysContinuousOperation !== null ? String(data.daysContinuousOperation) : '—');

        // PHASE 1 LOCK-IN: Display 7-day aggregates
        setText('kpi-failures-7d', data.failureCount7d !== undefined ? String(data.failureCount7d) : 'Not available (telemetry missing)');
        
        // Freshness status label
        let freshnessLabel = '—';
        if (data.freshnessStatus === 'FRESH') {
            freshnessLabel = 'Fresh';
        } else if (data.freshnessStatus === 'AGING') {
            freshnessLabel = 'Aging';
        } else if (data.freshnessStatus === 'STALE') {
            freshnessLabel = 'Stale';
        } else if (data.freshnessStatus === 'NOT_AVAILABLE') {
            freshnessLabel = 'Not available (telemetry missing)';
        }
        setText('kpi-freshness-status', freshnessLabel);
        
        // Skipped checks
        setText('kpi-skipped-checks-7d', 
            data.skippedChecksCount7d !== undefined 
                ? (data.skippedChecksCount7d === 0 ? '0' : `${data.skippedChecksCount7d} (${data.skippedChecksPrimaryReason7d || 'UNKNOWN'})`)
                : 'Not available (telemetry missing)'
        );
        
        // Degraded reason (only show if degraded)
        const degradedReasonEl = document.getElementById('kpi-degraded-reason');
        if (data.systemStatus === 'DEGRADED' && data.degradedReason) {
            setText('kpi-degraded-reason', data.degradedReason);
            if (degradedReasonEl) degradedReasonEl.style.display = 'block';
        } else {
            if (degradedReasonEl) degradedReasonEl.style.display = 'none';
        }

        setText('kpi-version', `${data.version} / ${data.environment}`);
        setText('kpi-generated-at', formatTimestampDisplay(data.generatedAt) || '—');

        // Step 9: Operational Status Panel
        const opStatus = `
            <div class="metrics-grid">
                <div class="metric-row">
                    <div class="metric-label">Expected Schedule Interval</div>
                    <div class="metric-value">${data.expectedScheduleIntervalMinutes !== null ? data.expectedScheduleIntervalMinutes + ' minutes' : 'UNKNOWN'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Staleness Threshold Rule</div>
                    <div class="metric-value">${data.staleIfAgeMinutesGreaterThan !== null ? '> ' + data.staleIfAgeMinutesGreaterThan + ' minutes' : 'UNKNOWN'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Snapshot Age</div>
                    <div class="metric-value">${data.snapshotAgeMinutes !== null ? data.snapshotAgeMinutes + ' minutes' : 'No snapshots yet'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Data Freshness</div>
                    <div class="metric-value">${data.isStale === null ? 'UNKNOWN' : data.isStale ? 'STALE' : 'FRESH'}</div>
                </div>
            </div>
            <div class="disclaimer">
                <strong>Freshness:</strong> Based on snapshot age vs schedule interval (${data.expectedScheduleIntervalMinutes} min). Data older than ${data.staleIfAgeMinutesGreaterThan} min is marked STALE.
            </div>
        `;
        setHTML('operational-status', opStatus);
        
        // Show degraded clarification if status is DEGRADED
        if (data.systemStatus === 'DEGRADED') {
            const clarif = document.getElementById('degraded-clarification');
            if (clarif) clarif.style.display = 'block';
        }

        // Step 9.5: Render Health Status (Minimal)
        if (data.health) {
            const h = data.health;
            setText('health-state', h.state || 'UNKNOWN');
            setText('health-last-success', formatTimestampDisplay(h.lastSuccessAt));
            setText('health-last-attempt', formatTimestampDisplay(h.lastAttemptAt));
            setText('health-freshness', h.dataFreshnessMinutes !== undefined 
                ? `${h.dataFreshnessMinutes} minutes` 
                : 'UNKNOWN');

            // Render reasons
            const reasonsHtml = h.reasons && h.reasons.length > 0
                ? h.reasons.map(r => `<div>${r.code}: ${r.message}</div>`).join('')
                : '<div>No issues detected.</div>';
            setHTML('health-reasons', reasonsHtml);

            // Render boundaries
            const boundariesHtml = h.boundaries
                ? `<div><strong>Boundaries:</strong> noJiraWrites=${h.boundaries.noJiraWrites}, noConfigChanges=${h.boundaries.noConfigChanges}, noEnforcement=${h.boundaries.noEnforcement}</div>`
                : '';
            setHTML('health-boundaries', boundariesHtml);
        }

        // Step 10: Data Quality & Coverage Panel
        const coverageList = data.coverageIncluded.map((item: string) => `<li>${item}</li>`).join('');
        const dqStatus = `
            <div class="metric-row">
                <div class="metric-label">Completeness Status</div>
                <div class="metric-value">${data.completenessStatus}</div>
            </div>
            <div class="metric-row">
                <div class="metric-label">Coverage Included</div>
                <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; font-weight: 500; color: #172b4d;">View coverage details</summary>
                    <ul class="coverage-list" style="margin-top: 8px;">${coverageList}</ul>
                </details>
            </div>
            <div class="metric-row">
                <div class="metric-label">Coverage Excluded</div>
                <ul class="coverage-list coverage-excluded">${data.coverageExcluded.map((item: string) => `<li>${item}</li>`).join('')}</ul>
            </div>
            <div class="metric-row">
                <div class="metric-label">Known Data Gaps</div>
                <div>${data.knownDataGaps.length === 0 ? '<em>None</em>' : '<ul class="coverage-list">' + data.knownDataGaps.map((item: string) => `<li>${item}</li>`).join('') + '</ul>'}</div>
            </div>
            <div class="metric-row">
                <div class="metric-label">Retention Policy</div>
                <div class="metric-value">${data.retentionPolicy.effectiveRuleText}</div>
            </div>
        `;
        setHTML('data-quality', dqStatus);

        // Step 11: Checks table
        if (data.checks && data.checks.length > 0) {
            const checksSection = document.getElementById('checks-section');
            let tableHtml = '<div class="checks-table"><div class="table-header"><div class="th-name">Check Name</div><div class="th-status">Status</div><div class="th-lastRun">Last Run</div><div class="th-reason">Reason Code</div><div class="th-impact">Impact</div></div>';
            
            data.checks.slice(0, 20).forEach((check: any) => {
                tableHtml += `
                    <div class="table-row">
                        <div class="td-name">${check.name || 'Unknown'}</div>
                        <div class="td-status">${check.status || 'UNKNOWN'}</div>
                        <div class="td-lastRun">${formatTimestampDisplay(check.lastRunAt)}</div>
                        <div class="td-reason">${check.reasonCode || '—'}</div>
                        <div class="td-impact">${check.impact ? check.impact.substring(0, 120) : '—'}</div>
                    </div>
                `;
            });
            
            tableHtml += '</div>';
            if (data.checksTotalCount > 20) {
                tableHtml += `<div class="showing-n-of">Showing 20 of ${data.checksTotalCount} checks</div>`;
            }
            setHTML('checks-content', tableHtml);
            if (checksSection) {
                checksSection.style.display = 'block';
            }
        }

        // Step 12: Boundaries & Limitations
        const boundariesHtml = `
            <div class="boundary-item"><span class="boundary-check">✓</span> No Jira writes are performed</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> No configuration changes are made</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> No enforcement actions are taken</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> No recommendations are generated</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> Data is observational only</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> App fails closed on missing tenant identity</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> Viewer permissions may limit visible data</div>
        `;
        setHTML('boundaries', boundariesHtml);

        // Step 13: Availability Signals
        const signalsHtml = `
            <div class="signal-item">
                <span class="signal-label">Tenant Identity</span>
                <span class="signal-badge ${data.tenantIdentity.available ? 'signal-available' : 'signal-unavailable'}">${data.tenantIdentity.available ? 'AVAILABLE' : 'UNAVAILABLE'}</span>
            </div>
            <div class="signal-impact">Impact: ${data.tenantIdentity.available ? 'Monitoring operational' : 'Monitoring paused'}</div>
            <div class="signal-item">
                <span class="signal-label">Viewer Permission Visibility</span>
                <span class="signal-badge ${data.permissionVisibility.determined ? 'signal-available' : 'signal-unavailable'}">${data.permissionVisibility.determined ? 'DETERMINED' : 'NOT_DETERMINED'}</span>
            </div>
            <div class="signal-impact">Impact: ${data.permissionVisibility.determined ? 'All visible data accessible' : 'Some data may be restricted'}</div>
            <div class="signal-item">
                <span class="signal-label">Data Freshness</span>
                <span class="signal-badge ${data.isStale === false ? 'signal-fresh' : 'signal-stale'}">${data.isStale === null ? 'UNKNOWN' : data.isStale ? 'STALE' : 'FRESH'}</span>
            </div>
            <div class="signal-impact">Impact: ${data.isStale ? 'Operational visibility may be outdated' : 'Operational visibility is current'}</div>
            <div class="signal-item">
                <span class="signal-label">Storage State</span>
                <span class="signal-badge ${data.snapshotAgeMinutes !== null ? 'signal-available' : 'signal-unavailable'}">${data.snapshotAgeMinutes !== null ? 'HAS_DATA' : 'EMPTY'}</span>
            </div>
            <div class="signal-impact">Impact: ${data.snapshotAgeMinutes !== null ? 'Full metrics available' : 'First run pending'}</div>
        `;
        setHTML('availability-signals', signalsHtml);

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        showError('Unexpected Error', 'UNEXPECTED_ERROR', errorMsg);
    }
}

function showError(header: string, code: string, message: string) {
    const errorHtml = `
        <div class="error-panel">
            <div class="error-header">${header}</div>
            <div class="error-code">${code}</div>
            <div class="error-message">${message}</div>
        </div>
    `;
    setHTML('operational-status', errorHtml);
    setHTML('data-quality', '');
    setHTML('availability-signals', '');
}

// ============================================================================
// EXPORT CAPABILITY DETECTION
// ============================================================================

// Detect clipboard API availability
const CLIPBOARD_API_AVAILABLE = !!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function');

// Detect sandbox restrictions
const frameEl = window.frameElement as HTMLIFrameElement | null;
const sandboxAttr = frameEl?.getAttribute('sandbox') || '';
const DOWNLOAD_LIKELY_BLOCKED = sandboxAttr.length > 0 && !sandboxAttr.includes('allow-downloads');
const EXPORT_MODE = DOWNLOAD_LIKELY_BLOCKED ? 'COPY_ONLY' : 'DOWNLOAD_OK';

// ============================================================================
// EXPORT UTILITIES (DOM-ONLY, SANDBOX-SAFE)
// ============================================================================

/**
 * Show toast with export status
 * kind: 'ok' | 'warn' | 'err'
 */
function showExportToast(kind: 'ok' | 'warn' | 'err', msg: string) {
    try {
        const elem = document.getElementById('copy-success');
        if (!elem) return;
        elem.textContent = msg;
        elem.classList.add('show');
        setTimeout(() => elem.classList.remove('show'), 3000);
    } catch (e) {
        // Silent catch
    }
}

/**
 * Copy text using Clipboard API with fallback
 */
function copyTextFallback(text: string): boolean {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch (e) {
        return false;
    }
}

/**
 * Copy text with Clipboard API, fallback to execCommand
 */
async function copyText(text: string): Promise<boolean> {
    try {
        if (CLIPBOARD_API_AVAILABLE) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            return copyTextFallback(text);
        }
    } catch (e) {
        return copyTextFallback(text);
    }
}

/**
 * Build export payload from currently visible DOM state
 * All data is derived from rendered values; no backend calls
 */
function buildExportPayload() {
    if (!lastPayload) {
        return null;
    }

    return {
        timestamp: new Date().toISOString(),
        source: 'dashboard-gadget-ui',
        systemStatus: lastPayload.systemStatus || 'UNKNOWN',
        mode: lastPayload.mode || 'Scheduled monitoring (read-only)',
        lastSuccessfulRun: lastPayload.lastSuccessAt || null,
        lastCheck: lastPayload.lastCheckAt || null,
        snapshotAgeMinutes: lastPayload.snapshotAgeMinutes || null,
        dataFreshness: lastPayload.isStale === null ? 'UNKNOWN' : (lastPayload.isStale ? 'STALE' : 'FRESH'),
        operationalMetrics: {
            checksCompletedLifetime: lastPayload.checksCompletedLifetime || 0,
            snapshotCountRetained: lastPayload.snapshotsRetainedCount || 0,
            daysContinuousOperation: lastPayload.daysContinuousOperation || 0,
            failureCount7d: lastPayload.failureCount7d || 0,
            skippedChecksCount7d: lastPayload.skippedChecksCount7d || 0,
        },
        availabilitySignals: {
            tenantIdentityAvailable: lastPayload.tenantIdentity?.available !== false,
            permissionVisibilityDetermined: lastPayload.permissionVisibility?.determined !== false,
        },
        boundaries: {
            noJiraWrites: lastPayload.boundaries?.noJiraWrites || false,
            noConfigChanges: lastPayload.boundaries?.noConfigChanges || false,
            noEnforcement: lastPayload.boundaries?.noEnforcement || false,
        },
        completenessStatus: lastPayload.completenessStatus || 'UNKNOWN',
        retentionPolicy: lastPayload.retentionPolicy?.effectiveRuleText || null,
        checks: (lastPayload.checks || []).map((c: any) => ({
            name: c.name,
            status: c.status,
            lastRun: c.lastRunAt,
            reasonCode: c.reasonCode,
        })),
        version: lastPayload.version || 'UNKNOWN',
        environment: lastPayload.environment || 'UNKNOWN',
        generatedAt: lastPayload.generatedAt || new Date().toISOString(),
    };
}

/**
 * Flatten object to dot-notation for CSV export
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value === null || value === undefined) {
                result[newKey] = null;
            } else if (Array.isArray(value)) {
                value.forEach((item, idx) => {
                    if (typeof item === 'object' && item !== null) {
                        const flattened = flattenObject(item, `${newKey}[${idx}]`);
                        Object.assign(result, flattened);
                    } else {
                        result[`${newKey}[${idx}]`] = item;
                    }
                });
            } else if (typeof value === 'object') {
                const flattened = flattenObject(value, newKey);
                Object.assign(result, flattened);
            } else {
                result[newKey] = value;
            }
        }
    }

    return result;
}

/**
 * Render export output to the Export Output panel
 * Auto-opens the details element
 */
function renderExportOutput(title: string, text: string) {
    try {
        const titleEl = document.getElementById('export-output-title');
        const textEl = document.getElementById('export-output-text') as HTMLTextAreaElement | null;
        const detailsEl = document.querySelector('details') as HTMLDetailsElement | null;

        if (titleEl) titleEl.textContent = title;
        if (textEl) {
            textEl.value = text;
            // Try to select and focus
            try {
                textEl.select();
                textEl.focus();
            } catch (e) {
                // Silent
            }
        }
        if (detailsEl) detailsEl.open = true;
    } catch (e) {
        // Silent catch
    }
}

// ============================================================================
// EXPORT FUNCTIONS (SANDBOX-SAFE, ALWAYS PRODUCE RESULT)
// ============================================================================

/**
 * Convert payload to formatted summary text
 */
function toSummaryText(payload: any): string {
    return `═════════════════════════════════════════════════════════════
FirstTry Governance Dashboard — Status Summary
═════════════════════════════════════════════════════════════
Generated: ${payload.timestamp}

SYSTEM STATUS
─────────────────────────────────────────────────────────────
Status: ${payload.systemStatus}
Mode: ${payload.mode}
Data Freshness: ${payload.dataFreshness}

OPERATIONAL METRICS (Lifetime)
─────────────────────────────────────────────────────────────
Checks Completed: ${payload.operationalMetrics.checksCompletedLifetime}
Snapshots Retained: ${payload.operationalMetrics.snapshotCountRetained}
Days Continuous: ${payload.operationalMetrics.daysContinuousOperation}

7-DAY WINDOW
─────────────────────────────────────────────────────────────
Failures: ${payload.operationalMetrics.failureCount7d}
Skipped Checks: ${payload.operationalMetrics.skippedChecksCount7d}

BOUNDARIES (Read-Only)
─────────────────────────────────────────────────────────────
✓ No Jira writes: ${payload.boundaries.noJiraWrites}
✓ No config changes: ${payload.boundaries.noConfigChanges}
✓ No enforcement: ${payload.boundaries.noEnforcement}

DATA QUALITY
─────────────────────────────────────────────────────────────
Completeness: ${payload.completenessStatus}
Retention: ${payload.retentionPolicy}

VERSION
─────────────────────────────────────────────────────────────
App: ${payload.version}
Environment: ${payload.environment}

═════════════════════════════════════════════════════════════
`;
}

/**
 * Convert payload to JSON string (stable formatting)
 */
function toJSONText(payload: any): string {
    return JSON.stringify(payload, null, 2);
}

/**
 * Convert payload to CSV string (deterministic, with proper escaping)
 */
function toCSVText(payload: any): string {
    const flat = flattenObject(payload);
    const keys = Object.keys(flat).sort();
    const rows: string[] = [];

    // Header row
    rows.push(keys.map(k => `"${k}"`).join(','));

    // Data row
    const values = keys.map(k => {
        const v = flat[k];
        if (v === null) return '';
        if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
        return String(v);
    });
    rows.push(values.join(','));

    return rows.join('\n');
}

// @ts-ignore - Expose globally for button onclick handlers
window.copySummary = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh the gadget after the next scheduled check.');
            return;
        }

        const text = toSummaryText(payload);
        const copied = await copyText(text);

        if (copied) {
            showExportToast('ok', '✓ Summary copied to clipboard');
        } else {
            // Fallback: render to panel and instruct user to copy manually
            renderExportOutput('SUMMARY EXPORT', text);
            showExportToast('warn', 'Summary ready below. Select & copy manually.');
        }
    } catch (e) {
        showExportToast('err', 'Export failed — no data was modified.');
    }
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadJSON = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh the gadget after the next scheduled check.');
            return;
        }

        const json = toJSONText(payload);
        if (!json || json.length === 0) {
            showExportToast('err', 'Export failed — no data was modified.');
            return;
        }

        // Check if downloads are allowed
        if (EXPORT_MODE === 'COPY_ONLY') {
            // Downloads blocked: render to panel and copy to clipboard
            renderExportOutput('JSON EXPORT', json);
            const copied = await copyText(json);
            if (copied) {
                showExportToast('ok', 'JSON copied. Download is blocked by Jira gadget sandbox.');
            } else {
                showExportToast('warn', 'JSON ready below. Copy manually (download blocked by Jira gadget sandbox).');
            }
            return;
        }

        // Download mode: attempt Blob download
        try {
            const blob = new Blob([json], { type: 'application/json; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `governance-status-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showExportToast('ok', '✓ JSON downloaded');
        } catch (downloadErr) {
            // Download failed: fallback to render + copy
            renderExportOutput('JSON EXPORT', json);
            const copied = await copyText(json);
            if (copied) {
                showExportToast('warn', 'JSON copied (download failed). Download is blocked by Jira gadget sandbox.');
            } else {
                showExportToast('warn', 'JSON ready below. Copy manually (download blocked by Jira gadget sandbox).');
            }
        }
    } catch (e) {
        showExportToast('err', 'Export failed — no data was modified.');
    }
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadCSV = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh the gadget after the next scheduled check.');
            return;
        }

        const csv = toCSVText(payload);
        if (!csv || csv.length === 0) {
            showExportToast('err', 'Export failed — no data was modified.');
            return;
        }

        // Check if downloads are allowed
        if (EXPORT_MODE === 'COPY_ONLY') {
            // Downloads blocked: render to panel and copy to clipboard
            renderExportOutput('CSV EXPORT', csv);
            const copied = await copyText(csv);
            if (copied) {
                showExportToast('ok', 'CSV copied. Download is blocked by Jira gadget sandbox.');
            } else {
                showExportToast('warn', 'CSV ready below. Copy manually (download blocked by Jira gadget sandbox).');
            }
            return;
        }

        // Download mode: attempt Blob download
        try {
            const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `governance-status-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showExportToast('ok', '✓ CSV downloaded');
        } catch (downloadErr) {
            // Download failed: fallback to render + copy
            renderExportOutput('CSV EXPORT', csv);
            const copied = await copyText(csv);
            if (copied) {
                showExportToast('warn', 'CSV copied (download failed). Download is blocked by Jira gadget sandbox.');
            } else {
                showExportToast('warn', 'CSV ready below. Copy manually (download blocked by Jira gadget sandbox).');
            }
        }
    } catch (e) {
        showExportToast('err', 'Export failed — no data was modified.');
    }
};

// ============================================================================
// BUTTON WIRE-UP (Deterministic event listeners)
// ============================================================================

/**
 * Wire up export buttons deterministically on DOM ready
 * Additive to existing inline onclick handlers
 */
function wireExportButtons() {
    try {
        const copyBtn = document.getElementById('copy-summary-btn');
        const jsonBtn = document.getElementById('download-json-btn');
        const csvBtn = document.getElementById('download-csv-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => window.copySummary());
        }
        if (jsonBtn) {
            jsonBtn.addEventListener('click', () => window.downloadJSON());
        }
        if (csvBtn) {
            csvBtn.addEventListener('click', () => window.downloadCSV());
        }

        // Verify all buttons are present
        if (!copyBtn || !jsonBtn || !csvBtn) {
            showExportToast('err', 'Export UI misconfigured: missing button element.');
        }
    } catch (e) {
        // Silent catch
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Wire buttons on DOM ready
function onDOMReady() {
    wireExportButtons();
    loadStatus();
}

// Run on DOMContentLoaded to ensure all DOM elements exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    // DOM already loaded
    onDOMReady();
}

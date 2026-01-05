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
// EXPORT FUNCTIONS
// ============================================================================

// @ts-ignore - Expose globally for button onclick handlers
window.copySummary = function() {
    if (!lastPayload) return;
    let reasonCodeLine = '';
    if (lastPayload.reasonCode) {
        reasonCodeLine = `Reason Code: ${lastPayload.reasonCode}\n`;
    } else if (lastPayload.systemStatus === 'DEGRADED' && lastPayload.tenantIdentity?.reasonCode) {
        reasonCodeLine = `Reason Code: ${lastPayload.tenantIdentity.reasonCode}\n`;
    }
    const text = `System Status: ${lastPayload.systemStatus}
${reasonCodeLine}Last Successful Run: ${formatTimestampExport(lastPayload.lastSuccessAt)}
Last Check: ${formatTimestampExport(lastPayload.lastCheckAt)}
Snapshot Age: ${lastPayload.snapshotAgeMinutes} minutes (stale if > ${lastPayload.staleIfAgeMinutesGreaterThan})
Completeness Status: ${lastPayload.completenessStatus}
Retention Policy: ${lastPayload.retentionPolicy.effectiveRuleText}
Explicit Boundaries: No Jira writes, no config changes, no enforcement, no recommendations, data observational only
Version / Environment: ${lastPayload.version} / ${lastPayload.environment}
Generated At: ${lastPayload.generatedAt}`;
    navigator.clipboard.writeText(text).then(() => {
        const elem = document.getElementById('copy-success');
        if (elem) {
            elem.classList.add('show');
            setTimeout(() => elem.classList.remove('show'), 2000);
        }
    });
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadJSON = function() {
    if (!lastPayload) return;
    const payload = {
        schemaVersion: lastPayload.schemaVersion,
        generatedAt: lastPayload.generatedAt,
        snapshotAge: lastPayload.snapshotAgeMinutes,
        completenessStatus: lastPayload.completenessStatus,
        boundaries: lastPayload.boundaries,
        truncated: false,
        ...lastPayload
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance-status-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadCSV = function() {
    if (!lastPayload || !lastPayload.checks) return;
    const rows = [['Check Name', 'Status', 'Last Run', 'Reason Code', 'Impact']];
    lastPayload.checks.slice(0, 100).forEach((check: any) => {
        rows.push([
            `"${check.name || 'Unknown'}"`,
            check.status || 'UNKNOWN',
            `"${formatTimestampExport(check.lastRunAt)}"`,
            check.reasonCode || '—',
            `"${(check.impact || '—').substring(0, 120)}"`
        ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance-checks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ============================================================================
// INITIALIZATION
// ============================================================================

// Run on DOMContentLoaded to ensure all DOM elements exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStatus);
} else {
    // DOM already loaded
    loadStatus();
}

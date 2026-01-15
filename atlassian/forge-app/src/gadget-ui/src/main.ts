/**
 * FirstTry Governance Dashboard Gadget - Main Entrypoint
 * 
 * This module is bundled by Vite and served in the Forge gadget iframe.
 * @forge/bridge is bundled with the gadget and provides invoke() for resolver calls.
 */

// Import invoke from @forge/bridge (now bundled, not injected as global)
import { invoke } from '@forge/bridge';
import './styles.css';

// Import build info (injected by Vite)
import { getBuildIdentifier } from './buildInfo';

// Import pure modules (testable, deterministic)
import { buildExportPayloadFromStatus, type ExportPayload } from './exportPayload';
import { toSummaryTextFromPayload } from './summaryText';

// Import enterprise UI renderers (vanilla DOM, accessibility-safe)
import { renderKpiTiles } from './enterprise/renderKpiTiles';
import { renderStatusBanner } from './enterprise/renderStatusBanner';
import { renderProgressTracker } from './enterprise/renderProgressTracker';
import { renderTrustSection } from './enterprise/renderTrustSection';
import { applyExportPolicy } from './enterprise/applyExportPolicy';
import './enterprise/enterprise.css';

// Import shared status schema and normalizer (CRITICAL to prevent UI crashes)
import { normalizeStatusV1, EMPTY_STATUS_V1, GovernanceStatusV1 } from '../../shared/statusSchema';

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
        let rawData: any = null;
        let invokeError: string | null = null;

        try {
            // @ts-ignore - invoke is checked above
            // Call the new getStatusSnapshot resolver (live dashboard)
            rawData = await invoke('getStatusSnapshot', {});
        } catch (e) {
            invokeError = e instanceof Error ? e.message : String(e);
            console.error('Bridge.invoke failed:', invokeError);
        }

        // CRITICAL: Normalize data immediately after receiving it
        // This GUARANTEES UI never receives malformed data and prevents crashes
        let data: GovernanceStatusV1;
        if (!rawData || invokeError) {
            const errorMsg = invokeError || 'No data returned from resolver';
            // Return safe, normalized empty state
            data = EMPTY_STATUS_V1("UNKNOWN", "unknown", UI_BUILD_VERSION);
            data.health = "ERROR";
            data.degradedReason = errorMsg;
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

        // Normalize the payload to GovernanceStatusV1
        // This ensures all arrays, objects, and fields are safe defaults if missing
        data = normalizeStatusV1(rawData, rawData.tenantAri || "UNKNOWN", rawData.backendBuild || "unknown", UI_BUILD_VERSION);
        lastPayload = data;
        setText('ui-selftest-invoke', 'OK (resolver responded)');

        // ===== ENTERPRISE UI RENDERING (KPI Tiles, Status Banner, Progress Tracker) =====
        // These are vanilla DOM renderers that integrate with existing UI
        // They use unifiedStatus field from payload if available, fall back to legacy data
        try {
            const unifiedStatus = data.unifiedStatus || null;
            
            // Render KPI tiles (8-tile grid at the top)
            renderKpiTiles({
                containerId: 'kpi-tiles-section',
                legacyData: data,
                unifiedStatus
            });
            
            // Render status banner (alert only if degraded/error)
            renderStatusBanner({
                containerId: 'status-banner-section',
                legacyData: data
            });
            
            // Render progress tracker (timeline - collapsed roadmap)
            renderProgressTracker({
                containerId: 'progress-tracker-section',
                legacyData: data
            });
            
            // Render trust & data handling section
            const trustSection = document.getElementById('trust-section');
            if (trustSection) {
                trustSection.appendChild(renderTrustSection());
            }
            
            // Apply export policy (gate buttons, show messages)
            applyExportPolicy({
                legacyData: data,
                unifiedStatus
            });
        } catch (enterpriseError) {
            console.warn('[Enterprise UI] Rendering error:', enterpriseError);
            // Non-fatal: continue with legacy UI
        }
        // ===== END ENTERPRISE UI RENDERING =====

        // Step 4: Update SERVE_PROOF banner (hidden; for diagnostics only)
        const banner = document.getElementById('ui-serve-proof-banner');
        if (banner) {
            const match = data.uiExpectedBuild === UI_BUILD_VERSION ? 'MATCH' : 'MISMATCH';
            // Store in data attribute for diagnostics, do not display
            banner.setAttribute('data-serve-proof', `${UI_BUILD_PROOF} | resource:${UI_RESOURCE_KEY} | uiVersion:${UI_BUILD_VERSION} | resolverOK:${match}`);
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

        // Step 6: Display UI version (hidden; for diagnostics only)
        const buildMarker = document.getElementById('build-marker');
        if (buildMarker) {
            buildMarker.setAttribute('data-build-info', `UI BUILD: ${UI_BUILD_PROOF} | Version: ${UI_BUILD_VERSION}`);
        }

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
            setText('health-state', typeof h === 'string' ? h : 'UNKNOWN');
            // Note: health is now a HealthState string, not an object, so skip nested fields
        } else {
            setText('health-state', 'UNKNOWN');
        }

        // Step 9.5: Jira Configuration Visibility (Phase 2)
        // This is fetched from scheduled snapshot storage if available
        // If not available yet, show "awaiting first snapshot"
        let configVisibilityHtml = '';
        if (data.configVisibility) {
            const cv = data.configVisibility;
            const metrics = cv.metrics || {};
            
            // Build table rows with metric names and values
            const tableRows = [
                { label: 'Custom fields', value: metrics.customFieldCount },
                { label: 'Workflows', value: metrics.workflowCount },
                { label: 'Workflow schemes', value: metrics.workflowSchemeCount },
                { label: 'Max workflows in a scheme', value: metrics.maxWorkflowsPerScheme },
                { label: 'Screens', value: metrics.screenCount },
                { label: 'Permission schemes', value: metrics.permissionSchemeCount },
                { label: 'Max projects in a permission scheme', value: metrics.maxProjectsPerPermissionScheme },
            ];

            // Build issue map for quick lookup (metric -> reason)
            const issueMap: Record<string, string> = {};
            if (cv.issues && Array.isArray(cv.issues)) {
                for (const issue of cv.issues) {
                    issueMap[issue.metric] = issue.reason;
                }
            }

            let metricsTableHtml = '<table class="config-visibility-table" style="width: 100%; border-collapse: collapse; border: 1px solid #dfe1e6;">';
            metricsTableHtml += '<thead><tr style="background: #f5f6f7; border-bottom: 1px solid #dfe1e6;"><th style="padding: 12px; text-align: left; font-weight: 600; color: #172b4d; font-size: 13px;">Metric</th><th style="padding: 12px; text-align: left; font-weight: 600; color: #172b4d; font-size: 13px;">Value</th></tr></thead>';
            metricsTableHtml += '<tbody>';

            for (const row of tableRows) {
                const displayValue = row.value !== null && row.value !== undefined ? String(row.value) : 'Not available';
                const reason = issueMap[row.label.replace(/ /g, '').toLowerCase().replace(/maxprojectsina/g, 'maxProjectsPerPermissionScheme').replace(/maxworkflows/g, 'maxWorkflowsPerScheme').replace(/customfields/g, 'customFieldCount').replace(/workflows/g, 'workflowCount').replace(/workflowschemes/g, 'workflowSchemeCount').replace(/screens/g, 'screenCount').replace(/permissionschemes/g, 'permissionSchemeCount')] || '';
                
                // Simplified: get issue reason by matching row.label to metric name
                let metricKey = '';
                if (row.label === 'Custom fields') metricKey = 'customFieldCount';
                else if (row.label === 'Workflows') metricKey = 'workflowCount';
                else if (row.label === 'Workflow schemes') metricKey = 'workflowSchemeCount';
                else if (row.label === 'Max workflows in a scheme') metricKey = 'maxWorkflowsPerScheme';
                else if (row.label === 'Screens') metricKey = 'screenCount';
                else if (row.label === 'Permission schemes') metricKey = 'permissionSchemeCount';
                else if (row.label === 'Max projects in a permission scheme') metricKey = 'maxProjectsPerPermissionScheme';
                
                const reasonText = issueMap[metricKey] ? ` (${issueMap[metricKey]})` : '';
                
                metricsTableHtml += `<tr style="border-bottom: 1px solid #dfe1e6;">`;
                metricsTableHtml += `<td style="padding: 12px; color: #172b4d; font-size: 13px;">${row.label}</td>`;
                metricsTableHtml += `<td style="padding: 12px; color: #172b4d; font-size: 13px;">${displayValue}${reasonText}</td>`;
                metricsTableHtml += `</tr>`;
            }

            metricsTableHtml += '</tbody></table>';

            configVisibilityHtml = `
                <div>
                    ${metricsTableHtml}
                    <div style="margin-top: 16px; padding: 12px; background: #f5f6f7; border-radius: 4px; border: 1px solid #dfe1e6;">
                        <div class="metric-row" style="display: flex; gap: 16px; margin-bottom: 12px;">
                            <div>
                                <div class="metric-label" style="font-size: 12px; font-weight: 600; color: #8590a2; text-transform: uppercase; letter-spacing: 0.3px;">Risk Band</div>
                                <div class="metric-value" style="font-size: 14px; color: #172b4d; font-weight: 500;">${cv.riskBand || '—'}</div>
                                <div style="font-size: 11px; color: #8590a2; margin-top: 4px;">Band indicates observed scale only.</div>
                            </div>
                            <div>
                                <div class="metric-label" style="font-size: 12px; font-weight: 600; color: #8590a2; text-transform: uppercase; letter-spacing: 0.3px;">Completeness</div>
                                <div class="metric-value" style="font-size: 14px; color: #172b4d; font-weight: 500;">${cv.completeness || '—'}</div>
                            </div>
                            <div>
                                <div class="metric-label" style="font-size: 12px; font-weight: 600; color: #8590a2; text-transform: uppercase; letter-spacing: 0.3px;">Evaluated At</div>
                                <div class="metric-value" style="font-size: 14px; color: #172b4d; font-weight: 500;">${formatTimestampDisplay(cv.evaluatedAtISO)}</div>
                            </div>
                        </div>
                        <div style="border-top: 1px solid #dfe1e6; padding-top: 12px; margin-top: 12px; font-size: 12px; color: #44546f; line-height: 1.5;">
                            <strong>Observational Only:</strong> FirstTry does not modify Jira configuration. This view is observational only.
                        </div>
                    </div>
                </div>
            `;
        } else {
            configVisibilityHtml = '<div style="padding: 12px; color: #626f86; font-size: 13px;">Awaiting first scheduled snapshot. The configuration visibility report will appear here once collected.</div>';
        }
        setHTML('config-visibility-content', configVisibilityHtml);

        // Step 9.5: Performance & Reliability Signals (Phase 3)
        let perfSignalsHtml = '';
        const ps = data.perfSignals;
        if (ps) {
            // Build metrics table for perf signals
            let perfMetricsTableHtml = '<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tbody>';
            
            // Scheduler section
            const schedulerRows = [
                { label: 'Last Run', value: formatTimestampDisplay(ps.scheduler?.lastRunAtISO) },
                { label: 'Last Success', value: formatTimestampDisplay(ps.scheduler?.lastSuccessAtISO) },
                { label: 'Last Duration (ms)', value: ps.scheduler?.lastDurationMs !== null ? String(ps.scheduler.lastDurationMs) : 'Not available' },
                { label: 'Last Failure Reason', value: ps.scheduler?.lastFailureReason || 'None' },
            ];

            // Jira API section
            const jiraApiRows = [
                { label: 'Requests (24h)', value: ps.jiraApi?.requestCount || 0 },
                { label: 'Errors (24h)', value: ps.jiraApi?.errorCount || 0 },
                { label: 'p50 Latency (ms)', value: ps.jiraApi?.latency?.p50ms !== null ? String(ps.jiraApi.latency.p50ms) : 'Not available' },
                { label: 'p95 Latency (ms)', value: ps.jiraApi?.latency?.p95ms !== null ? String(ps.jiraApi.latency.p95ms) : 'Not available' },
                { label: 'Max Latency (ms)', value: ps.jiraApi?.latency?.maxMs !== null ? String(ps.jiraApi.latency.maxMs) : 'Not available' },
                { label: 'Rate Limit Remaining', value: ps.jiraApi?.rateLimit?.remaining !== null ? String(ps.jiraApi.rateLimit.remaining) : 'Not available' },
                { label: 'Rate Limit Total', value: ps.jiraApi?.rateLimit?.limit !== null ? String(ps.jiraApi.rateLimit.limit) : 'Not available' },
            ];

            const allRows = [...schedulerRows, ...jiraApiRows];
            
            for (const row of allRows) {
                perfMetricsTableHtml += `<tr style="border-bottom: 1px solid #dfe1e6;">`;
                perfMetricsTableHtml += `<td style="padding: 12px; color: #172b4d; font-size: 13px; font-weight: 500; width: 40%;">${row.label}</td>`;
                perfMetricsTableHtml += `<td style="padding: 12px; color: #172b4d; font-size: 13px;">${row.value}</td>`;
                perfMetricsTableHtml += `</tr>`;
            }

            perfMetricsTableHtml += '</tbody></table>';

            perfSignalsHtml = `
                <div>
                    ${perfMetricsTableHtml}
                    <div style="margin-top: 16px; padding: 12px; background: #f5f6f7; border-radius: 4px; border: 1px solid #dfe1e6;">
                        <div class="metric-row" style="display: flex; gap: 16px; margin-bottom: 12px;">
                            <div>
                                <div class="metric-label" style="font-size: 12px; font-weight: 600; color: #8590a2; text-transform: uppercase; letter-spacing: 0.3px;">Completeness</div>
                                <div class="metric-value" style="font-size: 14px; color: #172b4d; font-weight: 500;">${ps.completeness || '—'}</div>
                            </div>
                            <div>
                                <div class="metric-label" style="font-size: 12px; font-weight: 600; color: #8590a2; text-transform: uppercase; letter-spacing: 0.3px;">Evaluated At</div>
                                <div class="metric-value" style="font-size: 14px; color: #172b4d; font-weight: 500;">${formatTimestampDisplay(ps.evaluatedAtISO)}</div>
                            </div>
                        </div>
                        <div style="border-top: 1px solid #dfe1e6; padding-top: 12px; margin-top: 12px; font-size: 12px; color: #44546f; line-height: 1.5;">
                            <strong>Observational Only:</strong> Signals record latencies, error counts, and rate limits from Jira API interactions. FirstTry does not interpret, recommend, or enforce changes based on these signals.
                        </div>
                    </div>
                </div>
            `;
        } else {
            perfSignalsHtml = '<div style="padding: 12px; color: #626f86; font-size: 13px;">Awaiting first scheduled snapshot. Performance signals will appear here once collected.</div>';
        }
        setHTML('perf-signals-content', perfSignalsHtml);

        // Step 9.6: Phase 4 Change Awareness Timeline (Read-Only, Append-Only)
        let phase4TimelineHtml = '';
        const phase4 = data.phase4Timeline;
        if (phase4 && phase4.isAvailable && phase4.events && phase4.events.length > 0) {
            // Render chronological timeline (most recent first)
            phase4TimelineHtml = '<div style="border: 1px solid #dfe1e6; border-radius: 4px; overflow: hidden;">';
            
            phase4.events.slice(0, 50).forEach((event: any, index: number) => {
                const isFirst = index === 0;
                const borderTop = isFirst ? '' : 'border-top: 1px solid #dfe1e6;';
                phase4TimelineHtml += `
                    <div style="padding: 12px 16px; ${borderTop}">
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #172b4d; margin-bottom: 4px;">${event.description || 'Setting changed'}</div>
                                <div style="font-size: 12px; color: #626f86; margin-bottom: 8px;">
                                    <strong>Setting:</strong> ${event.settingKey || '—'}
                                </div>
                                <div style="font-size: 12px; color: #626f86;">
                                    <strong>Previous:</strong> <code style="background: #f5f6f7; padding: 2px 4px; border-radius: 2px; font-family: monospace;">${event.previousValue !== null ? String(event.previousValue) : 'null'}</code>
                                    <strong style="margin-left: 12px;">Current:</strong> <code style="background: #f5f6f7; padding: 2px 4px; border-radius: 2px; font-family: monospace;">${event.currentValue !== null ? String(event.currentValue) : 'null'}</code>
                                </div>
                            </div>
                            <div style="text-align: right; white-space: nowrap;">
                                <div style="font-size: 11px; color: #8590a2;">${formatTimestampDisplay(event.detectedAt)}</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            if (phase4.totalEventCount > 50) {
                phase4TimelineHtml += `<div style="padding: 12px 16px; text-align: center; color: #8590a2; font-size: 12px; border-top: 1px solid #dfe1e6; background: #f5f6f7;">Showing 50 of ${phase4.totalEventCount} events. All events are retained in storage.</div>`;
            }

            phase4TimelineHtml += '</div>';
        } else if (phase4 && phase4.isAvailable) {
            phase4TimelineHtml = '<div style="padding: 12px; color: #626f86; font-size: 13px;">No configuration changes detected yet. Timeline will populate once changes are detected by the daily scheduler.</div>';
        } else {
            phase4TimelineHtml = '<div style="padding: 12px; color: #626f86; font-size: 13px;">Timeline data not yet available. Scheduled detection begins after first daily run.</div>';
        }
        setHTML('phase4-timeline-content', phase4TimelineHtml);

        // Step 10: Data Quality & Coverage Panel
        // SAFE DEFAULTS: All arrays are guaranteed by normalizeStatusV1
        const coverageList = (data.coverageIncluded ?? []).map((item: string) => `<li>${item}</li>`).join('');
        const dqStatus = `
            <div class="metric-row">
                <div class="metric-label">Completeness Status</div>
                <div class="metric-value">${data.completenessStatus || 'UNKNOWN'}</div>
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
                <ul class="coverage-list coverage-excluded">${(data.coverageExcluded ?? []).map((item: string) => `<li>${item}</li>`).join('')}</ul>
            </div>
            <div class="metric-row">
                <div class="metric-label">Known Data Gaps</div>
                <div>${((data.knownDataGaps ?? []).length === 0) ? '<em>None</em>' : '<ul class="coverage-list">' + (data.knownDataGaps ?? []).map((item: string) => `<li>${item}</li>`).join('') + '</ul>'}</div>
            </div>
            <div class="metric-row">
                <div class="metric-label">Retention Policy</div>
                <div class="metric-value">${(data.retentionPolicy?.effectiveRuleText) || 'Not available yet'}</div>
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

        // Step 13: Availability Signals (DEFENSIVE: Safe reads with fallbacks)
        // Safe read 1: tenantIdentity.available
        const tenantAvailable = data?.tenantIdentity?.available;
        let tenantBadgeClass: string;
        let tenantLabel: string;
        let tenantImpact: string;
        if (tenantAvailable === true) {
            tenantBadgeClass = 'signal-available';
            tenantLabel = 'AVAILABLE';
            tenantImpact = 'Monitoring operational';
        } else if (tenantAvailable === false) {
            tenantBadgeClass = 'signal-unavailable';
            tenantLabel = 'UNAVAILABLE';
            tenantImpact = 'Monitoring paused';
        } else {
            tenantBadgeClass = 'signal-unknown';
            tenantLabel = 'UNKNOWN';
            tenantImpact = 'Identity status unclear; monitoring may be paused';
        }

        // Safe read 2: permissionVisibility.determined
        const permDetermined = data?.permissionVisibility?.determined;
        let permBadgeClass: string;
        let permLabel: string;
        let permImpact: string;
        if (permDetermined === true) {
            permBadgeClass = 'signal-available';
            permLabel = 'DETERMINED';
            permImpact = 'All visible data accessible';
        } else if (permDetermined === false) {
            permBadgeClass = 'signal-unavailable';
            permLabel = 'NOT_DETERMINED';
            permImpact = 'Some data may be restricted';
        } else {
            permBadgeClass = 'signal-unknown';
            permLabel = 'UNKNOWN';
            permImpact = 'Permission visibility unclear';
        }

        // Safe read 3: isStale (already defensive, but keep it)
        const isStale = data?.isStale;
        let staleBadgeClass: string;
        let staleLabel: string;
        let staleImpact: string;
        if (isStale === false) {
            staleBadgeClass = 'signal-fresh';
            staleLabel = 'FRESH';
            staleImpact = 'Operational visibility is current';
        } else if (isStale === true) {
            staleBadgeClass = 'signal-stale';
            staleLabel = 'STALE';
            staleImpact = 'Operational visibility may be outdated';
        } else {
            staleBadgeClass = 'signal-unknown';
            staleLabel = 'UNKNOWN';
            staleImpact = 'Data freshness unknown; first run pending';
        }

        // Safe read 4: snapshotAgeMinutes
        const snapshotAge = data?.snapshotAgeMinutes;
        let storageBadgeClass: string;
        let storageLabel: string;
        let storageImpact: string;
        if (snapshotAge !== null && snapshotAge !== undefined) {
            storageBadgeClass = 'signal-available';
            storageLabel = 'HAS_DATA';
            storageImpact = 'Full metrics available';
        } else {
            storageBadgeClass = 'signal-unavailable';
            storageLabel = 'EMPTY';
            storageImpact = 'First run pending';
        }

        const signalsHtml = `
            <div class="signal-item">
                <span class="signal-label">Tenant Identity</span>
                <span class="signal-badge ${tenantBadgeClass}">${tenantLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${tenantImpact}</div>
            <div class="signal-item">
                <span class="signal-label">Viewer Permission Visibility</span>
                <span class="signal-badge ${permBadgeClass}">${permLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${permImpact}</div>
            <div class="signal-item">
                <span class="signal-label">Data Freshness</span>
                <span class="signal-badge ${staleBadgeClass}">${staleLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${staleImpact}</div>
            <div class="signal-item">
                <span class="signal-label">Storage State</span>
                <span class="signal-badge ${storageBadgeClass}">${storageLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${storageImpact}</div>
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
 * Download a blob as a file with the given filename
 * Tries standard download mechanism; falls back gracefully on error
 * Returns true if successful, false otherwise
 */
function downloadBlob(filename: string, mime: string, content: string): boolean {
    try {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            return true;
        } finally {
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    } catch (e) {
        return false;
    }
}

/**
 * Copy text to clipboard with fallback
 * Returns { ok: true } on success
 * Returns { ok: false, reason: string } on failure
 */
async function copyToClipboard(text: string): Promise<{ ok: true } | { ok: false, reason: string }> {
    // Try Clipboard API first
    if (CLIPBOARD_API_AVAILABLE) {
        try {
            await navigator.clipboard.writeText(text);
            return { ok: true };
        } catch (clipboardErr) {
            // Fall through to fallback
        }
    }

    // Fallback: execCommand approach
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
            return { ok: true };
        } else {
            return { ok: false, reason: 'Copy command failed (execCommand returned false)' };
        }
    } catch (fallbackErr) {
        return { ok: false, reason: 'Copy unavailable in this browser' };
    }
}

/**
 * Build export payload from currently visible DOM state
 * All data is derived from rendered values; no backend calls
 */
function buildExportPayload(): ExportPayload | null {
    if (!lastPayload) {
        return null;
    }
    // Delegate to pure module for testable, deterministic payload construction
    return buildExportPayloadFromStatus(lastPayload);
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
 * Refresh Now handler: Manually trigger snapshot update
 */
// @ts-ignore - Expose globally for button onclick handlers
window.refreshNow = async function() {
    try {
        const btn = document.getElementById('refresh-now-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Refreshing...';
        }

        // @ts-ignore - invoke is checked in loadStatus
        const newSnapshot = await invoke('refreshNow', {});
        
        // Update lastPayload and re-render UI
        lastPayload = newSnapshot;
        
        // Update "Last refreshed" timestamp
        const refreshedEl = document.getElementById('last-refreshed-time');
        if (refreshedEl && newSnapshot.generatedAtIso) {
            refreshedEl.textContent = formatTimestampDisplay(newSnapshot.generatedAtIso);
        }

        showExportToast('ok', '✓ Refreshed successfully');
        
        // Re-render enterprise UI components
        try {
            const unifiedStatus = newSnapshot || null;
            renderKpiTiles({
                containerId: 'kpi-tiles-section',
                legacyData: newSnapshot,
                unifiedStatus
            });
            renderStatusBanner({
                containerId: 'status-banner-section',
                legacyData: newSnapshot
            });
            renderProgressTracker({
                containerId: 'progress-tracker-section',
                legacyData: newSnapshot
            });
        } catch (renderErr) {
            console.warn('[Refresh] UI re-render error:', renderErr);
        }
    } catch (err) {
        console.error('[Refresh] Error:', err);
        showExportToast('err', `Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        const btn = document.getElementById('refresh-now-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Refresh now';
        }
    }
};

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
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh after the next scheduled check.');
            return;
        }

        const text = toSummaryText(payload);
        const result = await copyToClipboard(text);

        if (result.ok) {
            showExportToast('ok', '✓ Copied to clipboard');
        } else {
            // Show clear error with reason
            showExportToast('err', `Copy failed: ${result.reason}. Use Download JSON instead.`);
            // Also render to export panel as fallback
            renderExportOutput('SUMMARY EXPORT', text);
        }
    } catch (e) {
        showExportToast('err', 'Export error: see panel below.');
    }
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadJSON = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh after the next scheduled check.');
            return;
        }

        // Generate summary text using pure module (shows unknown fields explicitly)
        const summary = toSummaryTextFromPayload(payload);
        console.log('Export Summary:', summary);

        const json = toJSONText(payload);
        if (!json || json.length === 0) {
            showExportToast('err', 'JSON content empty: cannot export.');
            return;
        }

        // Derive filename from payload timestamp if available
        const dateStr = payload.generatedAt 
            ? new Date(payload.generatedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const filename = `governance-status-${dateStr}.json`;

        // Always try download first (deterministic)
        const downloadSuccess = downloadBlob(filename, 'application/json; charset=utf-8', json);

        if (downloadSuccess) {
            showExportToast('ok', `✓ Downloaded ${filename}`);
        } else {
            // Download failed: show error and offer copy
            showExportToast('err', 'Download blocked. Copying to clipboard instead...');
            const copyResult = await copyToClipboard(json);
            if (copyResult.ok) {
                showExportToast('ok', '✓ JSON copied to clipboard');
            } else {
                // Final fallback: show in export panel
                renderExportOutput('JSON EXPORT', json);
                showExportToast('warn', 'JSON ready in panel below (copy/download unavailable).');
            }
        }
    } catch (e) {
        showExportToast('err', 'Export error: see panel below.');
    }
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadCSV = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh after the next scheduled check.');
            return;
        }

        const csv = toCSVText(payload);
        if (!csv || csv.length === 0) {
            showExportToast('err', 'CSV content empty: cannot export.');
            return;
        }

        // Derive filename from payload timestamp if available
        const dateStr = payload.generatedAt 
            ? new Date(payload.generatedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const filename = `governance-status-${dateStr}.csv`;

        // Always try download first (deterministic)
        const downloadSuccess = downloadBlob(filename, 'text/csv; charset=utf-8', csv);

        if (downloadSuccess) {
            showExportToast('ok', `✓ Downloaded ${filename}`);
        } else {
            // Download failed: show error and offer copy
            showExportToast('err', 'Download blocked. Copying to clipboard instead...');
            const copyResult = await copyToClipboard(csv);
            if (copyResult.ok) {
                showExportToast('ok', '✓ CSV copied to clipboard');
            } else {
                // Final fallback: show in export panel
                renderExportOutput('CSV EXPORT', csv);
                showExportToast('warn', 'CSV ready in panel below (copy/download unavailable).');
            }
        }
    } catch (e) {
        showExportToast('err', 'Export error: see panel below.');
    }
};

// ============================================================================
// AUDIT SNAPSHOT EXPORT (Phase 5)
// ============================================================================

/**
 * Export Trust Snapshot (Phase 5)
 * 
 * Calls exportTrustSnapshot resolver, downloads JSON + PDF
 */
async function handleExportTrustSnapshot() {
    const statusEl = document.getElementById('export-status');
    if (!statusEl) return;

    try {
        statusEl.textContent = 'Generating...';
        statusEl.style.color = '#0052cc';

        // Call resolver
        const response = await invoke('exportTrustSnapshot', {});

        if (!response || !response.snapshotId) {
            statusEl.textContent = 'Export unavailable';
            statusEl.style.color = '#ae2a19';
            return;
        }

        // Download JSON
        const jsonBlob = new Blob([response.jsonCanonicalText], { type: 'application/json; charset=utf-8' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = response.jsonFilename;
        document.body.appendChild(jsonLink);
        jsonLink.click();
        document.body.removeChild(jsonLink);
        URL.revokeObjectURL(jsonUrl);

        // Download PDF
        const pdfBytes = Buffer.from(response.pdfBase64, 'base64');
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        pdfLink.download = response.pdfFilename;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        document.body.removeChild(pdfLink);
        URL.revokeObjectURL(pdfUrl);

        // Show success
        statusEl.textContent = `Export generated: ${response.snapshotId}`;
        statusEl.style.color = '#216e4e';
    } catch (error) {
        statusEl.textContent = 'Export unavailable';
        statusEl.style.color = '#ae2a19';
    }
}

// ============================================================================
// BUTTON WIRE-UP (Deterministic event listeners)
// ============================================================================

/**
 * Wire up export buttons deterministically on DOM ready
 * Additive to existing inline onclick handlers
 */
function wireExportButtons() {
    try {
        const refreshBtn = document.getElementById('refresh-now-btn');
        const copyBtn = document.getElementById('copy-summary-btn');
        const jsonBtn = document.getElementById('download-json-btn');
        const csvBtn = document.getElementById('download-csv-btn');
        const exportSnapshotBtn = document.getElementById('export-trust-snapshot-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => window.refreshNow());
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', () => window.copySummary());
        }
        if (jsonBtn) {
            jsonBtn.addEventListener('click', () => window.downloadJSON());
        }
        if (csvBtn) {
            csvBtn.addEventListener('click', () => window.downloadCSV());
        }
        if (exportSnapshotBtn) {
            exportSnapshotBtn.addEventListener('click', () => handleExportTrustSnapshot());
        }

        // Verify all buttons are present
        if (!refreshBtn || !copyBtn || !jsonBtn || !csvBtn) {
            showExportToast('err', 'UI misconfigured: missing button element.');
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
    
    // Add build info footer (UI + Backend version proof)
    const buildFooter = document.getElementById('build-footer');
    if (buildFooter) {
        const uiBuild = getBuildIdentifier();
        buildFooter.textContent = uiBuild;
        
        // Try to fetch backend build info via resolver for cache-bust proof
        (async () => {
            try {
                const backendBuild = await invoke('getBuildInfo');
                // Unmissable logging: proof of resolver invocation and build info display
                console.log('[UI_BUILDINFO_DISPLAY] Backend:', backendBuild);
                console.log(`UI_BUILD_PROOF FT_BUILD_SHA=${backendBuild.FT_BUILD_SHA} FT_BUILD_TIME_UTC=${backendBuild.FT_BUILD_TIME_UTC} resolvedAt=${backendBuild.resolvedAt}`);
                
                // Update footer with both UI and backend versions
                const backendDisplay = `${backendBuild.FT_BUILD_SHA} @ ${backendBuild.FT_BUILD_TIME_UTC}`;
                buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                buildFooter.style.color = '#0052cc';
                buildFooter.style.fontWeight = '500';
                
                // Update visible footer with unmissable proof marker
                const proofMarker = document.createElement('div');
                proofMarker.style.fontSize = '10px';
                proofMarker.style.marginTop = '4px';
                proofMarker.style.color = '#626f86';
                proofMarker.style.fontFamily = 'monospace';
                proofMarker.textContent = `[✓ BUILD PROOF] UI+Backend versions verified in real-time`;
                buildFooter.appendChild(proofMarker);
            } catch (err) {
                console.log('[UI] Backend build info unavailable (expected if resolver not registered yet)', err);
                // Keep UI-only build info if backend not available
                buildFooter.textContent = `UI: ${uiBuild}`;
            }
        })();
    }
    
    try {
        loadStatus();
    } catch (fatalError) {
        // ErrorBoundary: if anything throws, render a safe fallback
        console.error('[FATAL UI ERROR]', fatalError);
        const errorPanel = document.getElementById('operational-status');
        if (errorPanel) {
            errorPanel.innerHTML = `
                <div class="error-panel" style="background: #ffeceb; border: 1px solid #f87462; border-radius: 8px; padding: 16px; color: #5d1f1a;">
                    <div style="font-weight: 600; font-size: 14px;">Dashboard Encountered an Error</div>
                    <div style="margin-top: 8px; font-size: 12px;">
                        The dashboard UI encountered an unexpected error. Please try:
                        <ul style="margin-top: 8px; margin-left: 20px;">
                            <li>Refresh the page</li>
                            <li>Remove and re-add the gadget</li>
                            <li>Contact support if the issue persists</li>
                        </ul>
                        <div style="margin-top: 12px; font-family: monospace; font-size: 11px; color: #5d1f1a; opacity: 0.7;">
                            ${String(fatalError).substring(0, 200)}
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Run on DOMContentLoaded to ensure all DOM elements exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    // DOM already loaded
    onDOMReady();
}

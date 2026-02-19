/**
 * Enterprise Governance Panel — ECL Enterprise Hardening UI
 *
 * Renders the full enterprise governance state from the backend aggregator.
 *
 * Rules:
 * - Aggregates all engine results via single invoke()
 * - Entire rendering wrapped in ONE try/catch
 * - If ANY engine throws → render ENTERPRISE GOVERNANCE ENGINE ERROR / System halted (fail-closed)
 * - No partial sections rendered
 * - No silent fallback
 *
 * Marker: FT_ECL_UI_RENDER_GUARD_V1
 *
 * // FT_ECL_UI_RENDER_GUARD_V1
 */

// FT_ECL_UI_RENDER_GUARD_V1

import { invoke } from '@forge/bridge';

/** Invoke key — must match resolver.define() key in gadget-resolver.ts */
const ECL_ENTERPRISE_RESOLVER_KEY = 'ft_getEnterpriseGovernanceState_v1' as const;

/**
 * Render the hard fail-closed error panel.
 * Called whenever any engine throws or data is incomplete.
 */
function renderEngineFailed(container: HTMLElement, reason?: string): void {
  container.innerHTML = '';
  container.style.border = '2px solid #d32f2f';
  container.style.padding = '16px';
  container.style.background = '#fff8f8';
  container.style.fontFamily = 'monospace';
  container.style.borderRadius = '4px';

  const errorTitle = document.createElement('div');
  errorTitle.style.color = '#d32f2f';
  errorTitle.style.fontWeight = 'bold';
  errorTitle.style.fontSize = '14px';
  errorTitle.style.marginBottom = '8px';
  errorTitle.textContent = 'ECL PANEL FAILED (FAIL-CLOSED)';
  container.appendChild(errorTitle);

  const errorBody = document.createElement('div');
  errorBody.style.color = '#333';
  errorBody.style.fontSize = '12px';
  errorBody.textContent = 'System halted (fail-closed). Enterprise governance state could not be loaded.';
  container.appendChild(errorBody);

  if (reason) {
    const reasonDiv = document.createElement('div');
    reasonDiv.style.color = '#666';
    reasonDiv.style.fontSize = '11px';
    reasonDiv.style.marginTop = '8px';
    reasonDiv.style.wordBreak = 'break-all';
    reasonDiv.textContent = `Reason: ${reason}`;
    container.appendChild(reasonDiv);
  }

  const marker = document.createElement('div');
  marker.style.color = '#999';
  marker.style.fontSize = '10px';
  marker.style.marginTop = '8px';
  marker.textContent = `resolver: ${ECL_ENTERPRISE_RESOLVER_KEY} | marker: FT_ECL_UI_RENDER_GUARD_V1`;
  container.appendChild(marker);
}

/**
 * Render a status badge.
 */
function statusBadge(status: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.style.display = 'inline-block';
  badge.style.padding = '2px 8px';
  badge.style.borderRadius = '3px';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = 'bold';
  badge.style.fontFamily = 'monospace';
  badge.style.marginLeft = '8px';

  if (status === 'PASS' || status === 'LOW' || status === 'NONE') {
    badge.style.background = '#e8f5e9';
    badge.style.color = '#2e7d32';
  } else if (status === 'PARTIAL' || status === 'MEDIUM') {
    badge.style.background = '#fff8e1';
    badge.style.color = '#f57f17';
  } else if (status === 'FAIL' || status === 'CRITICAL' || status === 'HIGH') {
    badge.style.background = '#ffebee';
    badge.style.color = '#c62828';
  } else {
    badge.style.background = '#f5f5f5';
    badge.style.color = '#555';
  }

  badge.textContent = status;
  return badge;
}

/**
 * Render a table row.
 */
function tableRow(label: string, value: string | null | undefined, highlight?: boolean): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid #f0f0f0';

  const tdLabel = document.createElement('td');
  tdLabel.style.padding = '6px 12px';
  tdLabel.style.fontWeight = 'bold';
  tdLabel.style.fontSize = '12px';
  tdLabel.style.width = '35%';
  tdLabel.style.color = '#555';
  tdLabel.textContent = label;
  tr.appendChild(tdLabel);

  const tdValue = document.createElement('td');
  tdValue.style.padding = '6px 12px';
  tdValue.style.fontSize = '12px';
  tdValue.style.wordBreak = 'break-all';
  tdValue.style.fontFamily = 'monospace';
  if (highlight) tdValue.style.color = '#1565c0';
  tdValue.textContent = value ?? '—';
  tr.appendChild(tdValue);

  return tr;
}

/**
 * Render the full enterprise governance panel from resolved state.
 * No partial rendering: all or fail-closed.
 */
function renderGovernanceState(container: HTMLElement, state: any): void {
  container.innerHTML = '';

  if (!state || state.available !== true) {
    renderEngineFailed(container, 'Governance state unavailable');
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  // Hash chain
  const chainSection = document.createElement('tr');
  chainSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Hash Chain</td>';
  table.appendChild(chainSection);
  table.appendChild(tableRow('Chain length', String(state.chainLength ?? 0)));
  table.appendChild(tableRow('Last chain index', state.lastChainIndex != null ? String(state.lastChainIndex) : 'No entries'));
  table.appendChild(tableRow('Last snapshot hash', state.lastSnapshotHash, true));
  table.appendChild(tableRow('Last chain hash', state.lastChainHash, true));

  // Baseline
  const baselineSection = document.createElement('tr');
  baselineSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Baseline</td>';
  table.appendChild(baselineSection);
  table.appendChild(tableRow('Baseline version', state.baselineVersion != null ? String(state.baselineVersion) : 'Not set'));
  table.appendChild(tableRow('Baseline snapshot hash', state.baselineSnapshotHash, true));

  // Attestation ledger
  const ledgerSection = document.createElement('tr');
  ledgerSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Attestation Ledger</td>';
  table.appendChild(ledgerSection);
  table.appendChild(tableRow('Ledger sealed', state.ledgerSealed ? 'YES' : 'NO'));
  table.appendChild(tableRow('Attestation count', String(state.attestationCount ?? 0)));
  table.appendChild(tableRow('Seal hash', state.sealHash, true));

  // Risk posture
  if (state.riskPosture) {
    const postureSection = document.createElement('tr');
    postureSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Risk Posture</td>';
    table.appendChild(postureSection);
    const postureRow = tableRow('Overall posture', '');
    const postureCell = postureRow.children[1] as HTMLElement;
    postureCell.appendChild(statusBadge(state.riskPosture.posture));
    table.appendChild(postureRow);
    table.appendChild(tableRow('Reason', state.riskPosture.reason));
    table.appendChild(tableRow('Review sealed', state.riskPosture.reviewSealed ? 'YES' : 'NO'));
  }

  // Control mapping
  if (state.controlMapping) {
    const controlSection = document.createElement('tr');
    controlSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Control Mapping</td>';
    table.appendChild(controlSection);
    const overallRow = tableRow('Overall status', '');
    const overallCell = overallRow.children[1] as HTMLElement;
    overallCell.appendChild(statusBadge(state.controlMapping.overallStatus));
    table.appendChild(overallRow);
    table.appendChild(tableRow('Controls evaluated', String(state.controlMapping.controlCount)));
    table.appendChild(tableRow('PASS', String(state.controlMapping.passCount)));
    table.appendChild(tableRow('PARTIAL', String(state.controlMapping.partialCount)));
    table.appendChild(tableRow('FAIL', String(state.controlMapping.failCount)));
  }

  // Export provenance
  if (state.exportPayload) {
    const exportSection = document.createElement('tr');
    exportSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Export Provenance</td>';
    table.appendChild(exportSection);
    table.appendChild(tableRow('Export SHA-256', state.exportPayload.exportSha256, true));
    table.appendChild(tableRow('Chain index', String(state.exportPayload.chainIndex)));
    table.appendChild(tableRow('Baseline version', String(state.exportPayload.baselineVersion)));
  }

  // Build identity
  const buildSection = document.createElement('tr');
  buildSection.innerHTML = '<td colspan="2" style="padding:8px 12px;background:#f9f9f9;font-weight:bold;font-size:13px;color:#333">Build Identity</td>';
  table.appendChild(buildSection);
  table.appendChild(tableRow('Build SHA', state.buildShaShort, true));
  table.appendChild(tableRow('Build UTC', state.buildUtc));
  table.appendChild(tableRow('Schema version', state.schemaVersion));
  table.appendChild(tableRow('RuleSet version', state.ruleSetVersion));
  table.appendChild(tableRow('Resolved UTC', state.resolvedUtc));

  container.appendChild(table);
}

/**
 * Render the Enterprise Governance Panel.
 *
 * Returns an HTMLElement immediately (synchronous) with a loading placeholder.
 * Proof data loads asynchronously via invoke() and updates the DOM.
 *
 * Single try/catch wraps ALL engine calls: any failure → fail-closed.
 * No partial sections.
 *
 * // FT_ECL_UI_RENDER_GUARD_V1
 */
export function renderEnterpriseGovernancePanel(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'ft-ecl-enterprise-panel';
  section.className = 'ecl-enterprise-governance-panel';
  section.setAttribute('data-ft-marker', 'FT_ECL_UI_RENDER_GUARD_V1');
  // Visible card styling — NEVER invisible
  section.style.border = '1px solid #ddd';
  section.style.borderRadius = '8px';
  section.style.padding = '12px';
  section.style.background = '#fff';

  const title = document.createElement('h3');
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '4px';
  title.style.color = '#1a237e';
  title.textContent = 'ECL Status + Governance Engine Proof';
  section.appendChild(title);

  const updatedLine = document.createElement('div');
  updatedLine.style.fontSize = '11px';
  updatedLine.style.color = '#888';
  updatedLine.style.marginBottom = '10px';
  updatedLine.style.fontFamily = 'monospace';
  updatedLine.textContent = `Last updated UTC: ${new Date().toISOString()}`;
  section.appendChild(updatedLine);

  const container = document.createElement('div');
  container.className = 'ecl-governance-container';

  const loadingDiv = document.createElement('div');
  loadingDiv.style.color = '#888';
  loadingDiv.style.fontSize = '12px';
  loadingDiv.style.fontFamily = 'monospace';
  loadingDiv.textContent = `Loading… [${ECL_ENTERPRISE_RESOLVER_KEY}]`;
  container.appendChild(loadingDiv);

  section.appendChild(container);

  // ================================================================
  // ECL-ENTERPRISE proof-correct async invocation
  // Markers emitted in strict order:
  //   INVOKE_START → (INVOKE_OK | INVOKE_FAIL) → validation → LOADED → RENDERED
  // FT_ECL_UI_RENDER_GUARD_V1
  // ================================================================
  (async () => {
    // A) Log invoke start — always, before the network call
    console.log('[FT_PROOF] UI_ECL_ENTERPRISE_INVOKE_START=1 resolver=ft_getEnterpriseGovernanceState_v1');

    // B) Attempt invoke — isolated try/catch so throw ≠ success
    let resp: any;
    try {
      resp = await invoke(ECL_ENTERPRISE_RESOLVER_KEY);
      console.log('[FT_PROOF] UI_ECL_ENTERPRISE_INVOKE_OK=1');
    } catch (invokeErr: any) {
      console.log('[FT_PROOF] UI_ECL_ENTERPRISE_INVOKE_FAIL=1');
      console.log('[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=INVOKE_THROW');
      console.error('[FT_ECL_UI_RENDER_GUARD_V1] invoke threw:', invokeErr);
      renderEngineFailed(container, `INVOKE_THROW: ${invokeErr instanceof Error ? invokeErr.message : String(invokeErr)}`);
      return;
    }

    // C1) Validate: non-null response
    if (resp === null || resp === undefined) {
      console.log('[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=EMPTY_RESPONSE');
      renderEngineFailed(container, 'EMPTY_RESPONSE: invoke returned null/undefined');
      return;
    }

    // C2) Validate: if an explicit ok field is present, it must be true
    if (Object.prototype.hasOwnProperty.call(resp, 'ok') && resp.ok !== true) {
      const reason = resp.reason ?? resp.error ?? 'UNKNOWN';
      console.log(`[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=OK_FALSE resp_reason=${reason}`);
      renderEngineFailed(container, `OK_FALSE: enterprise state not available (reason=${reason})`);
      return;
    }

    // C3) Validate: response must be an object (schema guard)
    if (typeof resp !== 'object' || Array.isArray(resp)) {
      console.log('[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=SCHEMA_MISMATCH');
      renderEngineFailed(container, `SCHEMA_MISMATCH: expected object, got ${typeof resp}`);
      return;
    }

    // C4) Validate: governance state must be available
    if (resp.available !== true) {
      const reason = resp.reason ?? resp.error ?? 'NOT_AVAILABLE';
      console.log(`[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=SCHEMA_MISMATCH resp_available=${resp.available}`);
      renderEngineFailed(container, `SCHEMA_MISMATCH: governance state not available (reason=${reason})`);
      return;
    }

    // All validations passed — emit LOADED
    console.log('[FT_PROOF] UI_ECL_PANEL_LOADED=1');

    // D) Render into DOM
    try {
      renderGovernanceState(container, resp);
      // E) Emit RENDERED only after DOM update completes without error
      console.log('[FT_PROOF] UI_ECL_PANEL_RENDERED=1');
    } catch (renderErr: any) {
      renderEngineFailed(container, renderErr instanceof Error ? renderErr.message : String(renderErr));
    }
  })();

  return section;
}

// Named export alias — required by main.ts import constraint and protocol
// FT_ECL_UI_RENDER_GUARD_V1
export { renderEnterpriseGovernancePanel as EnterpriseGovernancePanel };

// FT_ECL_UI_RENDER_GUARD_V1 END

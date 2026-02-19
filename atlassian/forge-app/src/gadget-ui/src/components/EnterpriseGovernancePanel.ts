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
 * Strict UI-side contract for the enterprise governance resolver payload.
 * The backend MUST return an object matching this shape.
 * UI validation fails-closed on any mismatch.
 */
type EclEnterpriseState = {
  marker: string;                       // must equal FT_ECL_ENTERPRISE_STATE_V1
  ok: boolean;                          // must be true for LOADED
  generatedUtc: string;                 // ISO
  ecl: {
    ECL1: { pass: boolean; reason: string };
    ECL2: { pass: boolean; reason: string };
    ECL3: { pass: boolean; reason: string };
    ECL4: { pass: boolean; reason: string };
    ECL5: { pass: boolean; reason: string };
    ECL6: { pass: boolean; reason: string };
    ECL7: { pass: boolean; reason: string };
    ECL8: { pass: boolean; reason: string };
  };
  proofs: {
    snapshotKind: 'SEED' | 'GOVERNANCE' | 'UNKNOWN';
    exportEligible: boolean;
    exportReasonCode: string;
    chainHeadSha256: string | null;
    chainLength: number | null;
    chainVerified: boolean | null;
    baselineVersion: string | null;
    driftLastScanUtc: string | null;
    driftRiskBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    attestationCount: number | null;
    lastAttestedUtc: string | null;
  };
};

/** The 8 required ECL keys in display order */
const ECL_KEYS = ['ECL1', 'ECL2', 'ECL3', 'ECL4', 'ECL5', 'ECL6', 'ECL7', 'ECL8'] as const;

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
 * Render the ECL1..8 scoreboard + core enterprise proofs into container.
 * No partial rendering: all or fail-closed (called only after full validation).
 */
function renderGovernanceState(container: HTMLElement, state: EclEnterpriseState): void {
  container.innerHTML = '';

  // ── ECL 1→8 Scoreboard ──────────────────────────────────────────────────────
  const scoreHeader = document.createElement('div');
  scoreHeader.style.fontWeight = 'bold';
  scoreHeader.style.fontSize = '13px';
  scoreHeader.style.color = '#1a237e';
  scoreHeader.style.marginBottom = '6px';
  scoreHeader.textContent = 'ECL 1\u21928 Scoreboard';
  container.appendChild(scoreHeader);

  const scoreTable = document.createElement('table');
  scoreTable.style.width = '100%';
  scoreTable.style.borderCollapse = 'collapse';
  scoreTable.style.fontSize = '12px';
  scoreTable.style.fontFamily = 'monospace';
  scoreTable.style.marginBottom = '14px';

  const hRow = document.createElement('tr');
  hRow.style.background = '#f5f5f5';
  for (const h of ['Level', 'Status', 'Reason']) {
    const th = document.createElement('th');
    th.style.padding = '5px 10px';
    th.style.textAlign = 'left';
    th.style.fontSize = '11px';
    th.style.color = '#555';
    th.textContent = h;
    hRow.appendChild(th);
  }
  scoreTable.appendChild(hRow);

  for (const key of ECL_KEYS) {
    const entry = state.ecl[key];
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f0f0f0';

    const tdKey = document.createElement('td');
    tdKey.style.padding = '5px 10px';
    tdKey.style.fontWeight = 'bold';
    tdKey.textContent = key;
    tr.appendChild(tdKey);

    const tdStatus = document.createElement('td');
    tdStatus.style.padding = '5px 6px';
    tdStatus.appendChild(statusBadge(entry.pass ? 'PASS' : 'FAIL'));
    tr.appendChild(tdStatus);

    const tdReason = document.createElement('td');
    tdReason.style.padding = '5px 10px';
    tdReason.style.color = '#555';
    tdReason.textContent = entry.reason;
    tr.appendChild(tdReason);

    scoreTable.appendChild(tr);
  }
  container.appendChild(scoreTable);

  // ── Core Enterprise Proofs ───────────────────────────────────────────────────
  const proofHeader = document.createElement('div');
  proofHeader.style.fontWeight = 'bold';
  proofHeader.style.fontSize = '13px';
  proofHeader.style.color = '#1a237e';
  proofHeader.style.margin = '4px 0 6px';
  proofHeader.textContent = 'Core Enterprise Proofs';
  container.appendChild(proofHeader);

  const proofTable = document.createElement('table');
  proofTable.style.width = '100%';
  proofTable.style.borderCollapse = 'collapse';
  proofTable.style.fontSize = '12px';
  proofTable.style.fontFamily = 'monospace';

  const p = state.proofs;

  // snapshotKind — warn loudly if SEED or exportEligible=false
  const kindTr = tableRow('snapshotKind', p.snapshotKind);
  if (p.snapshotKind === 'SEED' || p.snapshotKind === 'UNKNOWN') {
    const cell = kindTr.children[1] as HTMLElement;
    cell.style.color = '#e65100';
    cell.textContent = `${p.snapshotKind} — NOT READY for governance export`;
  }
  proofTable.appendChild(kindTr);

  const eligibleTr = tableRow('exportEligible', p.exportEligible ? 'YES' : `NO — ${p.exportReasonCode}`);
  if (!p.exportEligible) (eligibleTr.children[1] as HTMLElement).style.color = '#c62828';
  proofTable.appendChild(eligibleTr);

  proofTable.appendChild(tableRow('chainHeadSha256', p.chainHeadSha256, true));
  proofTable.appendChild(tableRow('chainLength', p.chainLength != null ? String(p.chainLength) : '—'));
  proofTable.appendChild(tableRow('chainVerified', p.chainVerified != null ? (p.chainVerified ? 'YES' : 'NO') : '—'));
  proofTable.appendChild(tableRow('baselineVersion', p.baselineVersion ?? '—'));
  proofTable.appendChild(tableRow('driftLastScanUtc', p.driftLastScanUtc ?? '—'));

  const driftBandTr = tableRow('driftRiskBand', '');
  (driftBandTr.children[1] as HTMLElement).appendChild(statusBadge(p.driftRiskBand));
  proofTable.appendChild(driftBandTr);

  proofTable.appendChild(tableRow('attestationCount', p.attestationCount != null ? String(p.attestationCount) : '—'));
  proofTable.appendChild(tableRow('lastAttestedUtc', p.lastAttestedUtc ?? '—'));
  proofTable.appendChild(tableRow('generatedUtc', state.generatedUtc));

  container.appendChild(proofTable);
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

    // C2) Validate: ok must be present and true (required field)
    if (resp.ok !== true) {
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

    // C4) Validate: marker must be FT_ECL_ENTERPRISE_STATE_V1
    if (resp.marker !== 'FT_ECL_ENTERPRISE_STATE_V1') {
      console.log(`[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=SCHEMA_MISMATCH marker=${resp.marker}`);
      renderEngineFailed(container, `SCHEMA_MISMATCH: expected marker FT_ECL_ENTERPRISE_STATE_V1, got ${resp.marker}`);
      return;
    }

    // C5) Validate: ecl object must have all 8 keys
    const _ecl = resp.ecl;
    if (!_ecl || typeof _ecl !== 'object') {
      console.log('[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=SCHEMA_MISMATCH ecl=missing');
      renderEngineFailed(container, 'SCHEMA_MISMATCH: ecl object missing from response');
      return;
    }
    const _missingEcl = ECL_KEYS.filter(k => !Object.prototype.hasOwnProperty.call(_ecl, k));
    if (_missingEcl.length > 0) {
      console.log(`[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=SCHEMA_MISMATCH missing_ecl_keys=${_missingEcl.join(',')}`);
      renderEngineFailed(container, `SCHEMA_MISMATCH: ecl missing keys: ${_missingEcl.join(', ')}`);
      return;
    }

    // C6) Validate: proofs object must be present
    if (!resp.proofs || typeof resp.proofs !== 'object') {
      console.log('[FT_PROOF] UI_ECL_PANEL_LOAD_FAILED=1 REASON=SCHEMA_MISMATCH proofs=missing');
      renderEngineFailed(container, 'SCHEMA_MISMATCH: proofs object missing from response');
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

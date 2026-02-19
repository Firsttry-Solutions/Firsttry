/**
 * Trust & Determinism Panel
 *
 * ECL-5 + ECL-ENTERPRISE-HARDENING: Expose deterministic proof artifacts in UI
 *
 * Renders three sections:
 * 1. Data Handling (existing)
 * 2. Trust & Determinism (ECL-5) — displays proof bundle data
 * 3. Enterprise Governance Engine (ECL-ENTERPRISE) — fail-closed governance state
 * 4. Procurement Assurance Block (static, hardcoded)
 *
 * Fail-closed: Any engine failure → "ENTERPRISE GOVERNANCE ENGINE ERROR / System halted"
 *
 * SYNCHRONOUS RENDERING: Function returns immediately with placeholder.
 * Proof data loads asynchronously and updates DOM via promise chain.
 *
 * Marker: FT_ECL_PHASE: ECL-5 TRUST_READER_UI
 * Marker: FT_ECL_UI_RENDER_GUARD_V1
 * Marker: FT_ECL_UI_PROCUREMENT_BLOCK_V1
 */

import { invoke } from '@forge/bridge';
import { renderEnterpriseGovernancePanel } from '../components/EnterpriseGovernancePanel';
import { renderProcurementAssurance } from '../components/ProcurementAssurance';

// ECL-5: Trust resolver key constant (preserved in dist to enable runtime proof loading)
const TRUST_RESOLVER_KEY_V1 = 'ft_getTrustPanelProof_v1';

export function renderTrustSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'trust-section';

  // ============================================================================
  // SECTION 1: Data Handling (existing)
  // ============================================================================
  
  const title = document.createElement('h2');
  title.className = 'trust-section-title';
  title.textContent = '🔒 Trust & Data Handling';
  section.appendChild(title);

  // Collapsible details
  const details = document.createElement('details');
  details.className = 'trust-details';

  const summary = document.createElement('summary');
  summary.className = 'trust-summary';
  summary.textContent = 'How we handle your data';
  details.appendChild(summary);

  // Content container
  const content = document.createElement('div');
  content.className = 'trust-content';
  content.innerHTML = `
    <p><strong>Data Accessed:</strong> This dashboard reads Jira configuration and workflow metadata via the Forge platform's read:jira-work scope as declared in the manifest.</p>
    <p><strong>Data Stored:</strong> Governance snapshots and audit evidence are persisted using the Forge app storage scope (storage:app). Data retention policies are documented in docs/PRIVACY.md.</p>
    <p><strong>Data Egress:</strong> This dashboard does not initiate external network requests based on our repository network-surface scan. All processing occurs within your Jira Cloud instance via the Forge platform.</p>
    <p><strong>Uninstall:</strong> Uninstalling this app removes access to Jira data and stops all background processes. Stored data is managed according to Forge platform policies (see docs/PRIVACY.md).</p>
  `;
  details.appendChild(content);
  section.appendChild(details);

  // ============================================================================
  // SECTION 2: Trust & Determinism (NEW)
  // ============================================================================
  
  const determinismTitle = document.createElement('h3');
  determinismTitle.className = 'trust-determinism-title';
  determinismTitle.textContent = '✓ Trust & Determinism Proof';
  section.appendChild(determinismTitle);

  // Proof container with loading placeholder (rendered synchronously)
  const proofContainer = document.createElement('div');
  proofContainer.className = 'trust-proof-container';
  
  const loadingDiv = document.createElement('div');
  loadingDiv.textContent = 'Loading proof… (ft_getTrustPanelProof_v1)';
  proofContainer.appendChild(loadingDiv);
  
  section.appendChild(proofContainer);

  // ============================================================================
  // ASYNCHRONOUS PROOF LOADING (promise chain)
  // ============================================================================

  // Helper: render fail-closed message
  function renderFailClosed() {
    proofContainer.innerHTML = '';
    const failDiv = document.createElement('div');
    failDiv.className = 'trust-proof-fail-closed';
    failDiv.textContent = `Proof pack not generated — FAIL-CLOSED [${TRUST_RESOLVER_KEY_V1}]`;
    proofContainer.appendChild(failDiv);
  }

  // Helper: render proof table with 9 rows
  function renderTable(trustData: any) {
    proofContainer.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'trust-proof-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    table.style.fontFamily = 'monospace';

    const rows = [
      ['Read-only guarantee', trustData.readOnlyGuarantee],
      ['No mutation attestation SHA', trustData.noMutationAttestationSha],
      ['No outbound attestation SHA', trustData.noOutboundAttestationSha],
      ['Scope hash', trustData.scopeHash],
      ['Allowlist hash', trustData.allowlistHash],
      ['Allowlist version', trustData.allowlistVersion],
      ['Schema version', trustData.schemaVersion],
      ['RuleSet version', trustData.ruleSetVersion],
      ['Last proof bundle SHA', trustData.lastProofBundleSha]
    ];

    for (const [label, value] of rows) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e0e0e0';

      const tdLabel = document.createElement('td');
      tdLabel.style.padding = '8px 12px';
      tdLabel.style.fontWeight = 'bold';
      tdLabel.style.width = '25%';
      tdLabel.textContent = label;
      tr.appendChild(tdLabel);

      const tdValue = document.createElement('td');
      tdValue.style.padding = '8px 12px';
      tdValue.style.wordBreak = 'break-all';
      tdValue.style.color = '#333';
      tdValue.textContent = value;
      tr.appendChild(tdValue);

      table.appendChild(tr);
    }

    proofContainer.appendChild(table);
  }

  // Load proof data asynchronously
  invoke('ft_getTrustPanelProof_v1')
    .then((trustData: any) => {
      if (!trustData) {
        renderFailClosed();
        return;
      }
      renderTable(trustData);
    })
    .catch((err: any) => {
      console.error('[TRUST_UI] Proof invoke failed (ft_getTrustPanelProof_v1):', err);
      renderFailClosed();
    });

  // ============================================================================
  // SECTION 3: Enterprise Governance Engine (ECL-ENTERPRISE-HARDENING)
  // Single try/catch — fail-closed if any engine throws
  // FT_ECL_UI_RENDER_GUARD_V1
  // ============================================================================
  const governanceDivider = document.createElement('hr');
  governanceDivider.style.border = 'none';
  governanceDivider.style.borderTop = '1px solid #e0e0e0';
  governanceDivider.style.margin = '16px 0';
  section.appendChild(governanceDivider);

  try {
    const governancePanel = renderEnterpriseGovernancePanel();
    section.appendChild(governancePanel);
  } catch (engineErr: any) {
    // Hard fail-closed: engine instantiation itself failed
    const failDiv = document.createElement('div');
    failDiv.style.border = '2px solid #d32f2f';
    failDiv.style.padding = '16px';
    failDiv.style.background = '#fff8f8';
    failDiv.style.fontFamily = 'monospace';
    failDiv.style.borderRadius = '4px';

    const errTitle = document.createElement('div');
    errTitle.style.color = '#d32f2f';
    errTitle.style.fontWeight = 'bold';
    errTitle.textContent = 'ENTERPRISE GOVERNANCE ENGINE ERROR';
    failDiv.appendChild(errTitle);

    const errBody = document.createElement('div');
    errBody.style.color = '#333';
    errBody.style.fontSize = '12px';
    errBody.textContent = 'System halted (fail-closed)';
    failDiv.appendChild(errBody);

    section.appendChild(failDiv);
  }

  // ============================================================================
  // SECTION 4: Procurement Assurance Block (static, hardcoded)
  // FT_ECL_UI_PROCUREMENT_BLOCK_V1
  // ============================================================================
  const procurementDivider = document.createElement('hr');
  procurementDivider.style.border = 'none';
  procurementDivider.style.borderTop = '1px solid #e0e0e0';
  procurementDivider.style.margin = '16px 0';
  section.appendChild(procurementDivider);

  section.appendChild(renderProcurementAssurance());

  // Return section immediately (synchronous)
  return section;
}

// FT_ECL_PHASE: ECL-5 TRUST_READER_UI
// FT_ECL_UI_RENDER_GUARD_V1
// FT_ECL_UI_PROCUREMENT_BLOCK_V1


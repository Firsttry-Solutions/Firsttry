/**
 * Trust & Determinism Panel
 *
 * ECL-5: Expose deterministic proof artifacts in UI
 * 
 * Renders two sections:
 * 1. Data Handling (existing)
 * 2. Trust & Determinism (NEW) - displays proof bundle data
 * 
 * Fail-closed: Shows "Proof pack not generated — FAIL-CLOSED" if bundle unavailable
 * 
 * SYNCHRONOUS RENDERING: Function returns immediately with placeholder.
 * Proof data loads asynchronously and updates DOM via promise chain.
 * 
 * Marker: FT_ECL_PHASE: ECL-5 TRUST_READER_UI
 */

import { invoke } from '@forge/bridge';

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

  // Return section immediately (synchronous)
  return section;
}

// FT_ECL_PHASE: ECL-5 TRUST_READER_UI


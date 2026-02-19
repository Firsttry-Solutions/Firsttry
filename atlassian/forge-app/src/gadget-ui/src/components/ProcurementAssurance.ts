/**
 * Procurement Assurance Block — ECL Enterprise Hardening UI
 *
 * Static hardcoded procurement assurance text.
 * No dynamic inference. No conditions. No runtime generation.
 *
 * // FT_ECL_UI_PROCUREMENT_BLOCK_V1
 */

// FT_ECL_UI_PROCUREMENT_BLOCK_V1

/**
 * Render the static Procurement Assurance Block.
 *
 * Hardcoded text only. No dynamic content.
 * No conditions. No runtime inference.
 *
 * // FT_ECL_UI_PROCUREMENT_BLOCK_V1
 */
export function renderProcurementAssurance(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'ecl-procurement-assurance';
  section.setAttribute('data-ft-marker', 'FT_ECL_UI_PROCUREMENT_BLOCK_V1');

  const title = document.createElement('h3');
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '12px';
  title.style.color = '#1a237e';
  title.textContent = '⬡ Procurement & Compliance Assurance';
  section.appendChild(title);

  const block = document.createElement('div');
  block.style.border = '1px solid #c5cae9';
  block.style.borderRadius = '4px';
  block.style.padding = '16px';
  block.style.background = '#f8f9ff';
  block.style.fontSize = '12px';
  block.style.fontFamily = 'sans-serif';
  block.style.lineHeight = '1.6';

  // All text is hardcoded — no dynamic inference
  block.innerHTML = `
    <p style="margin:0 0 10px 0"><strong>Read-Only Access:</strong>
    This application operates exclusively in read-only mode. It does not write, modify, or delete
    any Jira data. All data access is scoped to <code>read:jira-work</code> as declared in the
    manifest and verified by static source scan.</p>

    <p style="margin:0 0 10px 0"><strong>No Outbound Network Requests:</strong>
    This application does not initiate any external network connections. All processing occurs
    within your Atlassian Jira Cloud instance via the Forge platform. This is verified by
    static network surface scan on every build.</p>

    <p style="margin:0 0 10px 0"><strong>Deterministic Audit Evidence:</strong>
    All governance snapshots, hash chains, attestation records, and export artifacts are produced
    by deterministic engines using canonical SHA-256 hashing. Evidence is reproducible and
    tamper-evident.</p>

    <p style="margin:0 0 10px 0"><strong>Scope Integrity:</strong>
    No new API scopes have been added. The manifest scope declaration has not changed from the
    originally reviewed version. Scope hash is included in every export payload.</p>

    <p style="margin:0 0 10px 0"><strong>Data Residency:</strong>
    All stored data (governance snapshots, audit ledgers, baseline records) is persisted using
    the Forge platform's native app storage APIs. No data is stored outside the Atlassian
    platform boundary.</p>

    <p style="margin:0 0 10px 0"><strong>Uninstall Behaviour:</strong>
    Uninstalling this application removes access to Jira data and terminates all scheduled
    processes. Stored data lifecycle is governed by Atlassian Forge platform policies.</p>

    <p style="margin:0 0 10px 0"><strong>Enterprise Governance Architecture:</strong>
    This application implements the ECL Enterprise Governance Architecture, including:
    canonical JSON serialization (SHA-256), append-only hash chain, sealed attestation ledger,
    baseline versioning, drift risk engine, control mapping, and risk posture engine.
    All engines are fail-closed: incomplete input causes halt, not silent degradation.</p>

    <p style="margin:0"><strong>Certification Disclaimer:</strong>
    Control mappings reference SOC 2 and ISO/IEC 27001 control identifiers by static rule for
    informational purposes only. This application does not constitute a certified audit report
    or a formal attestation of compliance. Engage a qualified auditor for certification.</p>
  `;

  section.appendChild(block);

  const marker = document.createElement('div');
  marker.style.color = '#9e9e9e';
  marker.style.fontSize = '10px';
  marker.style.marginTop = '8px';
  marker.style.fontFamily = 'monospace';
  marker.textContent = '// FT_ECL_UI_PROCUREMENT_BLOCK_V1';
  section.appendChild(marker);

  return section;
}

// FT_ECL_UI_PROCUREMENT_BLOCK_V1 END

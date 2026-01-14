/**
 * Trust & Data Handling Section
 *
 * Renders a professional, procurement-friendly section describing
 * how data is accessed, stored, and handled.
 *
 * This is non-legal but transparent: shows data practices clearly.
 */

export function renderTrustSection(): HTMLElement {
  const section = document.createElement('section');
  section.style.background = '#ffffff';
  section.style.border = '1px solid #dfe1e6';
  section.style.borderRadius = '8px';
  section.style.padding = '16px';
  section.style.marginBottom = '16px';
  section.style.boxShadow = '0 1px 1px rgba(9, 30, 66, 0.13)';

  // Title
  const title = document.createElement('h2');
  title.style.fontSize = '16px';
  title.style.fontWeight = '600';
  title.style.color = '#172b4d';
  title.style.marginBottom = '16px';
  title.style.paddingBottom = '12px';
  title.style.borderBottom = '1px solid #dfe1e6';
  title.textContent = '🔒 Trust & Data Handling';
  section.appendChild(title);

  // Collapsible details
  const details = document.createElement('details');
  details.style.marginTop = '12px';

  const summary = document.createElement('summary');
  summary.style.cursor = 'pointer';
  summary.style.fontSize = '13px';
  summary.style.fontWeight = '600';
  summary.style.color = '#0052cc';
  summary.style.marginBottom = '12px';
  summary.textContent = 'How we handle your data';
  details.appendChild(summary);

  // Content container
  const content = document.createElement('div');
  content.style.padding = '12px';
  content.style.background = '#f1f2f4';
  content.style.borderRadius = '4px';
  content.style.marginTop = '8px';
  content.style.fontSize = '13px';
  content.style.color = '#44546f';
  content.style.lineHeight = '1.6';

  content.innerHTML = `
    <p style="margin: 0 0 12px 0;"><strong>Data Accessed:</strong> This dashboard reads Jira configuration and workflow metadata via the Forge platform's read:jira-work scope as declared in the manifest.</p>
    <p style="margin: 0 0 12px 0;"><strong>Data Stored:</strong> Governance snapshots and audit evidence are persisted using the Forge app storage scope (storage:app). Data retention policies are documented in docs/PRIVACY.md.</p>
    <p style="margin: 0 0 12px 0;"><strong>Data Egress:</strong> This dashboard does not initiate external network requests based on our repository network-surface scan. All processing occurs within your Jira Cloud instance via the Forge platform.</p>
    <p style="margin: 0;"><strong>Uninstall:</strong> Uninstalling this app removes access to Jira data and stops all background processes. Stored data is managed according to Forge platform policies (see docs/PRIVACY.md).</p>
  `;
  details.appendChild(content);
  section.appendChild(details);

  return section;
}

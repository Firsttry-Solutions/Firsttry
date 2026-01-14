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
    <p style="margin: 0 0 12px 0;"><strong>Data Accessed:</strong> Jira metadata required for the dashboard (read-only via Jira API scopes).</p>
    <p style="margin: 0 0 12px 0;"><strong>Data Stored:</strong> Governance snapshots and evidence ledgers are retained according to your retention policy.</p>
    <p style="margin: 0 0 12px 0;"><strong>Data Egress:</strong> No data is sent to external services. All processing is local to your Atlassian instance.</p>
    <p style="margin: 0;"><strong>Uninstall:</strong> Removing this app from your Jira instance revokes all access and removes stored evidence (subject to Jira's native retention settings).</p>
  `;
  details.appendChild(content);
  section.appendChild(details);

  return section;
}

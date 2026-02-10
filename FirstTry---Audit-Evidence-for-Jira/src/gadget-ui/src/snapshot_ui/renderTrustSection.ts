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
  section.className = 'trust-section';

  // Title
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

  return section;
}

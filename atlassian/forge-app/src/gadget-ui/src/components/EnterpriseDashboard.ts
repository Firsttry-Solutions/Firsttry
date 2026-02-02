/**
 * Enterprise Dashboard V1 - Main component
 * Read-only, deterministic rendering of snapshot data
 * No writes, no new scopes, dumb reader only
 */

import { UI_GIT_SHA_SHORT, UI_BUILD_TIME_UTC } from '../build/buildIdentity.gen';

/**
 * Represents the current snapshot state
 */
export interface SnapshotState {
  status: 'AVAILABLE' | 'NO_SNAPSHOT' | 'DEGRADED' | 'ERROR';
  snapshotId?: string;
  createdAtUtc?: string;
  schemaVersion?: string;
  backendAppVersion?: string;
  backendGitShaShort?: string;
  backendBuildTimeUtc?: string;
  rawPayload?: any;
}

/**
 * Create header section
 */
export function createHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'ft-enterprise-header';
  
  const titleContainer = document.createElement('div');
  titleContainer.className = 'ft-enterprise-header-title';
  
  const title = document.createElement('h1');
  title.textContent = 'FirstTry — Audit Evidence Snapshot';
  title.className = 'ft-enterprise-title';
  
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Read-only. Exports evidence for audits and reviews.';
  subtitle.className = 'ft-enterprise-subtitle';
  
  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);
  
  const badgeContainer = document.createElement('div');
  badgeContainer.className = 'ft-enterprise-badges';
  
  const readOnlyBadge = document.createElement('span');
  readOnlyBadge.className = 'ft-badge ft-badge-readonly';
  readOnlyBadge.textContent = 'READ-ONLY';
  
  badgeContainer.appendChild(readOnlyBadge);
  
  const prodBadge = document.createElement('span');
  prodBadge.className = 'ft-badge ft-badge-prod';
  prodBadge.textContent = 'PRODUCTION';
  badgeContainer.appendChild(prodBadge);
  
  header.appendChild(titleContainer);
  header.appendChild(badgeContainer);
  
  return header;
}

/**
 * Create status panel with snapshot information
 */
export function createStatusPanel(state: SnapshotState): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'ft-status-panel';
  
  // Status line
  const statusLine = document.createElement('div');
  statusLine.className = 'ft-status-line';
  
  const statusBadge = document.createElement('span');
  statusBadge.className = `ft-status-badge ft-status-${state.status.toLowerCase()}`;
  statusBadge.textContent = `Snapshot: ${state.status}`;
  
  statusLine.appendChild(statusBadge);
  panel.appendChild(statusLine);
  
  // Content wrapper
  const content = document.createElement('div');
  content.className = 'ft-status-content';
  
  // Left: Definition list
  const defList = document.createElement('div');
  defList.className = 'ft-def-list';
  
  if (state.createdAtUtc) {
    const defItem = document.createElement('div');
    defItem.className = 'ft-def-item';
    const label = document.createElement('dt');
    label.textContent = 'Last captured (UTC)';
    const value = document.createElement('dd');
    value.textContent = new Date(state.createdAtUtc).toISOString();
    defItem.appendChild(label);
    defItem.appendChild(value);
    defList.appendChild(defItem);
  }
  
  if (state.snapshotId) {
    const defItem = document.createElement('div');
    defItem.className = 'ft-def-item';
    const label = document.createElement('dt');
    label.textContent = 'Snapshot ID';
    const value = document.createElement('dd');
    value.className = 'ft-snapshot-id-container';
    value.textContent = state.snapshotId;
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'ft-btn ft-btn-icon ft-btn-copy-id';
    copyBtn.title = 'Copy snapshot ID';
    copyBtn.textContent = '📋';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(state.snapshotId!).then(() => {
        const toast = document.createElement('div');
        toast.className = 'ft-toast ft-toast-success';
        toast.textContent = 'Snapshot ID copied';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      });
    };
    
    value.appendChild(copyBtn);
    defItem.appendChild(label);
    defItem.appendChild(value);
    defList.appendChild(defItem);
  }
  
  if (state.schemaVersion) {
    const defItem = document.createElement('div');
    defItem.className = 'ft-def-item';
    const label = document.createElement('dt');
    label.textContent = 'Schema version';
    const value = document.createElement('dd');
    value.textContent = state.schemaVersion;
    defItem.appendChild(label);
    defItem.appendChild(value);
    defList.appendChild(defItem);
  }
  
  if (state.backendAppVersion) {
    const defItem = document.createElement('div');
    defItem.className = 'ft-def-item';
    const label = document.createElement('dt');
    label.textContent = 'Backend app version';
    const value = document.createElement('dd');
    value.textContent = state.backendAppVersion;
    defItem.appendChild(label);
    defItem.appendChild(value);
    defList.appendChild(defItem);
  }
  
  content.appendChild(defList);
  
  // Right: Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'ft-status-actions';
  
  const exportBtn = document.createElement('button');
  exportBtn.className = 'ft-btn ft-btn-primary';
  exportBtn.textContent = 'Export Evidence';
  exportBtn.disabled = state.status !== 'AVAILABLE';
  exportBtn.onclick = () => {
    const payload = JSON.stringify(state.rawPayload, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firsttry-evidence-${state.snapshotId || 'snapshot'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const diagBtn = document.createElement('button');
  diagBtn.className = 'ft-btn ft-btn-secondary';
  diagBtn.textContent = 'Copy Diagnostics';
  diagBtn.onclick = () => {
    const diagnostics = {
      ui_git_sha_short: UI_GIT_SHA_SHORT,
      ui_build_time_utc: UI_BUILD_TIME_UTC,
      backend_git_sha_short: state.backendGitShaShort,
      backend_build_time_utc: state.backendBuildTimeUtc,
      snapshot_id: state.snapshotId,
      created_at_utc: state.createdAtUtc,
      status: state.status,
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)).then(() => {
      const toast = document.createElement('div');
      toast.className = 'ft-toast ft-toast-success';
      toast.textContent = 'Diagnostics copied to clipboard';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  };
  
  const detailsBtn = document.createElement('button');
  detailsBtn.className = 'ft-btn ft-btn-secondary';
  detailsBtn.textContent = 'View Details';
  detailsBtn.disabled = !state.rawPayload;
  detailsBtn.onclick = () => {
    const modal = createDetailsModal(state.rawPayload);
    document.body.appendChild(modal);
  };
  
  actionsContainer.appendChild(exportBtn);
  actionsContainer.appendChild(diagBtn);
  actionsContainer.appendChild(detailsBtn);
  
  content.appendChild(actionsContainer);
  panel.appendChild(content);
  
  return panel;
}

/**
 * Create evidence summary cards grid
 */
export function createEvidenceSummary(snapshot: any): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'ft-evidence-grid';
  
  const cards = [
    {
      title: 'Workflows & Schemes',
      description: 'Workflow configurations and issue type schemes',
      count: snapshot?.metadata?.coverage?.workflows || 0,
    },
    {
      title: 'Permissions & Access',
      description: 'Permission schemes and role assignments',
      count: snapshot?.metadata?.coverage?.permissions || 0,
    },
    {
      title: 'Automation & Rules',
      description: 'Automation rules and system configurations',
      count: snapshot?.metadata?.coverage?.automation || 0,
    },
    {
      title: 'Apps & Integrations',
      description: 'Installed apps and integration settings',
      count: snapshot?.metadata?.coverage?.apps || 0,
    },
  ];
  
  for (const card of cards) {
    const cardEl = document.createElement('div');
    cardEl.className = 'ft-evidence-card';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'ft-card-title';
    titleEl.textContent = card.title;
    
    const descEl = document.createElement('p');
    descEl.className = 'ft-card-desc';
    descEl.textContent = card.description;
    
    const valueEl = document.createElement('div');
    valueEl.className = 'ft-card-value';
    if (card.count > 0) {
      valueEl.textContent = `${card.count} items`;
    } else {
      valueEl.textContent = 'Included in export';
      valueEl.className += ' ft-card-value-placeholder';
    }
    
    cardEl.appendChild(titleEl);
    cardEl.appendChild(descEl);
    cardEl.appendChild(valueEl);
    grid.appendChild(cardEl);
  }
  
  return grid;
}

/**
 * Create trust & data boundaries section
 */
export function createTrustSection(): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-trust-section';
  
  const title = document.createElement('h2');
  title.className = 'ft-trust-title';
  title.textContent = '🔒 Trust & Data Boundaries';
  
  const bullets = document.createElement('ul');
  bullets.className = 'ft-trust-bullets';
  
  const bulletPoints = [
    'No write scopes. No Jira mutations.',
    'Evidence is read-only snapshot data.',
    'PII: Only minimal identifiers required by Jira APIs are collected and returned.',
    'If data is missing: Export still contains what is available.',
  ];
  
  for (const point of bulletPoints) {
    const li = document.createElement('li');
    li.textContent = point;
    bullets.appendChild(li);
  }
  
  section.appendChild(title);
  section.appendChild(bullets);
  
  return section;
}

/**
 * Create details modal
 */
function createDetailsModal(payload: any): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'ft-modal-overlay';
  overlay.onclick = () => overlay.remove();
  
  const modal = document.createElement('div');
  modal.className = 'ft-modal';
  modal.onclick = (e) => e.stopPropagation();
  
  const header = document.createElement('div');
  header.className = 'ft-modal-header';
  
  const title = document.createElement('h2');
  title.textContent = 'Resolver Payload Details';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ft-btn ft-btn-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => overlay.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  const content = document.createElement('div');
  content.className = 'ft-modal-content';
  
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(payload, null, 2);
  
  content.appendChild(pre);
  
  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  
  return overlay;
}

/**
 * Main dashboard renderer
 */
export function renderEnterpriseDashboard(state: SnapshotState): HTMLElement {
  const dashboard = document.createElement('div');
  dashboard.className = 'ft-enterprise-dashboard';
  
  dashboard.appendChild(createHeader());
  dashboard.appendChild(createStatusPanel(state));
  dashboard.appendChild(createEvidenceSummary(state.rawPayload));
  dashboard.appendChild(createTrustSection());
  
  return dashboard;
}

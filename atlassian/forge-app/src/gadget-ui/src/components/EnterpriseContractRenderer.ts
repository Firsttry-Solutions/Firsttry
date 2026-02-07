/**
 * Enterprise Contract Renderer
 * 
 * Renders the Enterprise Dashboard Contract with EXACT required strings A-M.
 * This renderer uses existing data from the resolver (no new API calls).
 * All UI text must match the exact contract specifications.
 */

import { computeEvidenceAgeDays, computeFreshness, formatEvidenceAge } from '../utils/evidenceMetrics';
import { router } from '@forge/bridge';

/**
 * Support URL for FirstTry (HTTPS only for sandbox compatibility)
 */
const SUPPORT_URL = 'https://firsttry.run/support';

/**
 * Helper: Escape HTML entities
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Helper: Format ISO timestamp to "YYYY-MM-DD HH:MM:SS UTC" format
 */
function formatTimestampUTC(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Helper: Map origin code to human-readable contract string
 */
function getOriginText(origin: string, triggerReason?: string): string {
  switch (origin) {
    case 'ON_DEMAND':
      return 'Created manually by user';
    case 'SCHEDULED':
      return 'Created automatically on schedule';
    case 'TRIGGERED':
      return 'Created automatically due to detected change';
    default:
      // Fallback to manual if unknown
      return 'Created manually by user';
  }
}

/**
 * Helper: Get snapshot type label
 */
function getSnapshotTypeLabel(snapshotKind: string): string {
  if (snapshotKind === 'SEED') {
    return 'Snapshot type: Seed Snapshot';
  } else if (snapshotKind === 'GOVERNANCE') {
    return 'Snapshot type: Governance Snapshot';
  }
  // Fallback
  return 'Snapshot type: Seed Snapshot';
}

/**
 * Helper: Create a contract item (label + value)
 */
function createContractItem(label: string, value: string, testId?: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'ft-contract-item';
  if (testId) {
    item.setAttribute('data-testid', testId);
  }
  
  const labelSpan = document.createElement('span');
  labelSpan.className = 'ft-contract-label';
  labelSpan.textContent = label + ': ';
  
  const valueSpan = document.createElement('span');
  valueSpan.className = 'ft-contract-value';
  valueSpan.textContent = value;
  
  item.appendChild(labelSpan);
  item.appendChild(valueSpan);
  
  return item;
}

/**
 * Helper: Create a scope section (included/excluded)
 */
function createScopeSection(heading: string, items: string[], testId?: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-contract-scope-section';
  if (testId) {
    section.setAttribute('data-testid', testId);
  }
  
  const headingEl = document.createElement('div');
  headingEl.className = 'ft-contract-scope-heading';
  headingEl.textContent = heading;
  section.appendChild(headingEl);
  
  const list = document.createElement('ul');
  list.className = 'ft-contract-scope-list';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  section.appendChild(list);
  
  return section;
}

/**
 * Helper: Create card container
 */
function createCard(className: string, title?: string): { card: HTMLElement; body: HTMLElement } {
  const card = document.createElement('div');
  card.className = `ft-card ${className}`;
  
  if (title) {
    const header = document.createElement('div');
    header.className = 'ft-card-header';
    const heading = document.createElement('h3');
    heading.textContent = title;
    header.appendChild(heading);
    card.appendChild(header);
  }
  
  const body = document.createElement('div');
  body.className = 'ft-card-body';
  card.appendChild(body);
  
  return { card, body };
}

/**
 * Render Evidence Summary Card (TOP CARD - Above the fold)
 * This provides a quick overview of the current snapshot
 */
export function renderEvidenceSummaryCard(data: any, currentSnapshot: any): HTMLElement {
  const { card, body } = createCard('ft-evidence-summary', 'Evidence Summary');
  card.setAttribute('data-testid', 'ft-evidence-summary-root');
  
  // ENTERPRISE LAYOUT: Minimize top gap to ensure above-fold visibility (y < 250px)
  // All styling via CSS only (CSP compliance - no inline styles)
  card.classList.add('ft-card-evidence');
  
  // Enterprise-grade validation: Check for required snapshot fields
  if (!currentSnapshot || !currentSnapshot.createdAtUtc || !currentSnapshot.snapshotKind || !currentSnapshot.integrity) {
    // Render error banner for missing/invalid snapshot data
    const errorBanner = document.createElement('div');
    errorBanner.className = 'ft-error-banner';
    errorBanner.setAttribute('data-testid', 'ft-snapshot-error-banner');
    
    const errorTitle = document.createElement('div');
    errorTitle.className = 'ft-error-title';
    errorTitle.textContent = 'Snapshot data unavailable';
    errorBanner.appendChild(errorTitle);
    
    const errorMsg = document.createElement('div');
    errorMsg.textContent = 'Snapshot data unavailable. Please refresh or contact support.';
    errorBanner.appendChild(errorMsg);
    
    const statusMsg = document.createElement('div');
    statusMsg.className = 'ft-status-msg';
    statusMsg.textContent = 'Status: FAILED';
    errorBanner.appendChild(statusMsg);
    
    body.appendChild(errorBanner);
    return card;
  }
  
  // Snapshot type (human readable)
  const snapshotType = currentSnapshot.snapshotKind === 'SEED' ? 'Seed Snapshot' : 'Governance Snapshot';
  const typeItem = createContractItem('Snapshot type', snapshotType, 'ft-summary-snapshot-type');
  body.appendChild(typeItem);
  
  // Origin (human readable)
  const originText = getOriginText(currentSnapshot.origin, currentSnapshot.triggerReason);
  const originItem = createContractItem('Origin', originText, 'ft-summary-origin');
  body.appendChild(originItem);
  
  // Created (UTC formatted)
  const createdTimestamp = formatTimestampUTC(currentSnapshot.createdAtUtc);
  const createdItem = createContractItem('Created', createdTimestamp, 'ft-summary-created');
  body.appendChild(createdItem);
  
  // Evidence age (computed from created timestamp)
  const evidenceAgeDays = computeEvidenceAgeDays(currentSnapshot.createdAtUtc);
  
  // Freshness (derived from age)
  const freshnessStatus = computeFreshness(evidenceAgeDays);
  
  const freshnessItem = createContractItem('Freshness', freshnessStatus, 'ft-summary-freshness');
  body.appendChild(freshnessItem);
  
  const ageItem = createContractItem('Evidence age', formatEvidenceAge(evidenceAgeDays), 'ft-summary-evidence-age');
  body.appendChild(ageItem);
  
  // Export eligibility
  let exportText = '';
  if (currentSnapshot.exportEligible) {
    exportText = 'Enabled (governance snapshots can be exported)';
  } else {
    exportText = 'Disabled (seed snapshots cannot be exported)';
  }
  const exportItem = createContractItem('Export', exportText, 'ft-summary-export');
  body.appendChild(exportItem);
  
  // Integrity hash (show full hash)
  const integrityHash = currentSnapshot.integrity?.value || '';
  if (integrityHash) {
    const hashItem = document.createElement('div');
    hashItem.className = 'ft-contract-item';
    hashItem.setAttribute('data-testid', 'ft-summary-integrity-hash');
    
    const label = document.createElement('span');
    label.className = 'ft-contract-label';
    label.textContent = 'Integrity hash (SHA-256): ';
    hashItem.appendChild(label);
    
    const value = document.createElement('span');
    value.className = 'ft-contract-value ft-hash-monospace ft-value-mono';
    value.textContent = integrityHash;
    hashItem.appendChild(value);
    
    body.appendChild(hashItem);
  }
  
  return card;
}

/**
 * Helper: Create copy button with clipboard functionality
 */
function createCopyButton(text: string, testId: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ft-button';
  button.setAttribute('data-testid', testId);
  button.setAttribute('aria-label', `Copy ${testId.replace('ft-copy-', '')}`);
  button.textContent = 'Copy';
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers (CSP-compliant: use CSS class instead of inline styles)
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.className = 'ft-clipboard-textarea';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      
      // Visual feedback
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 1200);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });
  
  return button;
}

/**
 * Helper: Create support button container with sandbox-safe router.open
 */
function createSupportButton(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ft-support-container';
  
  const button = document.createElement('button');
  button.className = 'ft-button';
  button.setAttribute('data-testid', 'ft-support-button');
  button.setAttribute('aria-label', 'Get support');
  button.textContent = 'Get support';
  
  let fallbackShown = false;
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Log attempt marker for E2E verification
    console.log('FT_SUPPORT_OPEN_ATTEMPT', SUPPORT_URL);
    
    try {
      await router.open(SUPPORT_URL);
      // Success - router.open worked
    } catch (err) {
      // Fallback: show URL and copy button
      if (!fallbackShown) {
        fallbackShown = true;
        
        const fallbackMsg = document.createElement('div');
        fallbackMsg.className = 'ft-fallback-msg';
        fallbackMsg.textContent = 'Support link could not be opened. Copy the URL below:';
        container.appendChild(fallbackMsg);
        
        const urlDiv = document.createElement('div');
        urlDiv.setAttribute('data-testid', 'ft-support-url');
        urlDiv.className = 'ft-url-display';
        urlDiv.textContent = SUPPORT_URL;
        container.appendChild(urlDiv);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ft-button ft-copy-btn';
        copyBtn.setAttribute('data-testid', 'ft-support-copy');
        copyBtn.setAttribute('aria-label', 'Copy support URL');
        copyBtn.textContent = 'Copy support URL';
        
        copyBtn.addEventListener('click', async (copyE) => {
          copyE.preventDefault();
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(SUPPORT_URL);
            } else {
              // Fallback for older browsers (CSP-compliant: use CSS class instead of inline styles)
              const textarea = document.createElement('textarea');
              textarea.value = SUPPORT_URL;
              textarea.className = 'ft-clipboard-textarea';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            }
            
            // Visual feedback
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = originalText;
            }, 1200);
          } catch (copyErr) {
            console.error('Copy failed:', copyErr);
          }
        });
        
        container.appendChild(copyBtn);
      }
    }
  });
  
  container.appendChild(button);
  return container;
}

/**
 * Render the Enterprise Contract section
 * 
 * This renders contract items A-L (Snapshot History is rendered separately)
 */
export function renderEnterpriseContractSection(data: any, currentSnapshot: any): HTMLElement {
  // ROOT SHELL
  const shell = document.createElement('div');
  shell.className = 'ft-shell';
  shell.setAttribute('data-testid', 'ft-enterprise-shell');
  
  // === HEADER BAR (COMPACT) ===
  const header = document.createElement('div');
  header.className = 'ft-header';
  header.setAttribute('data-testid', 'ft-enterprise-header');
  
  // Title
  const title = document.createElement('h2');
  title.setAttribute('data-testid', 'ft-title');
  title.textContent = 'FirstTry — Jira Governance Evidence';
  header.appendChild(title);
  title.textContent = 'FirstTry — Jira Governance Evidence';
  header.appendChild(title);
  
  // Badges row
  const badges = document.createElement('div');
  badges.className = 'ft-badges';
  badges.setAttribute('data-testid', 'ft-badges');
  
  // Snapshot kind badge
  const snapshotKindBadge = document.createElement('span');
  snapshotKindBadge.className = 'ft-badge';
  snapshotKindBadge.setAttribute('data-testid', 'ft-badge-snapshot-kind');
  snapshotKindBadge.textContent = currentSnapshot.snapshotKind === 'SEED' ? 'Seed' : 'Governance';
  badges.appendChild(snapshotKindBadge);
  
  // Freshness badge
  const evidenceAgeDays = computeEvidenceAgeDays(currentSnapshot.createdAtUtc);
  const freshnessStatus = computeFreshness(evidenceAgeDays);
  const freshnessBadge = document.createElement('span');
  freshnessBadge.className = 'ft-badge';
  freshnessBadge.setAttribute('data-testid', 'ft-badge-freshness');
  freshnessBadge.textContent = freshnessStatus;
  // Add data-status for CSS styling
  if (freshnessStatus.toLowerCase().includes('out of date')) {
    freshnessBadge.setAttribute('data-status', 'out-of-date');
  } else if (freshnessStatus.toLowerCase().includes('unknown')) {
    freshnessBadge.setAttribute('data-status', 'unknown');
  }
  badges.appendChild(freshnessBadge);
  
  // Export badge
  const exportBadge = document.createElement('span');
  exportBadge.className = 'ft-badge';
  exportBadge.setAttribute('data-testid', 'ft-badge-export');
  if (currentSnapshot.exportEligible) {
    exportBadge.textContent = 'Export: Enabled';
    exportBadge.setAttribute('data-status', 'enabled');
  } else {
    exportBadge.textContent = 'Export: Disabled';
    exportBadge.setAttribute('data-status', 'disabled');
  }
  badges.appendChild(exportBadge);
  
  header.appendChild(badges);
  
  // Read-only guarantee
  const readonly = document.createElement('div');
  readonly.className = 'ft-readonly';
  readonly.setAttribute('data-testid', 'ft-readonly');
  readonly.textContent = data.readOnlyGuarantee || 'FirstTry is a read-only system. It does not modify Jira data, settings, or configurations.';
  header.appendChild(readonly);
  
  // Support button (sandbox-safe)
  const supportBtn = createSupportButton();
  header.appendChild(supportBtn);
  
  // Snapshot selector (static display for current snapshot - explicitly read-only)
  // All styling via CSS only (no inline styles per CSP requirement)
  const snapshotSelector = document.createElement('div');
  snapshotSelector.className = 'ft-snapshot-selector';
  snapshotSelector.setAttribute('data-testid', 'ft-snapshot-selector');
  snapshotSelector.textContent = 'View snapshot: Latest (read-only)';
  header.appendChild(snapshotSelector);
  
  shell.appendChild(header);
  
  // === CARD GRID ===
  const grid = document.createElement('div');
  grid.className = 'ft-grid';
  
  // CARD 1: EVIDENCE SUMMARY (spans full width)
  const evidenceCard = document.createElement('div');
  evidenceCard.className = 'ft-card';
  evidenceCard.setAttribute('data-testid', 'ft-card-evidence-summary');
  
  const evidenceTitle = document.createElement('h3');
  evidenceTitle.className = 'ft-card-title';
  evidenceTitle.setAttribute('data-testid', 'ft-card-title-evidence-summary');
  evidenceTitle.textContent = 'Evidence Summary';
  evidenceCard.appendChild(evidenceTitle);
  
  // Key-value rows
  const kvRows = [
    { key: 'Snapshot type', value: currentSnapshot.snapshotKind === 'SEED' ? 'Seed Snapshot' : 'Governance Snapshot', testId: 'ft-snapshot-type' },
    { key: 'Origin', value: getOriginText(currentSnapshot.origin, currentSnapshot.triggerReason), testId: 'ft-snapshot-origin' },
    { key: 'Created (UTC)', value: formatTimestampUTC(currentSnapshot.createdAtUtc), testId: 'ft-snapshot-created' },
    { key: 'Freshness', value: freshnessStatus, testId: 'ft-snapshot-freshness' },
    { key: 'Evidence age', value: formatEvidenceAge(evidenceAgeDays), testId: 'ft-evidence-age' },
    { key: 'Export status', value: currentSnapshot.exportEligible ? 'Enabled' : 'Disabled', testId: 'ft-export-eligibility' }
  ];
  
  kvRows.forEach(row => {
    const kvDiv = document.createElement('div');
    kvDiv.className = 'ft-kv';
    if (row.testId) {
      kvDiv.setAttribute('data-testid', row.testId);
    }
    
    const keySpan = document.createElement('span');
    keySpan.className = 'ft-kv-key';
    keySpan.textContent = row.key;
    kvDiv.appendChild(keySpan);
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'ft-kv-value';
    valueSpan.textContent = row.value;
    kvDiv.appendChild(valueSpan);
    
    evidenceCard.appendChild(kvDiv);
  });
  
  // Export hint (if disabled, provide guidance)
  if (!currentSnapshot.exportEligible) {
    const exportHint = document.createElement('div');
    exportHint.className = 'ft-hint';
    exportHint.setAttribute('data-testid', 'ft-export-hint');
    exportHint.textContent = 'Export is disabled for Seed snapshots. Create a Governance Snapshot to enable exportable evidence.';
    evidenceCard.appendChild(exportHint);
  }
  
  // Integrity hash (special treatment: monospace + copy button)
  const integrityHash = currentSnapshot.integrity?.value || '';
  if (integrityHash) {
    const hashKv = document.createElement('div');
    hashKv.className = 'ft-kv ft-hash-kv';
    
    const hashKey = document.createElement('span');
    hashKey.className = 'ft-kv-key';
    hashKey.textContent = 'Integrity hash (SHA-256)';
    hashKv.appendChild(hashKey);
    
    const hashValue = document.createElement('span');
    hashValue.className = 'ft-mono';
    hashValue.setAttribute('data-testid', 'ft-integrity-hash');
    hashValue.textContent = integrityHash;
    hashKv.appendChild(hashValue);
    
    const actions = document.createElement('div');
    actions.className = 'ft-actions';
    const copyBtn = createCopyButton(integrityHash, 'ft-copy-integrity-hash');
    actions.appendChild(copyBtn);
    hashKv.appendChild(actions);
    
    evidenceCard.appendChild(hashKv);
  }
  
  grid.appendChild(evidenceCard);
  
  // CARD 2: SEED VS GOVERNANCE
  const seedGovCard = document.createElement('div');
  seedGovCard.className = 'ft-card';
  seedGovCard.setAttribute('data-testid', 'ft-card-seed-vs-governance');
  
  const seedGovTitle = document.createElement('h3');
  seedGovTitle.className = 'ft-card-title';
  seedGovTitle.textContent = data.seedVsGovernanceExplanation?.title || 'Seed vs Governance';
  seedGovCard.appendChild(seedGovTitle);
  
  if (data.seedVsGovernanceExplanation?.bullets) {
    const ul = document.createElement('ul');
    data.seedVsGovernanceExplanation.bullets.forEach((bullet: string) => {
      const li = document.createElement('li');
      li.textContent = bullet;
      ul.appendChild(li);
    });
    seedGovCard.appendChild(ul);
  }
  
  grid.appendChild(seedGovCard);
  
  // CARD 3: EVIDENCE SCOPE
  const scopeCard = document.createElement('div');
  scopeCard.className = 'ft-card';
  scopeCard.setAttribute('data-testid', 'ft-card-scope');
  
  const scopeTitle = document.createElement('h3');
  scopeTitle.className = 'ft-card-title';
  scopeTitle.textContent = 'Evidence Scope';
  scopeCard.appendChild(scopeTitle);
  
  const scopeContainer = document.createElement('div');
  scopeContainer.className = 'ft-scope-container';
  
  // Included section
  if (currentSnapshot.scope?.included) {
    const includedSection = document.createElement('div');
    includedSection.className = 'ft-scope-section';
    
    const includedHeading = document.createElement('h4');
    includedHeading.textContent = 'Included';
    includedSection.appendChild(includedHeading);
    
    const includedList = document.createElement('ul');
    includedList.setAttribute('data-testid', 'ft-scope-included');
    currentSnapshot.scope.included.forEach((item: string) => {
      const li = document.createElement('li');
      li.textContent = item;
      includedList.appendChild(li);
    });
    includedSection.appendChild(includedList);
    scopeContainer.appendChild(includedSection);
  }
  
  // Excluded section
  if (currentSnapshot.scope?.excluded) {
    const excludedSection = document.createElement('div');
    excludedSection.className = 'ft-scope-section';
    
    const excludedHeading = document.createElement('h4');
    excludedHeading.textContent = 'Excluded';
    excludedSection.appendChild(excludedHeading);
    
    const excludedList = document.createElement('ul');
    excludedList.setAttribute('data-testid', 'ft-scope-excluded');
    currentSnapshot.scope.excluded.forEach((item: string) => {
      const li = document.createElement('li');
      li.textContent = item;
      excludedList.appendChild(li);
    });
    excludedSection.appendChild(excludedList);
    scopeContainer.appendChild(excludedSection);
  }
  
  scopeCard.appendChild(scopeContainer);
  grid.appendChild(scopeCard);
  
  // CARD 4: CONTROLS COVERED
  const controlsCard = document.createElement('div');
  controlsCard.className = 'ft-card';
  controlsCard.setAttribute('data-testid', 'ft-card-controls');
  
  const controlsTitle = document.createElement('h3');
  controlsTitle.className = 'ft-card-title';
  controlsTitle.textContent = 'Controls Covered';
  controlsCard.appendChild(controlsTitle);
  
  if (data.controlsCovered) {
    const controlsList = document.createElement('ul');
    data.controlsCovered.forEach((control: string) => {
      const li = document.createElement('li');
      li.textContent = control;
      controlsList.appendChild(li);
    });
    controlsCard.appendChild(controlsList);
  } else {
    const p = document.createElement('p');
    p.textContent = 'Configuration governance, access control review, change tracking.';
    controlsCard.appendChild(p);
  }
  
  grid.appendChild(controlsCard);
  
  // CARD 5: NEXT STEP (contextual - only show if no governance snapshots)
  if (data.evidenceFreshness?.status === 'NO_GOVERNANCE') {
    const nextStepCard = document.createElement('div');
    nextStepCard.className = 'ft-card';
    nextStepCard.setAttribute('data-testid', 'ft-card-next-step');
    
    const nextStepTitle = document.createElement('h3');
    nextStepTitle.className = 'ft-card-title';
    nextStepTitle.textContent = 'Next Step';
    nextStepCard.appendChild(nextStepTitle);
    
    const nextStepText = document.createElement('p');
    nextStepText.textContent = 'Create a governance snapshot to generate immutable audit evidence.';
    nextStepCard.appendChild(nextStepText);
    
    grid.appendChild(nextStepCard);
  }
  
  shell.appendChild(grid);
  
  return shell;
}

/**
 * Render the Snapshot History list (Contract item M)
 */
export function renderSnapshotHistoryList(snapshots: any[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ft-snapshot-history';
  container.setAttribute('data-testid', 'ft-snapshot-history');
  
  const heading = document.createElement('h3');
  heading.textContent = 'Snapshot History:';
  container.appendChild(heading);
  
  if (!snapshots || snapshots.length === 0) {
    const noSnapshots = document.createElement('p');
    noSnapshots.textContent = 'No snapshots available.';
    container.appendChild(noSnapshots);
    return container;
  }
  
  snapshots.forEach((snapshot, index) => {
    const entry = document.createElement('div');
    entry.className = 'ft-snapshot-history-entry';
    entry.setAttribute('data-snapshot-id', snapshot.snapshotId);
    
    const typeLabel = snapshot.snapshotKind === 'SEED' ? 'Seed Snapshot' : 'Governance Snapshot';
    const createdTimestamp = formatTimestampUTC(snapshot.createdAtUtc);
    const originText = getOriginText(snapshot.origin, snapshot.triggerReason);
    
    const entryText = `${index + 1}. Type: ${typeLabel} | Created: ${createdTimestamp} | Origin: ${originText}`;
    entry.textContent = entryText;
    
    container.appendChild(entry);
  });
  
  return container;
}

/**
 * Render Definitions & Guidance section (read-only context)
 * This provides additional audit context without adding new features
 */
export function renderDefinitionsGuidance(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ft-definitions-guidance ft-legend-container';
  
  const heading = document.createElement('h3');
  heading.textContent = 'Definitions & Guidance';
  heading.className = 'ft-legend-heading';
  container.appendChild(heading);
  
  const list = document.createElement('ul');
  list.className = 'ft-legend-list';
  
  const listItems = [
    'Governance snapshots appear after evidence is collected by the scheduled backend process. Seed snapshots are provided at installation for testing.',
    'Export eligibility indicates whether a snapshot meets the quality and completeness requirements for external audit or compliance reporting.',
    'Evidence scope excludes individual issues and personally identifiable information (PII) to ensure privacy and focus on configuration governance.'
  ];
  
  listItems.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
  
  container.appendChild(list);
  
  return container;
}

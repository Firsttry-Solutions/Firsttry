/**
 * Enterprise Contract Renderer
 * 
 * Renders the Enterprise Dashboard Contract with EXACT required strings A-M.
 * This renderer uses existing data from the resolver (no new API calls).
 * All UI text must match the exact contract specifications.
 */

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
  card.style.marginTop = '8px';  // Minimal top margin for enterprise-grade layout
  card.style.marginBottom = '16px';
  
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
  
  // Freshness + evidence age
  let freshnessStatus = 'Out of date';
  let evidenceAgeDays = 0;
  
  if (data.evidenceFreshness?.status === 'NO_GOVERNANCE') {
    freshnessStatus = 'Out of date';
    evidenceAgeDays = 0;
  } else if (data.evidenceFreshness?.status === 'CURRENT') {
    freshnessStatus = 'Current';
    if (data.evidenceFreshness.ageSeconds !== null && data.evidenceFreshness.ageSeconds !== undefined) {
      evidenceAgeDays = Math.floor(data.evidenceFreshness.ageSeconds / 86400);
    }
  } else if (data.evidenceFreshness?.status === 'STALE') {
    freshnessStatus = 'Out of date';
    if (data.evidenceFreshness.ageSeconds !== null && data.evidenceFreshness.ageSeconds !== undefined) {
      evidenceAgeDays = Math.floor(data.evidenceFreshness.ageSeconds / 86400);
    }
  }
  
  const freshnessItem = createContractItem('Freshness', freshnessStatus, 'ft-summary-freshness');
  body.appendChild(freshnessItem);
  
  const ageItem = createContractItem('Evidence age', `${evidenceAgeDays} days`, 'ft-summary-evidence-age');
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
    value.className = 'ft-contract-value ft-hash-monospace';
    value.textContent = integrityHash;
    value.style.wordBreak = 'break-all';
    value.style.fontFamily = 'monospace';
    value.style.fontSize = '0.85em';
    hashItem.appendChild(value);
    
    body.appendChild(hashItem);
  }
  
  return card;
}

/**
 * Render the Enterprise Contract section
 * 
 * This renders contract items A-L (Snapshot History is rendered separately)
 */
export function renderEnterpriseContractSection(data: any, currentSnapshot: any): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ft-enterprise-contract';
  container.setAttribute('data-testid', 'ft-enterprise-contract-root');
  
  const heading = document.createElement('h2');
  heading.className = 'ft-enterprise-contract-heading';
  heading.textContent = 'FirstTry — Jira Governance Evidence';
  container.appendChild(heading);
  
  // === READ-ONLY GUARANTEE ===
  const readonlySection = document.createElement('div');
  readonlySection.className = 'ft-contract-section';
  readonlySection.setAttribute('data-testid', 'ft-readonly-statement');
  
  const readonlyHeading = document.createElement('h3');
  readonlyHeading.textContent = 'Read-Only Guarantee';
  readonlySection.appendChild(readonlyHeading);
  
  const readonlyText = document.createElement('p');
  readonlyText.textContent = data.readOnlyGuarantee || 'FirstTry is a read-only system. It does not modify Jira data, settings, or configurations.';
  readonlySection.appendChild(readonlyText);
  
  container.appendChild(readonlySection);
  
  // === SEED VS GOVERNANCE ===
  const seedGovSection = document.createElement('div');
  seedGovSection.className = 'ft-contract-section';
  seedGovSection.setAttribute('data-testid', 'ft-seed-vs-governance');
  
  const seedGovHeading = document.createElement('h3');
  seedGovHeading.textContent = data.seedVsGovernanceExplanation?.title || 'Seed vs Governance';
  seedGovSection.appendChild(seedGovHeading);
  
  if (data.seedVsGovernanceExplanation?.bullets) {
    data.seedVsGovernanceExplanation.bullets.forEach((bullet: string) => {
      const p = document.createElement('p');
      p.textContent = bullet;
      seedGovSection.appendChild(p);
    });
  }
  
  container.appendChild(seedGovSection);
  
  // === EVIDENCE FRESHNESS ===
  const freshnessSection = document.createElement('div');
  freshnessSection.className = 'ft-contract-section';
  freshnessSection.setAttribute('data-testid', 'ft-freshness');
  
  const freshnessHeading = document.createElement('h3');
  freshnessHeading.textContent = 'Evidence Freshness';
  freshnessSection.appendChild(freshnessHeading);
  
  // Check freshness status
  if (data.evidenceFreshness?.status === 'NO_GOVERNANCE') {
    const noGovMsg = document.createElement('p');
    noGovMsg.setAttribute('data-testid', 'ft-freshness-no-governance');
    noGovMsg.textContent = 'No governance snapshots yet.';
    freshnessSection.appendChild(noGovMsg);
    
    const statusCode = document.createElement('p');
    statusCode.textContent = data.evidenceFreshness.status;
    freshnessSection.appendChild(statusCode);
  } else {
    const freshnessText = document.createElement('p');
    freshnessText.textContent = `Last Collected: ${data.evidenceFreshness?.lastCollectedUtc || 'N/A'} UTC`;
    freshnessSection.appendChild(freshnessText);
  }
  
  container.appendChild(freshnessSection);
  
  // === CONTRACT FIELDS SECTION (EXACT STRINGS) ===
  const contractFieldsSection = document.createElement('div');
  contractFieldsSection.className = 'ft-contract-fields';
  
  // A) Snapshot type
  const snapshotType = getSnapshotTypeLabel(currentSnapshot.snapshotKind);
  contractFieldsSection.appendChild(createContractItem('', snapshotType, 'ft-snapshot-type'));
  
  // B) Origin
  const originText = getOriginText(currentSnapshot.origin, currentSnapshot.triggerReason);
  contractFieldsSection.appendChild(createContractItem('Origin', originText, 'ft-snapshot-origin'));
  
  // C) Created timestamp
  const createdTimestamp = formatTimestampUTC(currentSnapshot.createdAtUtc);
  contractFieldsSection.appendChild(createContractItem('Created', createdTimestamp, 'ft-snapshot-created'));
  
  // D) Freshness status
  let freshnessStatus = 'Out of date';
  let evidenceAgeDays = 0;
  
  if (data.evidenceFreshness?.status === 'NO_GOVERNANCE') {
    freshnessStatus = 'Out of date';
    evidenceAgeDays = 0;
  } else if (data.evidenceFreshness?.status === 'CURRENT') {
    freshnessStatus = 'Current';
    if (data.evidenceFreshness.ageSeconds !== null && data.evidenceFreshness.ageSeconds !== undefined) {
      evidenceAgeDays = Math.floor(data.evidenceFreshness.ageSeconds / 86400);
    }
  } else if (data.evidenceFreshness?.status === 'STALE') {
    freshnessStatus = 'Out of date';
    if (data.evidenceFreshness.ageSeconds !== null && data.evidenceFreshness.ageSeconds !== undefined) {
      evidenceAgeDays = Math.floor(data.evidenceFreshness.ageSeconds / 86400);
    }
  }
  
  contractFieldsSection.appendChild(createContractItem('Freshness', freshnessStatus, 'ft-snapshot-freshness'));
  contractFieldsSection.appendChild(createContractItem('Evidence age', `${evidenceAgeDays} days`, 'ft-evidence-age'));
  
  // E) Immutability statement (EXACT)
  const immutabilityExact = 'This snapshot is immutable and cannot be modified after creation.';
  const immutabilityEl = document.createElement('p');
  immutabilityEl.className = 'ft-contract-immutability';
  immutabilityEl.setAttribute('data-testid', 'ft-immutability-statement');
  immutabilityEl.textContent = immutabilityExact;
  contractFieldsSection.appendChild(immutabilityEl);
  
  // F) Integrity hash (SHA-256) - monospace with safe wrapping
  const integrityHash = currentSnapshot.integrity?.value || '';
  if (integrityHash) {
    const hashItem = document.createElement('div');
    hashItem.className = 'ft-contract-item';
    hashItem.setAttribute('data-testid', 'ft-integrity-hash');
    
    const label = document.createElement('span');
    label.className = 'ft-contract-label';
    label.textContent = 'Integrity hash (SHA-256): ';
    hashItem.appendChild(label);
    
    const value = document.createElement('span');
    value.className = 'ft-contract-value ft-hash-monospace';
    value.textContent = integrityHash;
    value.style.fontFamily = 'monospace';
    value.style.fontSize = '0.85em';
    value.style.wordBreak = 'break-all';
    value.style.overflowWrap = 'break-word';
    hashItem.appendChild(value);
    
    contractFieldsSection.appendChild(hashItem);
  }
  
  // G) Included evidence scope
  if (currentSnapshot.scope?.included) {
    contractFieldsSection.appendChild(createScopeSection('Included evidence scope:', currentSnapshot.scope.included, 'ft-included-scope'));
  }
  
  // H) Excluded evidence scope
  if (currentSnapshot.scope?.excluded) {
    contractFieldsSection.appendChild(createScopeSection('Excluded evidence scope:', currentSnapshot.scope.excluded, 'ft-excluded-scope'));
  }
  
  // I) Export eligibility
  let exportText = '';
  if (currentSnapshot.exportEligible) {
    exportText = 'Export: Enabled (governance snapshots can be exported)';
  } else {
    exportText = 'Export: Disabled (seed snapshots cannot be exported)';
  }
  const exportEl = document.createElement('p');
  exportEl.className = 'ft-contract-export';
  exportEl.setAttribute('data-testid', 'ft-export-eligibility');
  exportEl.textContent = exportText;
  contractFieldsSection.appendChild(exportEl);
  
  // J) Data source (EXACT)
  const dataSourceExact = 'Data source: Live data from your Jira environment.';
  const dataSourceEl = document.createElement('p');
  dataSourceEl.className = 'ft-contract-data-source';
  dataSourceEl.setAttribute('data-testid', 'ft-data-source');
  dataSourceEl.textContent = dataSourceExact;
  contractFieldsSection.appendChild(dataSourceEl);
  
  // K) Audit context (EXACT)
  const auditContextSection = document.createElement('div');
  auditContextSection.className = 'ft-contract-audit-context';
  auditContextSection.setAttribute('data-testid', 'ft-audit-context');
  
  const auditHeading = document.createElement('h4');
  auditHeading.textContent = 'Audit context:';
  auditContextSection.appendChild(auditHeading);
  
  const auditBodyExact = 'This evidence supports configuration governance, access control review, and change tracking audit questions. It does not certify compliance.';
  const auditBody = document.createElement('p');
  auditBody.textContent = auditBodyExact;
  auditContextSection.appendChild(auditBody);
  
  contractFieldsSection.appendChild(auditContextSection);
  
  // L) Seed vs governance snapshots (EXACT)
  const seedVsGovContractSection = document.createElement('div');
  seedVsGovContractSection.className = 'ft-contract-seed-vs-gov';
  seedVsGovContractSection.setAttribute('data-testid', 'ft-seed-vs-governance-contract');
  
  const seedVsGovContractHeading = document.createElement('h4');
  seedVsGovContractHeading.textContent = 'Seed vs governance snapshots:';
  seedVsGovContractSection.appendChild(seedVsGovContractHeading);
  
  const seedVsGovBodyExact = 'Seed snapshots are baseline system snapshots and are not exportable. Governance snapshots are created for audit evidence and can be exported.';
  const seedVsGovBody = document.createElement('p');
  seedVsGovBody.textContent = seedVsGovBodyExact;
  seedVsGovContractSection.appendChild(seedVsGovBody);
  
  contractFieldsSection.appendChild(seedVsGovContractSection);
  
  container.appendChild(contractFieldsSection);
  
  return container;
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
  container.className = 'ft-definitions-guidance';
  container.style.marginTop = '32px';
  container.style.padding = '16px';
  container.style.backgroundColor = '#f4f5f7';
  container.style.borderRadius = '4px';
  
  const heading = document.createElement('h3');
  heading.textContent = 'Definitions & Guidance';
  heading.style.marginBottom = '12px';
  heading.style.fontSize = '14px';
  heading.style.fontWeight = '600';
  container.appendChild(heading);
  
  const list = document.createElement('ul');
  list.style.margin = '0';
  list.style.paddingLeft = '20px';
  list.style.fontSize = '13px';
  list.style.lineHeight = '1.6';
  
  const listItems = [
    'Governance snapshots appear after evidence is collected by the scheduled backend process. Seed snapshots are provided at installation for testing.',
    'Export eligibility indicates whether a snapshot meets the quality and completeness requirements for external audit or compliance reporting.',
    'Evidence scope excludes individual issues and personally identifiable information (PII) to ensure privacy and focus on configuration governance.'
  ];
  
  listItems.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    li.style.marginBottom = '8px';
    list.appendChild(li);
  });
  
  container.appendChild(list);
  
  return container;
}

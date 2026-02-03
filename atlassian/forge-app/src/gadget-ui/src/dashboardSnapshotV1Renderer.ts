/**
 * DashboardSnapshotV1 Renderer - Enterprise Dashboard UI
 *
 * Renders the DashboardSnapshotV1 contract into 5 required sections:
 * 1. Evidence Snapshot (build identifiers, timestamps)
 * 2. Read-Only Proof (scope guarantees)
 * 3. Integrity (determinism proof)
 * 4. Health & Diagnostics (backend status, errors)
 * 5. Actions (export, refresh, etc.)
 *
 * Single contract → single invocation → deterministic rendering
 */

import type { DashboardSnapshotV1, HealthStatus } from '../shared/DashboardSnapshotV1';

/**
 * Create header section with title and badges
 */
export function createDashboardHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'ft-dashboard-header';

  const titleContainer = document.createElement('div');
  titleContainer.className = 'ft-dashboard-header-title';

  const title = document.createElement('h1');
  title.textContent = 'Dashboard — Enterprise Snapshot';
  title.className = 'ft-dashboard-title';

  const subtitle = document.createElement('p');
  subtitle.textContent =
    'Read-only snapshot of app build identity and system health.';
  subtitle.className = 'ft-dashboard-subtitle';

  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);

  const badgeContainer = document.createElement('div');
  badgeContainer.className = 'ft-dashboard-badges';

  const readOnlyBadge = document.createElement('span');
  readOnlyBadge.className = 'ft-badge ft-badge-readonly';
  readOnlyBadge.textContent = 'READ-ONLY';
  badgeContainer.appendChild(readOnlyBadge);

  const enterpriseBadge = document.createElement('span');
  enterpriseBadge.className = 'ft-badge ft-badge-enterprise';
  enterpriseBadge.textContent = 'ENTERPRISE';
  badgeContainer.appendChild(enterpriseBadge);

  header.appendChild(titleContainer);
  header.appendChild(badgeContainer);

  return header;
}

/**
 * Create status badge based on health status
 */
function createStatusBadge(status: HealthStatus): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `ft-status-badge ft-status-${status.toLowerCase()}`;
  badge.textContent = status;
  return badge;
}

/**
 * Section 1: Evidence Snapshot
 * Displays build identifiers and timestamps
 */
export function createEvidenceSection(
  contract: DashboardSnapshotV1
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-section ft-section-evidence';

  const heading = document.createElement('h2');
  heading.className = 'ft-section-heading';
  heading.textContent = '📋 Evidence Snapshot';

  section.appendChild(heading);

  const content = document.createElement('div');
  content.className = 'ft-section-content';

  const evidence = contract.evidence;

  // Build identifier card
  const buildCard = document.createElement('div');
  buildCard.className = 'ft-info-card';

  const buildTitle = document.createElement('h3');
  buildTitle.className = 'ft-card-title';
  buildTitle.textContent = 'Build Identifier';

  const buildList = document.createElement('dl');
  buildList.className = 'ft-def-list';

  const entries = [
    ['Git SHA', evidence.buildIdentifier.gitSha],
    ['Git SHA (short)', evidence.buildIdentifier.gitShaShort],
    ['Build Time (UTC)', evidence.buildIdentifier.buildTimeUtc],
    ['App Version', evidence.buildIdentifier.appVersion],
  ];

  for (const [label, value] of entries) {
    const term = document.createElement('dt');
    term.textContent = label;
    const def = document.createElement('dd');
    def.textContent = value;
    buildList.appendChild(term);
    buildList.appendChild(def);
  }

  buildCard.appendChild(buildTitle);
  buildCard.appendChild(buildList);
  content.appendChild(buildCard);

  // UI bundle identity card
  const uiCard = document.createElement('div');
  uiCard.className = 'ft-info-card';

  const uiTitle = document.createElement('h3');
  uiTitle.className = 'ft-card-title';
  uiTitle.textContent = 'UI Bundle Identity';

  const uiList = document.createElement('dl');
  uiList.className = 'ft-def-list';

  const uiEntries = [
    ['Git SHA', contract.evidence.uiBundleIdentity.gitSha],
    ['Git SHA (short)', contract.evidence.uiBundleIdentity.gitShaShort],
    ['Build Time (UTC)', contract.evidence.uiBundleIdentity.buildTimeUtc],
  ];

  for (const [label, value] of uiEntries) {
    const term = document.createElement('dt');
    term.textContent = label;
    const def = document.createElement('dd');
    def.textContent = value;
    uiList.appendChild(term);
    uiList.appendChild(def);
  }

  uiCard.appendChild(uiTitle);
  uiCard.appendChild(uiList);
  content.appendChild(uiCard);

  // Timestamp card
  const timeCard = document.createElement('div');
  timeCard.className = 'ft-info-card';

  const timeTitle = document.createElement('h3');
  timeTitle.className = 'ft-card-title';
  timeTitle.textContent = 'Capture Metadata';

  const timeList = document.createElement('dl');
  timeList.className = 'ft-def-list';

  const timeEntries = [
    [
      'Captured At (UTC)',
      new Date(contract.evidence.capturedAtUtc).toISOString(),
    ],
    ['Schema Version', contract.evidence.schemaVersion],
  ];

  for (const [label, value] of timeEntries) {
    const term = document.createElement('dt');
    term.textContent = label;
    const def = document.createElement('dd');
    def.textContent = value;
    timeList.appendChild(term);
    timeList.appendChild(def);
  }

  timeCard.appendChild(timeTitle);
  timeCard.appendChild(timeList);
  content.appendChild(timeCard);

  section.appendChild(content);
  return section;
}

/**
 * Section 2: Read-Only Proof
 * Guarantees no mutations
 */
export function createReadOnlySection(
  contract: DashboardSnapshotV1
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-section ft-section-readonly';

  const heading = document.createElement('h2');
  heading.className = 'ft-section-heading';
  heading.textContent = '🔒 Read-Only Proof';

  section.appendChild(heading);

  const content = document.createElement('div');
  content.className = 'ft-section-content';

  const ro = contract.readOnly;

  // Guarantee banner
  const guaranteeBanner = document.createElement('div');
  guaranteeBanner.className = `ft-guarantee-banner ${
    ro.guaranteed ? 'ft-guarantee-pass' : 'ft-guarantee-fail'
  }`;

  const guaranteeText = document.createElement('p');
  guaranteeText.textContent = ro.guaranteed
    ? '✓ Read-only guarantee is ENFORCED'
    : '✗ Read-only guarantee FAILED';
  guaranteeText.className = 'ft-guarantee-text';

  guaranteeBanner.appendChild(guaranteeText);
  content.appendChild(guaranteeBanner);

  // Reason
  const reasonCard = document.createElement('div');
  reasonCard.className = 'ft-info-card';

  const reasonLabel = document.createElement('p');
  reasonLabel.className = 'ft-card-label';
  reasonLabel.textContent = 'Reason:';

  const reasonValue = document.createElement('p');
  reasonValue.className = 'ft-card-value';
  reasonValue.textContent = ro.reason;

  reasonCard.appendChild(reasonLabel);
  reasonCard.appendChild(reasonValue);
  content.appendChild(reasonCard);

  // Scope table
  const scopeCard = document.createElement('div');
  scopeCard.className = 'ft-info-card';

  const scopeTitle = document.createElement('h3');
  scopeTitle.className = 'ft-card-title';
  scopeTitle.textContent = 'Scope Limitations';

  const scopeTable = document.createElement('table');
  scopeTable.className = 'ft-scope-table';

  const headerRow = document.createElement('tr');
  const headerCap = document.createElement('th');
  headerCap.textContent = 'Capability';
  const headerAllow = document.createElement('th');
  headerAllow.textContent = 'Allowed';

  headerRow.appendChild(headerCap);
  headerRow.appendChild(headerAllow);
  scopeTable.appendChild(headerRow);

  const scopeRows = [
    ['Read from Jira', ro.scope.canRead ? '✓ Yes' : '✗ No'],
    ['Write to Jira', ro.scope.canWrite ? '✓ Yes' : '✗ No'],
    ['Execute JQL queries', ro.scope.canExecuteJql ? '✓ Yes' : '✗ No'],
    ['Call external APIs', ro.scope.canCallApis ? '✓ Yes' : '✗ No'],
  ];

  for (const [capability, allowed] of scopeRows) {
    const row = document.createElement('tr');
    const capCell = document.createElement('td');
    capCell.textContent = capability;
    const allowCell = document.createElement('td');
    allowCell.textContent = allowed;
    allowCell.className = allowed.includes('✓')
      ? 'ft-scope-allowed'
      : 'ft-scope-denied';
    row.appendChild(capCell);
    row.appendChild(allowCell);
    scopeTable.appendChild(row);
  }

  scopeCard.appendChild(scopeTitle);
  scopeCard.appendChild(scopeTable);
  content.appendChild(scopeCard);

  section.appendChild(content);
  return section;
}

/**
 * Section 3: Integrity
 * Determinism and stability proof
 */
export function createIntegritySection(
  contract: DashboardSnapshotV1
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-section ft-section-integrity';

  const heading = document.createElement('h2');
  heading.className = 'ft-section-heading';
  heading.textContent = '✓ Integrity';

  section.appendChild(heading);

  const content = document.createElement('div');
  content.className = 'ft-section-content';

  const integrity = contract.integrity;

  const card = document.createElement('div');
  card.className = 'ft-info-card';

  const list = document.createElement('dl');
  list.className = 'ft-def-list';

  const entries = [
    ['Type', integrity.type],
    ['Method', integrity.method],
  ];

  if (integrity.checksum) {
    entries.push(['Checksum (SHA256)', integrity.checksum]);
  }

  if (integrity.frozenAt) {
    entries.push(['Frozen At (UTC)', integrity.frozenAt]);
  }

  for (const [label, value] of entries) {
    const term = document.createElement('dt');
    term.textContent = label;
    const def = document.createElement('dd');
    def.textContent = value;
    list.appendChild(term);
    list.appendChild(def);
  }

  card.appendChild(list);
  content.appendChild(card);

  section.appendChild(content);
  return section;
}

/**
 * Section 4: Health & Diagnostics
 * Backend status, latency, errors
 */
export function createHealthSection(
  contract: DashboardSnapshotV1
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-section ft-section-health';

  const heading = document.createElement('h2');
  heading.className = 'ft-section-heading';
  heading.textContent = '📊 Health & Diagnostics';

  section.appendChild(heading);

  const content = document.createElement('div');
  content.className = 'ft-section-content';

  const health = contract.health;

  // Status overview
  const statusCard = document.createElement('div');
  statusCard.className = 'ft-info-card ft-status-card';

  const statusLabel = document.createElement('p');
  statusLabel.className = 'ft-card-label';
  statusLabel.textContent = 'Overall Health:';

  const statusValue = document.createElement('div');
  statusValue.className = 'ft-card-value';
  statusValue.appendChild(createStatusBadge(health.status));

  statusCard.appendChild(statusLabel);
  statusCard.appendChild(statusValue);
  content.appendChild(statusCard);

  // Metrics
  const metricsCard = document.createElement('div');
  metricsCard.className = 'ft-info-card';

  const metricsTitle = document.createElement('h3');
  metricsTitle.className = 'ft-card-title';
  metricsTitle.textContent = 'Metrics';

  const metricsList = document.createElement('dl');
  metricsList.className = 'ft-def-list';

  const metrics = [
    ['Resolver Latency', `${health.resolverLatencyMs}ms`],
    [
      'Backend Available',
      health.backendAvailable ? '✓ Yes' : '✗ No',
    ],
    [
      'Storage Available',
      health.storageAvailable ? '✓ Yes' : '✗ No',
    ],
    ['UI Connected', health.uiConnected ? '✓ Yes' : '✗ No'],
  ];

  for (const [label, value] of metrics) {
    const term = document.createElement('dt');
    term.textContent = label;
    const def = document.createElement('dd');
    def.textContent = value;
    metricsList.appendChild(term);
    metricsList.appendChild(def);
  }

  metricsCard.appendChild(metricsTitle);
  metricsCard.appendChild(metricsList);
  content.appendChild(metricsCard);

  // Errors
  if (health.errors.length > 0) {
    const errorsCard = document.createElement('div');
    errorsCard.className = 'ft-info-card ft-errors-card';

    const errorsTitle = document.createElement('h3');
    errorsTitle.className = 'ft-card-title ft-errors-title';
    errorsTitle.textContent = `Errors (${health.errors.length})`;

    const errorsList = document.createElement('ul');
    errorsList.className = 'ft-errors-list';

    for (const error of health.errors) {
      const li = document.createElement('li');
      li.className = 'ft-error-item';

      const code = document.createElement('code');
      code.className = 'ft-error-code';
      code.textContent = error.code;

      const message = document.createElement('p');
      message.className = 'ft-error-message';
      message.textContent = error.message;

      const timestamp = document.createElement('small');
      timestamp.className = 'ft-error-time';
      timestamp.textContent = `at ${new Date(error.timestamp).toISOString()}`;

      li.appendChild(code);
      li.appendChild(message);
      li.appendChild(timestamp);
      errorsList.appendChild(li);
    }

    errorsCard.appendChild(errorsTitle);
    errorsCard.appendChild(errorsList);
    content.appendChild(errorsCard);
  }

  // Warnings
  if (health.warnings.length > 0) {
    const warningsCard = document.createElement('div');
    warningsCard.className = 'ft-info-card ft-warnings-card';

    const warningsTitle = document.createElement('h3');
    warningsTitle.className = 'ft-card-title ft-warnings-title';
    warningsTitle.textContent = `Warnings (${health.warnings.length})`;

    const warningsList = document.createElement('ul');
    warningsList.className = 'ft-warnings-list';

    for (const warning of health.warnings) {
      const li = document.createElement('li');
      li.className = 'ft-warning-item';

      const code = document.createElement('code');
      code.className = 'ft-warning-code';
      code.textContent = warning.code;

      const message = document.createElement('p');
      message.className = 'ft-warning-message';
      message.textContent = warning.message;

      li.appendChild(code);
      li.appendChild(message);
      warningsList.appendChild(li);
    }

    warningsCard.appendChild(warningsTitle);
    warningsCard.appendChild(warningsList);
    content.appendChild(warningsCard);
  }

  section.appendChild(content);
  return section;
}

/**
 * Section 5: Actions
 * User-accessible actions (export, refresh, etc.)
 */
export function createActionsSection(
  contract: DashboardSnapshotV1
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ft-section ft-section-actions';

  const heading = document.createElement('h2');
  heading.className = 'ft-section-heading';
  heading.textContent = '⚡ Actions';

  section.appendChild(heading);

  const content = document.createElement('div');
  content.className = 'ft-section-content ft-actions-grid';

  for (const action of contract.actions) {
    const btn = document.createElement('button');
    btn.className = `ft-action-btn ft-action-${action.action.toLowerCase()}`;
    btn.disabled = action.disabled === true;
    btn.title = action.description || '';

    const label = document.createElement('span');
    label.className = 'ft-action-label';
    label.textContent = action.label;

    btn.appendChild(label);

    if (action.disabled && action.disabledReason) {
      btn.title = action.disabledReason;
    }

    // Note: actual click handlers would be attached by the UI caller
    btn.dataset.actionId = action.id;

    content.appendChild(btn);
  }

  section.appendChild(content);
  return section;
}

/**
 * Render complete dashboard from DashboardSnapshotV1 contract
 *
 * Renders all 5 sections in order:
 * 1. Evidence Snapshot
 * 2. Read-Only Proof
 * 3. Integrity
 * 4. Health & Diagnostics
 * 5. Actions
 */
export function renderDashboardSnapshot(
  contract: DashboardSnapshotV1
): HTMLElement {
  const dashboard = document.createElement('div');
  dashboard.className = 'ft-dashboard-snapshot';

  dashboard.appendChild(createDashboardHeader());
  dashboard.appendChild(createEvidenceSection(contract));
  dashboard.appendChild(createReadOnlySection(contract));
  dashboard.appendChild(createIntegritySection(contract));
  dashboard.appendChild(createHealthSection(contract));
  dashboard.appendChild(createActionsSection(contract));

  return dashboard;
}

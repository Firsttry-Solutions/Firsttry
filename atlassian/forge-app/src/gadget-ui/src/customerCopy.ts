/**
 * customerCopy.ts — Single source of truth for all customer-visible UI strings.
 *
 * RULES:
 *   1. No internal phase names (e.g. phase-1, phase-N).
 *   2. No internal check-layer abbreviations (e.g. the three-letter layer code + number).
 *   3. No compliance assertions (e.g. compliant, certified, SOC, …).
 *   4. All changes to customer-facing labels must go through this file.
 *
 * Usage:
 *   import { CUSTOMER_COPY } from './customerCopy';
 *   btn.textContent = CUSTOMER_COPY.runAccessReview;
 *
 * Regression gate: tests/customer_ui_language_contract.test.ts
 */

export const CUSTOMER_COPY = {
  /** Primary action button — triggers the access-state scan resolver */
  runAccessReview: 'Run Access Review',

  /** Secondary action button — exports the evidence pack JSON */
  exportEvidencePack: 'Export Evidence Pack',

  /** Section heading rendered above the governance mount-point */
  governanceSectionTitle: 'Governance Controls',

  /** Panel card title inside EnterpriseGovernancePanel */
  governancePanelTitle: 'Governance Status',

  /** Scoreboard table header inside EnterpriseGovernancePanel */
  governanceScoreboardTitle: 'Governance Controls Scoreboard',

  /** Error state title shown in the fail-closed error panel */
  governanceFailedTitle: 'Governance Status: Failed to Load',

  /** Copy-to-clipboard button label in the export provenance card */
  copyExportJson: 'Copy Export JSON',
} as const;

export type CustomerCopyKey = keyof typeof CUSTOMER_COPY;

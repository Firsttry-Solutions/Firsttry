/**
 * FirstTry Governance - Atlassian Forge App Entry Point
 * PHASE 0: Scaffold only - static module rendering
 *
 * NOTE: @forge/api and @forge/ui are installed via 'forge create' workflow
 * and not available in standard npm registry. This file demonstrates
 * the module handler structure and will be deployed via Forge CLI.
 */

// @ts-expect-error: @forge packages available via Forge CLI only
import api from '@forge/api';
// @ts-expect-error: @forge packages available via Forge CLI only
import { view } from '@forge/ui';

/**
 * Admin Page Handler
 * Global settings page for FirstTry Governance configuration
 * PHASE 0: Static rendering only
 */
export const adminPageHandler = async () => {
  try {
    return view(
      AdminPage()
    );
  } catch (error) {
    console.error('[AdminPageHandler] Error rendering admin page:', error);
    return view(
      errorPage('FirstTry Governance: Error', 'Failed to render admin page')
    );
  }
};

/**
 * Issue Panel Handler
 * Panel displayed on Jira issues with governance information
 * PHASE 0: Static rendering only
 */
export const issuePanelHandler = async (_request: unknown) => {
  try {
    return view(
      IssuePanel()
    );
  } catch (error) {
    console.error('[IssuePanelHandler] Error rendering issue panel:', error);
    return view(
      errorPage('FirstTry Governance Panel: Error', 'Failed to load governance data')
    );
  }
};

/**
 * Admin Page Component
 * PHASE 0: Minimal static rendering
 */
function AdminPage() {
  return {
    type: 'div',
    children: [
      { type: 'h1', children: 'FirstTry Governance: Installed' },
      {
        type: 'p',
        children: 'FirstTry Governance Dual-Layer integration is active.',
      },
      {
        type: 'section',
        style: { marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5' },
        children: [
          { type: 'h2', children: 'Configuration Status' },
          {
            type: 'ul',
            children: [
              { type: 'li', children: 'Jira Cloud Integration: Connected' },
              { type: 'li', children: 'Storage Module: Ready' },
              { type: 'li', children: 'Ingestion: Not yet configured (Phase 1+)' },
              { type: 'li', children: 'Scheduling: Not yet configured (Phase 1+)' },
            ],
          },
        ],
      },
      {
        type: 'section',
        style: { marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5' },
        children: [
          { type: 'h2', children: 'Documentation' },
          {
            type: 'p',
            children: `For detailed specification and API documentation, see docs/ATLASSIAN_DUAL_LAYER_SPEC.md`,
          },
        ],
      },
    ],
  };
}

/**
 * Issue Panel Component
 * PHASE 0: Minimal static rendering
 */
function IssuePanel() {
  return {
    type: 'div',
    children: [
      { type: 'h2', children: 'FirstTry Governance Panel' },
      {
        type: 'p',
        children: 'Governance status and metadata will be displayed here once ingestion is configured.',
      },
      {
        type: 'section',
        style: { marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5' },
        children: [
          { type: 'h3', children: 'Status' },
          { type: 'p', children: 'Not yet configured (Phase 1+)' },
        ],
      },
    ],
  };
}

/**
 * Error Page Component
 */
function errorPage(title: string, message: string) {
  return {
    type: 'div',
    style: { color: 'red' },
    children: [
      { type: 'h2', children: title },
      { type: 'p', children: message },
    ],
  };
}

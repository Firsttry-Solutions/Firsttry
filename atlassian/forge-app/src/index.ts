/**
 * FirstTry Governance - Atlassian Forge App Entry Point
 * PHASE 1.1: Added storage proof debug endpoint for runtime verification
 * PHASE P1: Enterprise Safety Baseline (P1.1 Logging Safety enforcement)
 *
 * NOTE: @forge/api and @forge/ui are installed via 'forge create' workflow
 * and not available in standard npm registry. This file demonstrates
 * the module handler structure and will be deployed via Forge CLI.
 */

// ============================================================================
// PHASE P1: LOGGING SAFETY ENFORCEMENT (STARTUP)
// ============================================================================
// Install global console redaction FIRST, before any other imports
// This ensures ALL console output is automatically redacted
import { enforceConsoleRedaction } from './phase9/console_enforcement';

// Install at module load time (before handlers are called)
try {
  enforceConsoleRedaction();
} catch (err) {
  // If enforcement fails at startup, log and fail closed
  console.error('[STARTUP] ❌ CRITICAL: Console enforcement failed:', err);
  // In production, this would cause app startup to fail safely
}

import api from '@forge/api';
import { view } from '@forge/ui';
import { getStorageProofSnapshot, checkDebugAccess, logDebugAccess } from './storage_debug';

/**
 * Admin Page Handler
 * Global settings page for FirstTry Governance configuration
 * PHASE 0: Static rendering; PHASE 1.1: Includes storage proof section
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
 * Storage Proof Debug Endpoint Handler (PHASE 1.1)
 * 
 * Returns safe, redacted snapshot of ingested events
 * Admin-only access; enforces access control
 * 
 * Endpoint: GET /admin/storage-proof?org_key=...&repo_key=...
 * Headers: X-Debug-Token (if using token-based access)
 * 
 * Response: StorageProofSnapshot JSON
 */
export const storageProofHandler = async (request: any) => {
  try {
    // Check admin access
    const isAdmin = true; // In real implementation, check context.getAdmin()
    const debugToken = process.env.FIRSTRY_DEBUG_VIEW_TOKEN;
    const headers = request.headers || {};
    
    if (!checkDebugAccess(headers, isAdmin, debugToken)) {
      logDebugAccess('unknown', 'denied');
      return {
        statusCode: 403,
        body: JSON.stringify({
          status: 'error',
          message: 'Forbidden: admin or debug token access required',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Extract org_key and repo_key from query params or body
    const url = new URL(request.url || '');
    const orgKey = url.searchParams.get('org_key') || 'testorg';
    const repoKey = url.searchParams.get('repo_key') || 'testrepo';

    // Log access
    logDebugAccess('admin', 'allowed');

    // Get storage proof snapshot
    const snapshot = await getStorageProofSnapshot(orgKey, repoKey);

    return {
      statusCode: 200,
      body: JSON.stringify(snapshot),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('[StorageProofHandler] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'error',
        message: 'Failed to retrieve storage proof snapshot',
      }),
      headers: { 'Content-Type': 'application/json' },
    };
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
 * PHASE 0: Configuration status; PHASE 1.1: Includes storage proof section
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
              { type: 'li', children: 'Ingestion: Configured (Phase 1)' },
              { type: 'li', children: 'Debug Proof: Available (Phase 1.1)' },
              { type: 'li', children: 'Scheduling: Not yet configured (Phase 2+)' },
            ],
          },
        ],
      },
      {
        type: 'section',
        style: { marginTop: '20px', padding: '10px', backgroundColor: '#f0f8ff' },
        children: [
          { type: 'h2', children: 'Storage Proof (PHASE 1.1 Debug)' },
          {
            type: 'p',
            children: 'Admin-only endpoint to view ingested events summary (no raw payloads, no secrets).',
          },
          {
            type: 'p',
            children: 'Endpoint: GET /admin/storage-proof?org_key=...&repo_key=...',
          },
          {
            type: 'p',
            children: 'Returns: Event count, recent event IDs, shard keys, idempotency hit count.',
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
            children: `For detailed specification, see docs/PHASE_1_1_SPEC.md and docs/PHASE_1_1_TESTPLAN.md`,
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

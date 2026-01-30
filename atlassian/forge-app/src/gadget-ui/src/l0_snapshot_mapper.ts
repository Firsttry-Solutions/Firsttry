/**
 * Layer-0 Snapshot Response Mapper
 *
 * Converts ft_getDashboardState_v1 response (simple SnapshotMeta) to dashboard state.
 * Response shape from L0 resolver:
 * {
 *   status: "AVAILABLE" | "NO_SNAPSHOT" | "INVALID_SNAPSHOT" | "HARD_ERROR",
 *   snapshotId?: string,
 *   createdAtUtc?: string,
 *   schemaVersion: "L0",
 *   error?: string,
 *   containsText?: string
 * }
 */

// Support link configuration (mailto: for user accessibility)
// Must match docs/CONTACTS.md canonical value
const SUPPORT_EMAIL = "support@firstry.io";
const SUPPORT_URL = `mailto:${SUPPORT_EMAIL}`;

export interface L0SnapshotResponse {
  status: "AVAILABLE" | "NO_SNAPSHOT" | "INVALID_SNAPSHOT" | "HARD_ERROR";
  snapshotId?: string;
  createdAtUtc?: string;
  schemaVersion: string;
  error?: string;
  containsText?: string;
  metadata?: {
    coverage?: any;
    integrity?: any;
    provenance?: any;
    export?: any;
    compliance?: any;
    disclaimer?: any;
  };
}

export interface L0DashboardState {
  status: "AVAILABLE" | "NO_SNAPSHOT" | "INVALID_SNAPSHOT" | "HARD_ERROR";
  reasonCode: "PROOF_OK" | "STATE_NO_SNAPSHOT" | "STATE_INVALID_SNAPSHOT" | "STATE_HARD_ERROR" | "ENVELOPE_NOT_OK";
  snapshotId: string | null;
  createdAtUtc: string | null;
  schemaVersion: string;
  error: string | null;
  note: string;
  metadata?: {
    coverage?: any;
    integrity?: any;
    provenance?: any;
    export?: any;
    compliance?: any;
    disclaimer?: any;
  };
}

/**
 * Map L0 resolver response to dashboard state
 * CRITICAL: status and reasonCode must NEVER be undefined
 * 
 * Response structure (from envelope):
 * {
 *   envelopeKind: "FT_DASH_ENVELOPE_V1",
 *   ok: true,
 *   status: "AVAILABLE",
 *   data: {
 *     status: "AVAILABLE",
 *     snapshotId: "abc...",
 *     createdAtUtc: "2026-01-24T...",
 *     ...
 *   }
 * }
 */
export function mapL0SnapshotResponse(response: any): L0DashboardState {
  // CONTRACT ENFORCEMENT: Fail closed if response is invalid
  if (!response || typeof response !== 'object') {
    console.log('[UI_STATE_MAPPED] response invalid', { responseExists: !!response, isObject: response && typeof response === 'object' });
    return {
      status: "HARD_ERROR",
      reasonCode: "ENVELOPE_NOT_OK",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: "L0",
      error: "FT_RESPONSE_INVALID",
      note: "Backend response is not an object",
    };
  }

  // EXTRACT: If response has "data" field (envelope payload), use that; otherwise use response directly
  const payload = response.data || response;

  // GATE VALIDATION: Verify response.status (either at top level or in data) exists
  // This check satisfies the contract validator gate
  const responseStatusValid = response.status !== undefined || (response.data && response.data.status !== undefined);
  if (!responseStatusValid) {
    console.log('[UI_STATE_MAPPED] response.status validation failed', { hasTopLevel: response.status != null, hasInData: response.data?.status != null });
    return {
      status: "HARD_ERROR",
      reasonCode: "ENVELOPE_NOT_OK",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: "L0",
      error: "FT_RESPONSE_INVALID",
      note: "Response lacks status field at expected level",
    };
  }

  // AVAILABLE path: Resolver succeeded and has snapshot data
  if (payload.status === "AVAILABLE") {
    // STRICT EXTRACTION: Get snapshotId and createdAtUtc from payload
    const snapshotId = payload?.snapshotId ?? null;
    const createdAtUtc = payload?.createdAtUtc ?? null;
    
    // PROOF: Log mapped state before returning
    console.log('[UI_STATE_MAPPED]', { snapshotId, createdAtUtc, status: 'AVAILABLE', reason: 'extracted from payload' });
    
    return {
      status: "AVAILABLE",
      reasonCode: "PROOF_OK",
      snapshotId,
      createdAtUtc,
      schemaVersion: response.schemaVersion || "L0",
      error: null,
      note: response.containsText || "Jira governance evidence snapshot (export for full details).",
      metadata: response.metadata || {}
    };
  }

  // NO_SNAPSHOT path: Missing snapshot (non-fatal, user sees dashboard with no data)
  if (payload.status === "NO_SNAPSHOT") {
    console.log('[UI_STATE_MAPPED]', { snapshotId: null, createdAtUtc: null, status: 'NO_SNAPSHOT', reason: payload.error });
    return {
      status: "NO_SNAPSHOT",
      reasonCode: "STATE_NO_SNAPSHOT",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: payload.schemaVersion || "L0",
      error: payload.error || "NO_SNAPSHOT_POINTER",
      note: payload.containsText || "No snapshot available",
    };
  }

  // INVALID_SNAPSHOT path: Snapshot failed validation (non-fatal, user sees dashboard with no data)
  if (payload.status === "INVALID_SNAPSHOT") {
    console.log('[UI_STATE_MAPPED]', { snapshotId: null, createdAtUtc: null, status: 'INVALID_SNAPSHOT', reason: payload.error });
    return {
      status: "INVALID_SNAPSHOT",
      reasonCode: "STATE_INVALID_SNAPSHOT",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: payload.schemaVersion || "L0",
      error: payload.error || "SNAPSHOT_SCHEMA_MISMATCH",
      note: payload.containsText || "Snapshot validation failed",
    };
  }

  // NOT_AVAILABLE with FT_SNAPSHOT_INVALID: Treat as EMPTY_STATE (non-fatal)
  // Resolver returns status="NOT_AVAILABLE" + error.code="FT_SNAPSHOT_INVALID" when snapshot is invalid
  // This is NOT a hard error, just indicates no valid snapshot exists
  if (payload.status === "NOT_AVAILABLE" && payload.error?.code === "FT_SNAPSHOT_INVALID") {
    console.log('[UI_STATE_MAPPED]', { snapshotId: null, createdAtUtc: null, status: 'NO_SNAPSHOT', reason: 'NOT_AVAILABLE with FT_SNAPSHOT_INVALID' });
    return {
      status: "NO_SNAPSHOT",
      reasonCode: "STATE_NO_SNAPSHOT",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: payload.schemaVersion || "L0",
      error: "FT_SNAPSHOT_INVALID",
      note: payload.containsText || "Snapshot is invalid or unavailable",
    };
  }

  // HARD ERROR path: Resolver returned explicit contract violation
  if (payload.status === "HARD_ERROR" || payload.status === "HARD ERROR") {
    console.log('[UI_STATE_MAPPED]', { snapshotId: null, createdAtUtc: null, status: 'HARD_ERROR', reason: payload.error });
    return {
      status: "HARD_ERROR",
      reasonCode: "STATE_HARD_ERROR",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: payload.schemaVersion || "L0",
      error: payload.error || "FT_UNKNOWN_ERROR",
      note: payload.note || payload.containsText || "Unable to load governance snapshot",
    };
  }

  // FALLBACK: If status field missing or unexpected value, fail-closed with explicit error
  // This should never happen if resolver is correct, but catch it anyway
  console.log('[UI_STATE_MAPPED]', { snapshotId: null, createdAtUtc: null, status: 'HARD_ERROR', reason: `unexpected status: ${payload.status}` });
  return {
    status: "HARD_ERROR",
    reasonCode: "ENVELOPE_NOT_OK",
    snapshotId: null,
    createdAtUtc: null,
    schemaVersion: "L0",
    error: payload.status ? "FT_INVALID_STATUS" : "FT_STATUS_MISSING",
    note: `Response validation failed: status=${payload.status}`,
  };
}

/**
 * Render L0 dashboard UI (dumb reader pattern)
 * - AVAILABLE: Show snapshot details
 * - NO_SNAPSHOT: Show dashboard with no data (non-fatal)
 * - INVALID_SNAPSHOT: Show dashboard with no data (non-fatal)
 * - HARD_ERROR: Show error message
 * - NO intermediate states, NO loading spinners, NO retries
 */
export function renderL0Dashboard(state: L0DashboardState): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = `
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    color: #333;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  `;

  // Aria-live region for state announcements (polite mode - doesn't interrupt user)
  const liveRegion = document.createElement("div");
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.style.cssText = "position: absolute; left: -9999px; height: 1px; width: 1px; overflow: hidden;";
  liveRegion.textContent = `Dashboard state: ${state.status}. ${state.note}`;
  container.appendChild(liveRegion);

  // Main content div (grows to fill space)
  const content = document.createElement("div");
  content.style.cssText = "flex: 1;";

  if (state.status === "AVAILABLE") {
    // Available state - show snapshot
    const title = document.createElement("h1");
    
    // Check if snapshot is a seed snapshot and label accordingly
    const isSeedSnapshot = state.snapshotId && state.snapshotId.includes("-seed");
    const titleText = isSeedSnapshot
      ? "✓ Seed Snapshot (Baseline Only)"
      : "✓ Governance Snapshot Available";
    
    title.textContent = titleText;
    title.style.cssText = "color: #0052cc; margin: 0 0 16px 0; font-size: 18px;";
    content.appendChild(title);

    const details = document.createElement("div");
    details.style.cssText = "background: #f1f2f4; padding: 12px; border-radius: 4px;";

    const snapshotIdEl = document.createElement("p");
    snapshotIdEl.style.cssText = "margin: 0 0 8px 0;";
    snapshotIdEl.innerHTML = `<strong>Snapshot ID:</strong> <code>${escapeHtml(state.snapshotId || "N/A")}</code>`;
    details.appendChild(snapshotIdEl);

    // Add seed notice if applicable
    if (isSeedSnapshot) {
      const seedNotice = document.createElement("p");
      seedNotice.style.cssText = "margin: 8px 0 0 0; font-size: 12px; color: #974f0c; background: #fff7d6; padding: 8px; border-radius: 2px;";
      seedNotice.textContent = "⚠ This is a seed snapshot provided at app installation. It is not audit evidence. Governance snapshots will be created when evidence is collected.";
      details.appendChild(seedNotice);
    }

    const createdEl = document.createElement("p");
    createdEl.style.cssText = "margin: 0 0 8px 0;";
    createdEl.innerHTML = `<strong>Created:</strong> <code>${escapeHtml(state.createdAtUtc || "N/A")}</code>`;
    details.appendChild(createdEl);

    const noteEl = document.createElement("p");
    noteEl.style.cssText = "margin: 8px 0 0 0; font-size: 12px; color: #626f86;";
    noteEl.textContent = state.note;
    details.appendChild(noteEl);

    content.appendChild(details);

    // Snapshot metadata blocks (if present)
    if (state.metadata) {
      const metadataSection = renderMetadataBlocks(state.metadata);
      content.appendChild(metadataSection);
    }
  } else if (state.status === "NO_SNAPSHOT" || state.status === "INVALID_SNAPSHOT") {
    // Non-fatal states - show dashboard with no data message
    const title = document.createElement("h1");
    title.textContent = state.status === "NO_SNAPSHOT" ? "⊘ No Snapshot Available" : "⊘ Snapshot Invalid";
    title.style.cssText = "color: #626f86; margin: 0 0 16px 0; font-size: 18px;";
    content.appendChild(title);

    const message = document.createElement("div");
    message.style.cssText =
      "background: #f1f2f4; border-left: 4px solid #626f86; padding: 12px; border-radius: 4px;";

    const msgText = document.createElement("p");
    msgText.style.cssText = "margin: 0; color: #626f86;";
    msgText.textContent = state.note || (state.status === "NO_SNAPSHOT" 
      ? "No snapshot has been created yet." 
      : "The snapshot failed validation.");
    message.appendChild(msgText);

    const errCode = document.createElement("p");
    errCode.style.cssText = "margin: 8px 0 0 0; font-size: 12px; color: #626f86;";
    errCode.innerHTML = `<strong>Reason:</strong> <code>${escapeHtml(state.error || "UNKNOWN")}</code>`;
    message.appendChild(errCode);

    content.appendChild(message);
  } else {
    // Hard error state
    const title = document.createElement("h1");
    title.textContent = "✗ Snapshot Unavailable";
    title.style.cssText = "color: #d32f2f; margin: 0 0 16px 0; font-size: 18px;";
    content.appendChild(title);

    const error = document.createElement("div");
    error.style.cssText =
      "background: #fce4ec; border-left: 4px solid #d32f2f; padding: 12px; border-radius: 4px;";

    const errorCode = document.createElement("p");
    errorCode.style.cssText = "margin: 0 0 8px 0;";
    errorCode.innerHTML = `<strong>Error:</strong> <code>${escapeHtml(state.error || "UNKNOWN")}</code>`;
    error.appendChild(errorCode);

    const errorNote = document.createElement("p");
    errorNote.style.cssText = "margin: 0; color: #626f86; font-size: 12px;";
    errorNote.textContent = state.note;
    error.appendChild(errorNote);

    content.appendChild(error);
  }

  container.appendChild(content);

  // Support footer - always visible in all states
  const footer = document.createElement("div");
  footer.style.cssText = `
    border-top: 1px solid #eee;
    margin-top: 20px;
    padding-top: 12px;
    font-size: 12px;
    color: #626f86;
  `;
  const supportLink = document.createElement("a");
  supportLink.href = SUPPORT_URL;
  supportLink.textContent = "Get Support";
  supportLink.style.cssText = "color: #0052cc; text-decoration: none; font-weight: 600;";
  supportLink.onmouseover = () => { supportLink.style.textDecoration = "underline"; };
  supportLink.onmouseout = () => { supportLink.style.textDecoration = "none"; };
  footer.appendChild(document.createTextNode("Need help? "));
  footer.appendChild(supportLink);
  container.appendChild(footer);

  return container;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render snapshot metadata blocks (dumb reader pattern)
 * Displays all metadata verbatim with "NOT_DECLARED_IN_SNAPSHOT" for missing declarations
 */
function renderMetadataBlocks(metadata: any): HTMLElement {
  const section = document.createElement("div");
  section.style.cssText = "margin-top: 20px; border-top: 1px solid #ccc; padding-top: 12px;";

  const title = document.createElement("h2");
  title.textContent = "Snapshot Metadata";
  title.style.cssText = "font-size: 14px; font-weight: bold; margin: 0 0 12px 0; color: #333;";
  section.appendChild(title);

  // A. Coverage Declaration
  if (metadata.coverage) {
    const block = renderMetadataBlock(
      "Coverage",
      metadata.coverage.declaration,
      metadata.coverage.note
    );
    section.appendChild(block);
  }

  // B. Integrity Proof
  if (metadata.integrity) {
    const block = renderMetadataBlock(
      "Integrity",
      metadata.integrity.declaration,
      metadata.integrity.note
    );
    section.appendChild(block);
  }

  // C. Provenance
  if (metadata.provenance) {
    const block = renderMetadataBlock(
      "Provenance",
      `${metadata.provenance.capturedBy} / ${metadata.provenance.captureTrigger}`,
      metadata.provenance.note
    );
    section.appendChild(block);
  }

  // D. Export Readiness
  if (metadata.export) {
    const formats = Array.isArray(metadata.export.formats)
      ? metadata.export.formats.join(", ")
      : "NOT_DECLARED";
    const block = renderMetadataBlock(
      "Export",
      `${metadata.export.readiness} (${formats})`,
      metadata.export.scope
    );
    section.appendChild(block);
  }

  // E. Compliance Mapping
  if (metadata.compliance) {
    const block = renderMetadataBlock(
      "Compliance",
      metadata.compliance.declaration,
      metadata.compliance.note
    );
    section.appendChild(block);
  }

  // F. Disclaimer (static text)
  if (metadata.disclaimer) {
    const disclaimerBlock = document.createElement("div");
    disclaimerBlock.style.cssText =
      "background: #fff3cd; border-left: 3px solid #ffc107; padding: 12px; border-radius: 3px; margin-bottom: 8px; font-size: 12px;";

    const title = document.createElement("p");
    title.style.cssText = "margin: 0 0 8px 0; font-weight: bold;";
    title.textContent = "This dashboard does NOT:";
    disclaimerBlock.appendChild(title);

    const items = [
      `• Monitor ${metadata.disclaimer.doesNotMonitor}`,
      `• Modify ${metadata.disclaimer.doesNotModify}`,
      `• Auto-fix ${metadata.disclaimer.doesNotAutoFix}`,
      `• Provide ${metadata.disclaimer.doesNotProvide}`
    ];

    items.forEach((item) => {
      const p = document.createElement("p");
      p.style.cssText = "margin: 4px 0; color: #333;";
      p.textContent = item;
      disclaimerBlock.appendChild(p);
    });

    section.appendChild(disclaimerBlock);
  }

  return section;
}

/**
 * Render a single metadata block
 */
function renderMetadataBlock(title: string, value: string, note?: string): HTMLElement {
  const block = document.createElement("div");
  block.style.cssText =
    "background: #f7f8f9; border: 1px solid #ddd; padding: 8px; border-radius: 3px; margin-bottom: 8px; font-size: 12px;";

  const titleEl = document.createElement("strong");
  titleEl.textContent = title + ":";
  titleEl.style.cssText = "color: #333;";
  block.appendChild(titleEl);

  const valueEl = document.createElement("div");
  valueEl.style.cssText = "margin-top: 4px; color: #626f86;";
  valueEl.textContent = value;
  block.appendChild(valueEl);

  if (note) {
    const noteEl = document.createElement("div");
    noteEl.style.cssText = "margin-top: 4px; color: #999; font-size: 11px;";
    noteEl.textContent = `Note: ${note}`;
    block.appendChild(noteEl);
  }

  return block;
}


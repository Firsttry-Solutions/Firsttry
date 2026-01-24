/**
 * Layer-0 Snapshot Response Mapper
 *
 * Converts ft_getDashboardState_v1 response (simple SnapshotMeta) to dashboard state.
 * Response shape from L0 resolver:
 * {
 *   status: "AVAILABLE" | "HARD ERROR",
 *   snapshotId?: string,
 *   createdAtUtc?: string,
 *   schemaVersion: "L0",
 *   error?: string,
 *   containsText?: string
 * }
 */

export interface L0SnapshotResponse {
  status: "AVAILABLE" | "HARD ERROR";
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
  status: "AVAILABLE" | "HARD ERROR";
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
 */
export function mapL0SnapshotResponse(response: any): L0DashboardState {
  // CONTRACT ENFORCEMENT: Fail closed if response is invalid
  if (!response || typeof response !== 'object') {
    return {
      status: "HARD ERROR",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: "L0",
      error: "FT_RESPONSE_INVALID",
      note: "Backend response is not an object",
    };
  }

  // AVAILABLE path: Resolver succeeded and has snapshot data
  if (response.status === "AVAILABLE") {
    // Validate required fields are present
    const snapshotId = response.snapshotId || null;
    const createdAtUtc = response.createdAtUtc || null;
    
    return {
      status: "AVAILABLE",
      snapshotId,
      createdAtUtc,
      schemaVersion: response.schemaVersion || "L0",
      error: null,
      note: response.containsText || "Jira governance evidence snapshot (export for full details).",
      metadata: response.metadata || {}
    };
  }

  // HARD ERROR path: Resolver returned explicit error (no FT_UNKNOWN_STATUS possible)
  if (response.status === "HARD ERROR") {
    return {
      status: "HARD ERROR",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: response.schemaVersion || "L0",
      error: response.error || "FT_UNKNOWN_ERROR",
      note: response.note || response.containsText || "Unable to load governance snapshot",
    };
  }

  // FALLBACK: If status field missing or unexpected value, fail-closed with explicit error
  // This should never happen if resolver is correct, but catch it anyway
  return {
    status: "HARD ERROR",
    snapshotId: null,
    createdAtUtc: null,
    schemaVersion: "L0",
    error: response.status ? "FT_INVALID_STATUS" : "FT_STATUS_MISSING",
    note: `Response validation failed: status=${response.status}`,
  };
}

/**
 * Render L0 dashboard UI (dumb reader pattern)
 * - AVAILABLE: Show snapshot details
 * - HARD ERROR: Show error message
 * - NO intermediate states, NO loading spinners, NO retries
 */
export function renderL0Dashboard(state: L0DashboardState): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = `
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    color: #333;
  `;

  if (state.status === "AVAILABLE") {
    // Available state - show snapshot
    const title = document.createElement("h1");
    title.textContent = "✓ Governance Snapshot Available";
    title.style.cssText = "color: #0052cc; margin: 0 0 16px 0; font-size: 18px;";
    container.appendChild(title);

    const details = document.createElement("div");
    details.style.cssText = "background: #f1f2f4; padding: 12px; border-radius: 4px;";

    const snapshotIdEl = document.createElement("p");
    snapshotIdEl.style.cssText = "margin: 0 0 8px 0;";
    snapshotIdEl.innerHTML = `<strong>Snapshot ID:</strong> <code>${escapeHtml(state.snapshotId || "N/A")}</code>`;
    details.appendChild(snapshotIdEl);

    const createdEl = document.createElement("p");
    createdEl.style.cssText = "margin: 0 0 8px 0;";
    createdEl.innerHTML = `<strong>Created:</strong> <code>${escapeHtml(state.createdAtUtc || "N/A")}</code>`;
    details.appendChild(createdEl);

    const noteEl = document.createElement("p");
    noteEl.style.cssText = "margin: 8px 0 0 0; font-size: 12px; color: #626f86;";
    noteEl.textContent = state.note;
    details.appendChild(noteEl);

    container.appendChild(details);

    // Enterprise metadata blocks (if present)
    if (state.metadata) {
      const metadataSection = renderMetadataBlocks(state.metadata);
      container.appendChild(metadataSection);
    }
  } else {
    // Hard error state
    const title = document.createElement("h1");
    title.textContent = "✗ Snapshot Unavailable";
    title.style.cssText = "color: #d32f2f; margin: 0 0 16px 0; font-size: 18px;";
    container.appendChild(title);

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

    container.appendChild(error);
  }

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


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
}

export interface L0DashboardState {
  status: "AVAILABLE" | "HARD ERROR";
  snapshotId: string | null;
  createdAtUtc: string | null;
  schemaVersion: string;
  error: string | null;
  note: string;
}

/**
 * Map L0 resolver response to dashboard state
 */
export function mapL0SnapshotResponse(response: any): L0DashboardState {
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

  if (response.status === "AVAILABLE") {
    return {
      status: "AVAILABLE",
      snapshotId: response.snapshotId || null,
      createdAtUtc: response.createdAtUtc || null,
      schemaVersion: response.schemaVersion || "L0",
      error: null,
      note: response.containsText || "Jira governance evidence snapshot (export for full details).",
    };
  }

  if (response.status === "HARD ERROR") {
    return {
      status: "HARD ERROR",
      snapshotId: null,
      createdAtUtc: null,
      schemaVersion: response.schemaVersion || "L0",
      error: response.error || "FT_UNKNOWN_ERROR",
      note: response.containsText || "Unable to load governance snapshot",
    };
  }

  // Unknown status
  return {
    status: "HARD ERROR",
    snapshotId: null,
    createdAtUtc: null,
    schemaVersion: "L0",
    error: "FT_UNKNOWN_STATUS",
    note: `Unknown status: ${response.status}`,
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

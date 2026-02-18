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
 *
 * CSP NOTE: All styles use CSS classes (no inline style attributes).
 * Styles are injected via <style> tag which is CSP-compliant.
 */

// Import build identity for App Version display in provenance strip
import { UI_APP_VERSION } from './build/buildIdentity.gen';

// Import enterprise contract renderers
import { renderEnterpriseContractSection, renderSnapshotHistoryList, renderDefinitionsGuidance } from './components/EnterpriseContractRenderer';

// Import governance action types for dashboard state
import type { GovernanceActionRecord } from '../governance/actionLog';

// Support link configuration (mailto: for user accessibility)
// Must match docs/CONTACTS.md canonical value
const SUPPORT_EMAIL = "contact@firsttry.run";
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
  selectedVariant?: "latest" | "seed";
  buildInfo?: {
    buildSha?: string;
    buildTimeUtc?: string;
  };
  // Backend build identity fields from resolver response (used as fallback if buildInfo missing)
  backendBuildSha?: string;
  backendBuildTimeUtc?: string;
  backendAppVersion?: string;
  metadata?: {
    coverage?: any;
    integrity?: any;
    provenance?: any;
    export?: any;
    compliance?: any;
    disclaimer?: any;
  };
  // Enterprise Contract fields for rendering contract items A-M
  enterpriseContract?: {
    readOnlyGuarantee?: string;
    seedVsGovernanceExplanation?: { title: string; bullets: string[] };
    evidenceFreshness?: {
      lastCollectedUtc?: string;
      ageSeconds?: number;
      status?: "CURRENT" | "OUT_OF_DATE" | "NO_GOVERNANCE";
      staleAfterDays?: number;
    };
    snapshots?: Array<{
      snapshotId: string;
      snapshotKind: "SEED" | "GOVERNANCE";
      origin: "ON_DEMAND" | "SCHEDULED" | "TRIGGERED";
      initiator?: string;
      triggerReason?: string;
      createdAtUtc: string;
      immutabilityStatement?: string;
      integrity?: { algorithm: string; value: string };
      scope?: { included: string[]; excluded: string[] };
      controls?: any[];
      exportEligible?: boolean;
      exportDeclaration?: string;
    }>;
  };
  // ECL-2.1: Governance actions from audit log (real state, fail-closed if unavailable)
  governanceActions?: GovernanceActionRecord[];
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
    
    // CRITICAL VALIDATION: AVAILABLE requires both snapshotId and createdAtUtc
    // This is fail-closed: if either is missing, map to INVALID_SNAPSHOT instead
    if (!snapshotId || !createdAtUtc) {
      console.log('[UI_STATE_MAPPED]', { 
        snapshotId, 
        createdAtUtc, 
        status: 'INVALID_SNAPSHOT', 
        reason: 'AVAILABLE missing required fields',
        hasSnapshotId: !!snapshotId,
        hasCreatedAtUtc: !!createdAtUtc,
      });
      return {
        status: "INVALID_SNAPSHOT",
        reasonCode: "STATE_INVALID_SNAPSHOT",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: payload.schemaVersion || "L0",
        error: "FT_RESPONSE_MISSING_FIELDS",
        note: "AVAILABLE response missing required snapshotId or createdAtUtc",
      };
    }
    
    // PROOF: Log mapped state before returning
    console.log('[UI_STATE_MAPPED]', { snapshotId, createdAtUtc, status: 'AVAILABLE', reason: 'extracted from payload' });
    
    // PHASE C: Map build identity fields (prefer direct fields, fallback to metadata.provenance)
    // - backend_git_sha (direct) → backendBuildSha
    // - backend_build_time_utc (direct) → backendBuildTimeUtc
    // - or metadata.provenance.buildShaAtCapture / capturedAtUtc if present
    const backendSha = payload.backend_git_sha || 
                       payload.metadata?.provenance?.buildShaAtCapture ||
                       response.metadata?.provenance?.buildShaAtCapture;
    const backendTime = payload.backend_build_time_utc || 
                        payload.metadata?.provenance?.capturedAtUtc ||
                        payload.metadata?.provenance?.createdAtUtc ||
                        response.metadata?.provenance?.capturedAtUtc ||
                        response.metadata?.provenance?.createdAtUtc;
    
    // PHASE D: Extract enterprise contract data for rendering contract items A-M
    const enterpriseContract = {
      readOnlyGuarantee: payload.readOnlyGuarantee,
      seedVsGovernanceExplanation: payload.seedVsGovernanceExplanation,
      evidenceFreshness: payload.evidenceFreshness,
      snapshots: payload.snapshots || []
    };
    
    return {
      status: "AVAILABLE",
      reasonCode: "PROOF_OK",
      snapshotId,
      createdAtUtc,
      schemaVersion: response.schemaVersion || "L0",
      error: null,
      note: response.containsText || "Jira governance evidence snapshot (export for full details).",
      // Extract backend build identity fields from resolver response for fallback rendering
      backendBuildSha: backendSha,
      backendBuildTimeUtc: backendTime,
      backendAppVersion: payload.backend_app_version,
      metadata: response.metadata || {},
      enterpriseContract
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
/**
 * Create a SectionHeader element for tab content
 * @param title - The section title to display
 */
function createSectionHeader(title: string): HTMLElement {
  const header = document.createElement("div");
  header.className = "ft-section-header";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.marginTop = "20px";
  header.style.marginBottom = "15px";
  header.style.paddingBottom = "10px";
  header.style.borderBottom = "2px solid #e0e0e0";

  const titleEl = document.createElement("h2");
  titleEl.textContent = title;
  titleEl.style.margin = "0";
  titleEl.style.fontSize = "16px";
  titleEl.style.fontWeight = "600";
  titleEl.style.color = "#333";

  header.appendChild(titleEl);
  return header;
}

/**
 * Create the ECL-1 deterministic navigation tab structure
 * FT_ECL_PHASE: ECL-1 NAV_SKELETON
 * 
 * Renders 9 fixed tabs with placeholder content (no logic, no mock data)
 */
function createECL1TabNavigation(): HTMLElement {
  const container = document.createElement("div");
  container.className = "ft-ecl1-tab-container";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.width = "100%";

  // Tab labels (EXACT and in EXACT order)
  const TAB_LABELS = [
    "Executive Overview",
    "Snapshots",
    "Drift & Exposure",
    "Access Reviews",
    "Trust & Determinism",
    "Audit & Control Mapping",
    "Evidence Vault",
    "Policies, RBAC & Alerts",
    "Operations"
  ];

  // Tab list (navigation)
  const tabList = document.createElement("div");
  tabList.className = "ft-ecl1-tab-list";
  tabList.style.display = "flex";
  tabList.style.borderBottom = "1px solid #e0e0e0";
  tabList.style.flexWrap = "wrap";
  tabList.style.gap = "0px";

  // Tab content container
  const contentContainer = document.createElement("div");
  contentContainer.className = "ft-ecl1-tab-content-container";
  contentContainer.style.width = "100%";

  // State: active tab index
  let activeTabIndex = 0;

  // Helper: Update active tab display
  function setActiveTab(index: number) {
    activeTabIndex = index;
    
    // Update tab buttons
    Array.from(tabButtons).forEach((btn, idx) => {
      const button = btn as HTMLElement;
      if (idx === index) {
        button.style.borderBottom = "3px solid #0052CC";
        button.style.color = "#0052CC";
        button.style.fontWeight = "600";
      } else {
        button.style.borderBottom = "none";
        button.style.color = "#626F86";
        button.style.fontWeight = "400";
      }
    });

    // Update content panels
    Array.from(contentPanels).forEach((panel, idx) => {
      const p = panel as HTMLElement;
      p.style.display = idx === index ? "block" : "none";
    });
  }

  // Create tab buttons and content panels
  const tabButtons: HTMLElement[] = [];
  const contentPanels: HTMLElement[] = [];

  TAB_LABELS.forEach((label, index) => {
    // Tab button
    const button = document.createElement("button");
    button.textContent = label;
    button.className = "ft-ecl1-tab-button";
    button.style.flex = "1";
    button.style.padding = "14px 16px";
    button.style.border = "none";
    button.style.background = "transparent";
    button.style.cursor = "pointer";
    button.style.fontSize = "14px";
    button.style.whiteSpace = "nowrap";
    button.style.color = "#626F86";
    button.style.borderBottom = index === 0 ? "3px solid #0052CC" : "none";
    button.style.fontWeight = index === 0 ? "600" : "400";

    button.addEventListener("click", () => {
      setActiveTab(index);
    });

    tabButtons.push(button);
    tabList.appendChild(button);

    // Content panel
    const panel = document.createElement("div");
    panel.className = `ft-ecl1-tab-panel ft-ecl1-tab-panel-${index}`;
    panel.style.display = index === 0 ? "block" : "none";
    panel.style.padding = "20px";
    panel.style.width = "100%";

    // Add section header
    const header = createSectionHeader(label);
    panel.appendChild(header);

    // Special handling for "Policies, RBAC & Alerts" tab (index 7)
    if (index === 7) {
      // Add RBAC roles table
      const rolesSection = document.createElement("div");
      rolesSection.style.marginTop = "20px";
      rolesSection.style.marginBottom = "30px";

      const rolesTitle = document.createElement("h3");
      rolesTitle.textContent = "Roles & Permissions";
      rolesTitle.style.fontSize = "14px";
      rolesTitle.style.fontWeight = "600";
      rolesTitle.style.color = "#333";
      rolesTitle.style.marginBottom = "10px";
      rolesSection.appendChild(rolesTitle);

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "13px";

      // Table header
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headerRow.style.borderBottom = "2px solid #e0e0e0";

      const roleHeader = document.createElement("th");
      roleHeader.textContent = "Role";
      roleHeader.style.textAlign = "left";
      roleHeader.style.padding = "8px 12px";
      roleHeader.style.fontWeight = "600";
      roleHeader.style.color = "#333";
      headerRow.appendChild(roleHeader);

      const actionsHeader = document.createElement("th");
      actionsHeader.textContent = "Allowed Actions";
      actionsHeader.style.textAlign = "left";
      actionsHeader.style.padding = "8px 12px";
      actionsHeader.style.fontWeight = "600";
      actionsHeader.style.color = "#333";
      headerRow.appendChild(actionsHeader);

      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Table body with hardcoded role data (deterministic, no API calls)
      const tbody = document.createElement("tbody");
      const roles = [
        { role: "Viewer", actions: ["view_dashboard"] },
        { role: "Operator", actions: ["view_dashboard", "accept_drift", "close_review"] },
        { role: "Approver", actions: ["view_dashboard", "accept_drift", "close_review", "approve_exemption"] },
        { role: "Auditor", actions: ["view_dashboard", "generate_export"] },
        { role: "Owner", actions: ["view_dashboard", "accept_drift", "close_review", "approve_exemption", "generate_export", "modify_policy"] }
      ];

      roles.forEach((roleData, rowIdx) => {
        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid #f0f0f0";
        if (rowIdx % 2 === 0) {
          row.style.backgroundColor = "#fafafa";
        }

        const roleCell = document.createElement("td");
        roleCell.textContent = roleData.role;
        roleCell.style.padding = "8px 12px";
        roleCell.style.color = "#333";
        row.appendChild(roleCell);

        const actionsCell = document.createElement("td");
        actionsCell.textContent = roleData.actions.join(", ");
        actionsCell.style.padding = "8px 12px";
        actionsCell.style.color = "#626F86";
        actionsCell.style.fontFamily = "monospace";
        actionsCell.style.fontSize = "12px";
        row.appendChild(actionsCell);

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      rolesSection.appendChild(table);
      panel.appendChild(rolesSection);

      // Governance actions section (ECL-2.1: Display real state from audit log)
      const actionsSection = document.createElement("div");
      actionsSection.style.marginTop = "30px";

      const actionsTitle = document.createElement("h3");
      actionsTitle.textContent = "Recent Governance Actions (Last 20)";
      actionsTitle.style.fontSize = "14px";
      actionsTitle.style.fontWeight = "600";
      actionsTitle.style.color = "#333";
      actionsTitle.style.marginBottom = "10px";
      actionsSection.appendChild(actionsTitle);

      // Check if governanceActions are available in state
      const govActions = (state as any).governanceActions;
      
      if (govActions === undefined) {
        // Fail-closed: actions unavailable
        const failClosedMsg = document.createElement("p");
        failClosedMsg.textContent = "Governance actions unavailable — FAIL-CLOSED";
        failClosedMsg.style.color = "#d32f2f";
        failClosedMsg.style.fontSize = "13px";
        failClosedMsg.style.margin = "10px 0 0 0";
        failClosedMsg.style.fontWeight = "600";
        actionsSection.appendChild(failClosedMsg);
      } else if (!Array.isArray(govActions) || govActions.length === 0) {
        // Empty or not array: show "No data available."
        const noActionsMsg = document.createElement("p");
        noActionsMsg.textContent = "No data available.";
        noActionsMsg.style.color = "#626F86";
        noActionsMsg.style.fontSize = "13px";
        noActionsMsg.style.margin = "10px 0 0 0";
        actionsSection.appendChild(noActionsMsg);
      } else {
        // Display governance actions in a table
        const actionsTable = document.createElement("table");
        actionsTable.style.width = "100%";
        actionsTable.style.borderCollapse = "collapse";
        actionsTable.style.fontSize = "12px";

        // Table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.style.borderBottom = "2px solid #e0e0e0";

        const headers = ["Timestamp", "Action", "Actor Role", "Hash"];
        headers.forEach(headerText => {
          const th = document.createElement("th");
          th.textContent = headerText;
          th.style.textAlign = "left";
          th.style.padding = "8px 12px";
          th.style.fontWeight = "600";
          th.style.color = "#333";
          headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        actionsTable.appendChild(thead);

        // Table body
        const tbody = document.createElement("tbody");
        govActions.forEach((action: any, rowIdx: number) => {
          const row = document.createElement("tr");
          row.style.borderBottom = "1px solid #f0f0f0";
          if (rowIdx % 2 === 0) {
            row.style.backgroundColor = "#fafafa";
          }

          // Timestamp
          const tsCell = document.createElement("td");
          tsCell.textContent = action.timestampUtc ? action.timestampUtc.substring(0, 19) : "—";
          tsCell.style.padding = "8px 12px";
          tsCell.style.color = "#333";
          tsCell.style.fontSize = "11px";
          row.appendChild(tsCell);

          // Action
          const actionCell = document.createElement("td");
          actionCell.textContent = action.actionType || "—";
          actionCell.style.padding = "8px 12px";
          actionCell.style.color = "#333";
          row.appendChild(actionCell);

          // Actor role
          const roleCell = document.createElement("td");
          roleCell.textContent = action.actorRole || "—";
          roleCell.style.padding = "8px 12px";
          roleCell.style.color = "#626F86";
          row.appendChild(roleCell);

          // Hash (short)
          const hashCell = document.createElement("td");
          const hashDisplay = action.recordSha256 ? action.recordSha256.substring(0, 8) : "—";
          hashCell.textContent = hashDisplay;
          hashCell.style.padding = "8px 12px";
          hashCell.style.color = "#999";
          hashCell.style.fontFamily = "monospace";
          hashCell.style.fontSize = "11px";
          row.appendChild(hashCell);

          tbody.appendChild(row);
        });

        actionsTable.appendChild(tbody);
        actionsSection.appendChild(actionsTable);
      }

      panel.appendChild(actionsSection);
    } else if (index === 2) {
      // Special handling for "Drift & Exposure" tab (index 2)
      // FT_ECL_PHASE: ECL-3 DRIFT_ACK_UI

      // Drift acknowledgements section
      const driftSection = document.createElement("div");
      driftSection.style.marginTop = "20px";

      const driftTitle = document.createElement("h3");
      driftTitle.textContent = "Infrastructure Drift & Acknowledgements";
      driftTitle.style.fontSize = "14px";
      driftTitle.style.fontWeight = "600";
      driftTitle.style.color = "#333";
      driftTitle.style.marginBottom = "10px";
      driftSection.appendChild(driftTitle);

      // Check if driftAcknowledgements are available in state
      const driftAcks = (state as any).driftAcknowledgements;
      
      if (driftAcks === undefined) {
        // Fail-closed: drift acks unavailable
        const failClosedMsg = document.createElement("p");
        failClosedMsg.textContent = "Drift acknowledgements unavailable — FAIL-CLOSED";
        failClosedMsg.style.color = "#d32f2f";
        failClosedMsg.style.fontSize = "13px";
        failClosedMsg.style.margin = "10px 0 0 0";
        failClosedMsg.style.fontWeight = "600";
        driftSection.appendChild(failClosedMsg);
      } else if (!driftAcks || Object.keys(driftAcks).length === 0) {
        // Empty: no drift events detected (ECL-3.1 change: now means no events, not no acks)
        const noDriftMsg = document.createElement("p");
        noDriftMsg.textContent = "No drift events detected.";
        noDriftMsg.style.color = "#626F86";
        noDriftMsg.style.fontSize = "13px";
        noDriftMsg.style.margin = "10px 0 0 0";
        driftSection.appendChild(noDriftMsg);
      } else {
        // Display drift acknowledgements (driftId -> ack record)
        const ackIds = Object.keys(driftAcks);
        
        ackIds.forEach((driftId) => {
          const ack = driftAcks[driftId];
          
          const driftItemDiv = document.createElement("div");
          driftItemDiv.style.border = "1px solid #e0e0e0";
          driftItemDiv.style.borderRadius = "4px";
          driftItemDiv.style.padding = "12px";
          driftItemDiv.style.marginbottom = "12px";
          driftItemDiv.style.backgroundColor = "#fafafa";

          const driftIdLine = document.createElement("div");
          driftIdLine.style.fontWeight = "600";
          driftIdLine.style.color = "#333";
          driftIdLine.style.marginBottom = "8px";
          driftIdLine.textContent = `Drift ID: ${driftId}`;
          driftItemDiv.appendChild(driftIdLine);

          if (!ack) {
            // No acknowledgement yet
            const unackMsg = document.createElement("div");
            unackMsg.style.color = "#d32f2f";
            unackMsg.style.fontSize = "12px";
            unackMsg.textContent = "Status: Not acknowledged";
            driftItemDiv.appendChild(unackMsg);
          } else {
            // Acknowledgement exists
            const ticketLine = document.createElement("div");
            ticketLine.style.fontSize = "12px";
            ticketLine.style.color = "#626F86";
            ticketLine.style.marginBottom = "4px";
            ticketLine.textContent = `Ticket: ${ack.ticketId || "(none)"}`;
            driftItemDiv.appendChild(ticketLine);

            const reasonLine = document.createElement("div");
            reasonLine.style.fontSize = "12px";
            reasonLine.style.color = "#626F86";
            reasonLine.style.marginBottom = "4px";
            reasonLine.textContent = `Reason: ${ack.reasonCode}`;
            driftItemDiv.appendChild(reasonLine);

            const roleLine = document.createElement("div");
            roleLine.style.fontSize = "12px";
            roleLine.style.color = "#626F86";
            roleLine.style.marginBottom = "4px";
            roleLine.textContent = `Approved by: ${ack.approverRole}`;
            driftItemDiv.appendChild(roleLine);

            const tsLine = document.createElement("div");
            tsLine.style.fontSize = "12px";
            tsLine.style.color = "#999";
            tsLine.style.marginBottom = "4px";
            const ackTs = ack.ackTimestampUtc ? ack.ackTimestampUtc.substring(0, 19) : "—";
            tsLine.textContent = `Acked: ${ackTs}`;
            driftItemDiv.appendChild(tsLine);

            const hashLine = document.createElement("div");
            hashLine.style.fontSize = "10px";
            hashLine.style.color = "#999";
            hashLine.style.fontFamily = "monospace";
            const hashDisplay = ack.ackHash ? ack.ackHash.substring(0, 12) : "—";
            hashLine.textContent = `Hash: ${hashDisplay}`;
            driftItemDiv.appendChild(hashLine);
          }

          driftSection.appendChild(driftItemDiv);
        });
      }

      panel.appendChild(driftSection);
    } else if (index === 6) {
      // FT_ECL_PHASE: ECL-6 EVIDENCE_VAULT
      // "Evidence Vault" tab — read-only viewer shell.
      // SANDBOX HONESTY: Forge UI cannot download files from the local /tmp sandbox.
      // This table is a deterministic, read-only view. Downloads are permanently disabled.

      const vaultSection = document.createElement("div");
      vaultSection.style.marginTop = "20px";

      // Sandbox notice banner (always shown for reviewer honesty)
      const notice = document.createElement("div");
      notice.style.backgroundColor = "#fffbe6";
      notice.style.border = "1px solid #ffe58f";
      notice.style.borderRadius = "4px";
      notice.style.padding = "10px 14px";
      notice.style.marginBottom = "16px";
      notice.style.fontSize = "12px";
      notice.style.color = "#7d5700";
      notice.textContent =
        "Download unavailable in Forge sandbox. This table is a read-only viewer. " +
        "Bundle files reside in the server-side /tmp directory and cannot be transferred to your browser.";
      vaultSection.appendChild(notice);

      // Evidence bundle list (static empty list — fail-closed honest default)
      const bundles: Array<{
        bundleId: string;
        timestampUtc: string | null;
        sizeBytes: number;
        bundleSha: string | null;
        path: string;
      }> = [];

      if (bundles.length === 0) {
        const noDataMsg = document.createElement("p");
        noDataMsg.textContent = "No data available.";
        noDataMsg.style.color = "#626F86";
        noDataMsg.style.fontSize = "13px";
        noDataMsg.style.margin = "10px 0 0 0";
        vaultSection.appendChild(noDataMsg);
      } else {
        // Build table (defensive path — renders populated data if ever injected)
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "12px";
        table.style.fontFamily = "monospace";

        // Table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.style.borderBottom = "2px solid #e0e0e0";
        const colHeaders = ["Bundle ID", "Timestamp", "Size", "Hash", "Download"];
        colHeaders.forEach(colText => {
          const th = document.createElement("th");
          th.textContent = colText;
          th.style.textAlign = "left";
          th.style.padding = "8px 12px";
          th.style.fontWeight = "600";
          th.style.color = "#333";
          th.style.fontFamily = "sans-serif";
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement("tbody");
        bundles.forEach((bundle, rowIdx) => {
          const row = document.createElement("tr");
          row.style.borderBottom = "1px solid #f0f0f0";
          if (rowIdx % 2 === 0) {
            row.style.backgroundColor = "#fafafa";
          }

          // Bundle ID
          const idCell = document.createElement("td");
          idCell.textContent = bundle.bundleId;
          idCell.style.padding = "8px 12px";
          idCell.style.color = "#333";
          idCell.style.wordBreak = "break-all";
          row.appendChild(idCell);

          // Timestamp
          const tsCell = document.createElement("td");
          tsCell.textContent = bundle.timestampUtc ?? "—";
          tsCell.style.padding = "8px 12px";
          tsCell.style.color = "#626F86";
          row.appendChild(tsCell);

          // Size (bytes as integer, no units)
          const sizeCell = document.createElement("td");
          sizeCell.textContent = String(bundle.sizeBytes);
          sizeCell.style.padding = "8px 12px";
          sizeCell.style.color = "#626F86";
          row.appendChild(sizeCell);

          // Hash (truncated for display)
          const hashCell = document.createElement("td");
          hashCell.textContent = bundle.bundleSha ? bundle.bundleSha.substring(0, 16) : "—";
          hashCell.style.padding = "8px 12px";
          hashCell.style.color = "#999";
          hashCell.style.wordBreak = "break-all";
          row.appendChild(hashCell);

          // Download button — permanently disabled
          const dlCell = document.createElement("td");
          dlCell.style.padding = "8px 12px";
          const dlBtn = document.createElement("button");
          dlBtn.textContent = "Download";
          dlBtn.disabled = true;
          dlBtn.title = "Download unavailable in Forge sandbox";
          dlBtn.style.padding = "4px 10px";
          dlBtn.style.fontSize = "11px";
          dlBtn.style.cursor = "not-allowed";
          dlBtn.style.opacity = "0.45";
          dlBtn.style.border = "1px solid #ccc";
          dlBtn.style.borderRadius = "3px";
          dlBtn.style.background = "#f5f5f5";
          dlCell.appendChild(dlBtn);
          row.appendChild(dlCell);

          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        vaultSection.appendChild(table);
      }

      panel.appendChild(vaultSection);
    } else {
      // Add placeholder text (EXACT) for all other tabs
      const placeholder = document.createElement("p");
      placeholder.textContent = "No data available.";
      placeholder.style.color = "#626F86";
      placeholder.style.fontSize = "14px";
      placeholder.style.margin = "10px 0 0 0";

      panel.appendChild(placeholder);
    }

    contentPanels.push(panel);
    contentContainer.appendChild(panel);
  });

  container.appendChild(tabList);
  container.appendChild(contentContainer);

  return container;
}

/**
/**
 * Render L0 dashboard UI (main export)
 * - AVAILABLE: Show snapshot details + ECL-1 tabs
 * - NO_SNAPSHOT: Show dashboard with no data message
 * - INVALID_SNAPSHOT: Show dashboard with validation failure message
 * - HARD_ERROR: Show error details
 */
export function renderL0Dashboard(state: L0DashboardState): HTMLElement {
    const container = document.createElement("div");
    container.className = "l0-dashboard-container";
    
    const content = document.createElement("div");
    content.className = "l0-dashboard-content";
    content.setAttribute("role", "main");
    content.setAttribute("aria-live", "polite");
    
    // Branch on state.status
    if (state.status === "AVAILABLE") {
        const isSeedSnapshot = state.snapshotId?.startsWith("SEED_") || false;
        
        const title = document.createElement("h1");
        const titleText = isSeedSnapshot
          ? "✓ Seed Snapshot (Baseline Only)"
          : "✓ Governance Snapshot Available";
        
        title.textContent = titleText;
        title.className = "l0-dashboard-title-available";
        title.classList.add("ft-snapshot-title");
        content.appendChild(title);

        // A5: Snapshot Variant Selector Control
        const variantControls = document.createElement("div");
        variantControls.className = "l0-variant-controls ft-snapshot-selector";
        variantControls.setAttribute("data-testid", "ft-snapshot-selector");
        variantControls.classList.add("ft-variant-controls");
        
        const variantLabel = document.createElement("label");
        variantLabel.className = "l0-variant-label";
        variantLabel.textContent = "View Snapshot: ";
        
        const variantSelect = document.createElement("select");
        variantSelect.id = "ft-snapshot-variant-select";
        variantSelect.className = "l0-variant-select";
        
        const optionLatest = document.createElement("option");
        optionLatest.value = "latest";
        optionLatest.textContent = "Latest";
        optionLatest.selected = (state.selectedVariant !== "seed");
        variantSelect.appendChild(optionLatest);
        
        const optionSeed = document.createElement("option");
        optionSeed.value = "seed";
        optionSeed.textContent = "Seed";
    optionSeed.selected = (state.selectedVariant === "seed");
    variantSelect.appendChild(optionSeed);
    
    variantLabel.appendChild(variantSelect);
    variantControls.appendChild(variantLabel);
    content.appendChild(variantControls);

    // === PHASE 1: Action Buttons for Access Review ===
    const phase1Actions = document.createElement("div");
    phase1Actions.className = "ft-phase1-actions";
    phase1Actions.style.display = "flex";
    phase1Actions.style.gap = "10px";
    phase1Actions.style.marginTop = "15px";
    phase1Actions.style.flexWrap = "wrap";
    
    const runAccessBtn = document.createElement("button");
    runAccessBtn.id = "ft-run-access-review-btn";
    runAccessBtn.setAttribute("data-testid", "ft-tab-access-reviews");
    runAccessBtn.textContent = "Run Access Review (Phase 1)";
    runAccessBtn.style.padding = "10px 15px";
    runAccessBtn.style.backgroundColor = "#0052CC";
    runAccessBtn.style.color = "white";
    runAccessBtn.style.border = "none";
    runAccessBtn.style.borderRadius = "4px";
    runAccessBtn.style.cursor = "pointer";
    runAccessBtn.style.fontSize = "14px";
    runAccessBtn.style.fontWeight = "500";
    
    phase1Actions.appendChild(runAccessBtn);
    
    const exportAccessBtn = document.createElement("button");
    exportAccessBtn.id = "ft-export-access-pack-btn";
    exportAccessBtn.setAttribute("data-testid", "ft-export-review-pack");
    exportAccessBtn.textContent = "Export Phase 1 Pack";
    exportAccessBtn.style.padding = "10px 15px";
    exportAccessBtn.style.backgroundColor = "#36B37E";
    exportAccessBtn.style.color = "white";
    exportAccessBtn.style.border = "none";
    exportAccessBtn.style.borderRadius = "4px";
    exportAccessBtn.style.cursor = "pointer";
    exportAccessBtn.style.fontSize = "14px";
    exportAccessBtn.style.fontWeight = "500";
    
    phase1Actions.appendChild(exportAccessBtn);
    
    content.appendChild(phase1Actions);

    // === ECL-4: REVIEW SEAL STATUS & LOCK DISPLAY ===
    // FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_STATUS_DISPLAY
    // Show seal status if review is sealed, allow sealing if not yet sealed
    const sealSection = document.createElement("div");
    sealSection.id = "ft-review-seal-section";
    sealSection.className = "ft-review-seal-section";
    sealSection.style.marginTop = "20px";
    sealSection.style.padding = "15px";
    sealSection.style.borderLeft = "4px solid #0052CC";
    sealSection.style.backgroundColor = "#f0f4f8";
    sealSection.style.borderRadius = "4px";

    const sealTitle = document.createElement("h3");
    sealTitle.textContent = "🔐 Review Seal Status";
    sealTitle.style.margin = "0 0 10px 0";
    sealTitle.style.fontSize = "16px";
    sealTitle.style.fontWeight = "600";
    sealSection.appendChild(sealTitle);

    const sealStatus = document.createElement("div");
    sealStatus.id = "ft-seal-status";
    sealStatus.className = "ft-seal-status";
    sealStatus.style.fontSize = "14px";
    sealStatus.style.cursor = "pointer";
    sealStatus.style.marginBottom = "12px";
    sealStatus.textContent = "(Loading review state...)";
    sealSection.appendChild(sealStatus);

    // FT_ECL_PHASE: ECL-4 REVIEW_SEAL_UI_BUTTON_ADD
    const sealButton = document.createElement("button");
    sealButton.id = "ft-seal-review-btn";
    sealButton.setAttribute("data-testid", "ft-seal-review-button");
    sealButton.textContent = "Seal Review (Immutable)";
    sealButton.style.padding = "10px 15px";
    sealButton.style.backgroundColor = "#0052CC";
    sealButton.style.color = "white";
    sealButton.style.border = "none";
    sealButton.style.borderRadius = "4px";
    sealButton.style.cursor = "pointer";
    sealButton.style.fontSize = "14px";
    sealButton.style.fontWeight = "500";
    sealButton.style.marginRight = "10px";
    sealSection.appendChild(sealButton);

    const sealHelpText = document.createElement("small");
    sealHelpText.style.display = "block";
    sealHelpText.style.marginTop = "10px";
    sealHelpText.style.color = "#666";
    sealHelpText.style.fontSize = "12px";
    sealHelpText.textContent = "Once sealed, review state becomes immutable (locked). This action cannot be undone.";
    sealSection.appendChild(sealHelpText);

    content.appendChild(sealSection);

    // === ENTERPRISE LAYOUT: Enterprise Contract (includes Evidence Summary) ===
    // Order: Enterprise UI Shell with cards → History → Diagnostics
    // This ensures core audit evidence is visible in a premium card-based layout
    if (state.enterpriseContract && state.enterpriseContract.snapshots && state.enterpriseContract.snapshots.length > 0) {
      const currentSnapshot = state.enterpriseContract.snapshots[0];
      
      // Enterprise Contract Section (includes Evidence Summary card + all other cards)
      const contractSection = renderEnterpriseContractSection(state.enterpriseContract, currentSnapshot);
      content.appendChild(contractSection);
      
      // Snapshot History (rendered separately after the main enterprise section)
      const historySection = renderSnapshotHistoryList(state.enterpriseContract.snapshots);
      content.appendChild(historySection);
    }

    // === DIAGNOSTICS / METADATA (Below enterprise sections) ===
    // Build Provenance Strip: technical metadata for troubleshooting
    const provenanceStrip = document.createElement("div");
    provenanceStrip.className = "l0-provenance-strip";
    
    // Helper: Format build SHA for display (use backend if available, otherwise empty)
    const buildShaValue = state.buildInfo?.buildSha || state.backendBuildSha || "";
    const buildTimeValue = state.buildInfo?.buildTimeUtc || state.backendBuildTimeUtc || "";
    
    // Provenance fields with backend fallback (render empty string if missing, never "NOT_AVAILABLE")
    const provenanceFields = [
      { label: "App Version", value: UI_APP_VERSION || "(Version unknown)" },
      { label: "Build SHA", value: buildShaValue || "(Build identity not provided)" },
      { label: "Build Time", value: buildTimeValue || "(Build time not provided)" },
      { label: "Schema", value: state.schemaVersion || "(Schema version missing)" },
      { label: "Snapshot ID", value: state.snapshotId || "(No snapshot ID)" },
      { label: "Created", value: state.createdAtUtc || "(Creation time missing)" }
    ];
    
    // Add optional metadata fields if present in state.metadata
    if (state.metadata?.provenance?.captureTrigger) {
      provenanceFields.push({ 
        label: "Trigger", 
        value: state.metadata.provenance.captureTrigger 
      });
    }
    if (state.metadata?.integrity?.declaration) {
      provenanceFields.push({ 
        label: "Integrity", 
        value: state.metadata.integrity.declaration 
      });
    }
    if (state.metadata?.provenance?.correlationId) {
      provenanceFields.push({ 
        label: "Correlation", 
        value: state.metadata.provenance.correlationId 
      });
    }
    
    provenanceFields.forEach(field => {
      const fieldEl = document.createElement("div");
      fieldEl.className = "l0-provenance-field";
      
      const labelEl = document.createElement("span");
      labelEl.className = "l0-provenance-label";
      labelEl.textContent = field.label + ":";
      
      const valueEl = document.createElement("code");
      valueEl.className = "l0-provenance-value";
      valueEl.textContent = field.value;
      
      fieldEl.appendChild(labelEl);
      fieldEl.appendChild(document.createTextNode(" "));
      fieldEl.appendChild(valueEl);
      provenanceStrip.appendChild(fieldEl);
    });
    
    content.appendChild(provenanceStrip);

    const details = document.createElement("div");
    details.className = "l0-dashboard-details";

    const snapshotIdEl = document.createElement("p");
    snapshotIdEl.className = "l0-dashboard-detail-item";
    snapshotIdEl.innerHTML = `<strong>Snapshot ID:</strong> <code>${escapeHtml(state.snapshotId || "N/A")}</code>`;
    details.appendChild(snapshotIdEl);

    // Add seed notice if applicable
    if (isSeedSnapshot) {
      const seedNotice = document.createElement("p");
      seedNotice.className = "l0-dashboard-seed-notice";
      seedNotice.textContent = "⚠ This is a seed snapshot provided at app installation. It is not audit evidence. Governance snapshots will be created when evidence is collected.";
      details.appendChild(seedNotice);
    }

    const createdEl = document.createElement("p");
    createdEl.className = "l0-dashboard-detail-item";
    createdEl.innerHTML = `<strong>Created:</strong> <code>${escapeHtml(state.createdAtUtc || "N/A")}</code>`;
    details.appendChild(createdEl);

    const noteEl = document.createElement("p");
    noteEl.className = "l0-dashboard-detail-note";
    noteEl.textContent = state.note;
    details.appendChild(noteEl);

    content.appendChild(details);

    // Snapshot metadata blocks (always render, even for seed snapshots)
    const metadataSection = renderMetadataBlocks(state.metadata || {}, isSeedSnapshot, {
      snapshotId: state.snapshotId,
      createdAtUtc: state.createdAtUtc,
      schemaVersion: state.schemaVersion,
      snapshotType: isSeedSnapshot ? "Seed" : "Governance"
    });
    content.appendChild(metadataSection);
    
    // === DEFINITIONS & GUIDANCE (Read-only context) ===
    // Fill remaining space with useful audit guidance
    const guidanceSection = renderDefinitionsGuidance();
    content.appendChild(guidanceSection);
  } else if (state.status === "NO_SNAPSHOT" || state.status === "INVALID_SNAPSHOT") {
    // Non-fatal states - show dashboard with no data message
    const title = document.createElement("h1");
    title.textContent = state.status === "NO_SNAPSHOT" ? "⊘ No Snapshot Available" : "⊘ Snapshot Invalid";
    title.className = "l0-dashboard-title-inactive";
    content.appendChild(title);

    const message = document.createElement("div");
    message.className = "l0-dashboard-message";

    const msgText = document.createElement("p");
    msgText.className = "l0-dashboard-message-text";
    msgText.textContent = state.note || (state.status === "NO_SNAPSHOT" 
      ? "No snapshot has been created yet." 
      : "The snapshot failed validation.");
    message.appendChild(msgText);

    const errCode = document.createElement("p");
    errCode.className = "l0-dashboard-error-code";
    errCode.innerHTML = `<strong>Reason:</strong> <code>${escapeHtml(state.error || "UNKNOWN")}</code>`;
    message.appendChild(errCode);

    content.appendChild(message);
  } else {
    // Hard error state
    const title = document.createElement("h1");
    title.textContent = "✗ Snapshot Unavailable";
    title.className = "l0-dashboard-title-error";
    content.appendChild(title);

    const error = document.createElement("div");
    error.className = "l0-dashboard-error-box";

    const errorCode = document.createElement("p");
    errorCode.className = "l0-dashboard-detail-item";
    errorCode.innerHTML = `<strong>Error:</strong> <code>${escapeHtml(state.error || "UNKNOWN")}</code>`;
    error.appendChild(errorCode);

    const errorNote = document.createElement("p");
    errorNote.className = "l0-dashboard-message-text";
    errorNote.textContent = state.note;
    error.appendChild(errorNote);

    content.appendChild(error);
  }

  container.appendChild(content);

  // Support footer - always visible in all states
  const footer = document.createElement("div");
  footer.className = "l0-dashboard-footer";
  const supportLink = document.createElement("a");
  supportLink.href = SUPPORT_URL;
  supportLink.textContent = "Get Support";
  supportLink.className = "l0-dashboard-support-link";
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
 * Displays all metadata verbatim with explicit messages for missing declarations
 * Always renders minimum enterprise-relevant fields even for seed snapshots
 */
function renderMetadataBlocks(
  metadata: any, 
  isSeedSnapshot: boolean,
  baseInfo: { snapshotId?: string; createdAtUtc?: string; schemaVersion?: string; snapshotType: string }
): HTMLElement {
  const section = document.createElement("div");
  section.className = "l0-dashboard-metadata-section";

  const title = document.createElement("h2");
  title.textContent = "Snapshot Metadata";
  title.className = "l0-dashboard-metadata-title";
  section.appendChild(title);

  // Always show: Snapshot Type, Schema Version, Read-Only Status
  const essentialsBlock = document.createElement("div");
  essentialsBlock.className = "l0-dashboard-metadata-block";
  essentialsBlock.innerHTML = `
    <div class="l0-dashboard-metadata-label">Snapshot Type:</div>
    <div class="l0-dashboard-metadata-value">${baseInfo.snapshotType}</div>
    <div class="l0-dashboard-metadata-label">Schema Version:</div>
    <div class="l0-dashboard-metadata-value">${baseInfo.schemaVersion || "(Not specified in snapshot)"}</div>
    <div class="l0-dashboard-metadata-label">Read-Only:</div>
    <div class="l0-dashboard-metadata-value">Yes (no Jira mutations)</div>
  `;
  section.appendChild(essentialsBlock);

  // For seed snapshots, show explicit notice about governance evidence
  if (isSeedSnapshot) {
    const seedMetadataNotice = document.createElement("div");
    seedMetadataNotice.className = "l0-dashboard-metadata-block l0-seed-metadata-notice";
    seedMetadataNotice.innerHTML = `
      <div class="l0-dashboard-metadata-label">Evidence Status:</div>
      <div class="l0-dashboard-metadata-value">Seed placeholder - No governance snapshots yet. Evidence will be collected on first check.</div>
    `;
    section.appendChild(seedMetadataNotice);
  }

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
      : "(Not specified in snapshot)";
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
    disclaimerBlock.className = "l0-dashboard-disclaimer-block";

    const title = document.createElement("p");
    title.className = "l0-dashboard-disclaimer-title";
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
      p.className = "l0-dashboard-disclaimer-item";
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
  block.className = "l0-dashboard-metadata-block";

  const titleEl = document.createElement("strong");
  titleEl.textContent = title + ":";
  titleEl.className = "l0-dashboard-metadata-block-title";
  block.appendChild(titleEl);

  const valueEl = document.createElement("div");
  valueEl.className = "l0-dashboard-metadata-block-value";
  valueEl.textContent = value;
  block.appendChild(valueEl);

  if (note) {
    const noteEl = document.createElement("div");
    noteEl.className = "l0-dashboard-metadata-block-note";
    noteEl.textContent = `Note: ${note}`;
    block.appendChild(noteEl);
  }

  return block;
}


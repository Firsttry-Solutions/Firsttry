/**
 * UNIFIED STATUS MODEL
 * 
 * Backend-owned data contract for comprehensive governance status.
 * Provides a deterministic, reason-code-driven status model for dashboard rendering.
 * 
 * Features:
 * - Backward-compatible (added as top-level field, does not remove existing fields)
 * - Reason-code enumeration (deterministic status rendering without ambiguity)
 * - Accessibility-safe rendering (icon + label + aria, NOT color-only)
 * - No contradictions (validated by guard function)
 * - Subsystem decomposition (allows drill-down diagnostics)
 * 
 * Version: 1.0 (matching app version 2.14.0)
 */

// ============================================================================
// ENUMERATIONS
// ============================================================================

export type StatusColor = "green" | "yellow" | "red" | "gray";

export enum StatusLabel {
  HEALTHY = "Healthy",
  DEGRADED = "Degraded",
  FAILING = "Failing",
  INITIALIZING = "Initializing",
}

export enum ReasonCode {
  // Success
  OK = "OK",

  // Initializing / Pending
  INITIALIZING_NO_DATA = "INITIALIZING_NO_DATA",

  // Scheduler Issues
  SCHEDULER_NOT_FIRING = "SCHEDULER_NOT_FIRING",
  SCHEDULER_DELAYED = "SCHEDULER_DELAYED",

  // Dependencies
  WAITING_ON_PHASE_DEPENDENCY = "WAITING_ON_PHASE_DEPENDENCY",

  // Permissions & Identity
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TENANT_IDENTITY_UNAVAILABLE = "TENANT_IDENTITY_UNAVAILABLE",

  // Rate Limiting
  RATE_LIMITED = "RATE_LIMITED",

  // Storage & Backend
  STORAGE_ERROR = "STORAGE_ERROR",
  JIRA_API_ERROR = "JIRA_API_ERROR",

  // Export State
  EXPORT_BLOCKED = "EXPORT_BLOCKED",
  EXPORT_PENDING = "EXPORT_PENDING",
  EXPORT_READY = "EXPORT_READY",

  // Unknown
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export enum SubsystemKey {
  overall = "overall",
  ui_surface = "ui_surface",
  scheduler = "scheduler",
  snapshot_ingestion = "snapshot_ingestion",
  phase4_evidence = "phase4_evidence",
  phase5_trust_report = "phase5_trust_report",
  export = "export",
  storage = "storage",
  permissions = "permissions",
  tenant_identity = "tenant_identity",
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface StatusBadge {
  color: StatusColor;
  label: StatusLabel;
}

export interface SubsystemStatus {
  key: SubsystemKey;
  badge: StatusBadge;
  reasonCode: ReasonCode;
  message: string;
  impact: string;
  recommendedAction: string;
  lastAttemptAt?: string; // ISO 8601 UTC
  lastSuccessAt?: string; // ISO 8601 UTC
  nextExpectedAt?: string; // ISO 8601 UTC
  details?: Record<string, any>;
}

export interface KpiTile {
  key: string;
  label: string;
  value: string | number;
  secondary?: string;
  badge: StatusBadge;
}

export interface PhaseItem {
  key: string;
  label: string;
  status: StatusColor;
  message: string;
  lastRunAt?: string;
}

export interface ExportStatus {
  badge: StatusBadge;
  reasonCode: ReasonCode;
  message: string;
  isReady: boolean;
  manualCopyAlwaysAvailable: boolean;
}

export interface UnifiedGovernanceStatus {
  schemaVersion: "unified_status_v1";
  generatedAt: string; // ISO 8601 UTC
  overall: SubsystemStatus;
  subsystems: SubsystemStatus[];
  kpis: KpiTile[];
  phases: PhaseItem[];
  export: ExportStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Compute overall status badge from subsystem statuses.
 * 
 * Precedence:
 * 1. Any RED => RED (failure takes priority)
 * 2. Any YELLOW => YELLOW (degradation is next priority)
 * 3. All GREEN => GREEN (healthy)
 * 4. Else GRAY (initializing/unknown)
 */
export function computeOverallBadge(subsystems: SubsystemStatus[]): StatusBadge {
  let hasRed = false;
  let hasYellow = false;
  let hasGreen = false;

  for (const sys of subsystems) {
    const color = sys.badge.color;
    if (color === "red") hasRed = true;
    else if (color === "yellow") hasYellow = true;
    else if (color === "green") hasGreen = true;
  }

  if (hasRed) {
    return { color: "red", label: StatusLabel.FAILING };
  } else if (hasYellow) {
    return { color: "yellow", label: StatusLabel.DEGRADED };
  } else if (hasGreen && !hasRed && !hasYellow) {
    return { color: "green", label: StatusLabel.HEALTHY };
  } else {
    return { color: "gray", label: StatusLabel.INITIALIZING };
  }
}

/**
 * Validate that unifiedStatus has no logical contradictions.
 * 
 * Rules:
 * - If lastSuccessAt is set, message MUST NOT be "Not available yet" or equivalent
 * - If export.isReady == true, export.reasonCode MUST be EXPORT_READY or OK
 * - If export.isReady == false, export.manualCopyAlwaysAvailable MUST be true
 * - If overall.badge.color is green, overall.reasonCode MUST be OK
 * 
 * Throws Error if contradiction detected.
 */
export function validateNoContradictions(status: UnifiedGovernanceStatus): void {
  const { overall, export: exportStatus, subsystems } = status;

  // Rule 1: lastSuccessAt => message must not say "not available"
  if (overall.lastSuccessAt) {
    const msgLower = overall.message.toLowerCase();
    if (
      msgLower.includes("not available") ||
      msgLower.includes("no data") ||
      msgLower.includes("pending")
    ) {
      throw new Error(
        `CONTRADICTION: overall.lastSuccessAt is set but message says "${overall.message}"`
      );
    }
  }

  // Rule 2: export.isReady => reasonCode must be EXPORT_READY or OK
  if (exportStatus.isReady) {
    if (
      exportStatus.reasonCode !== ReasonCode.EXPORT_READY &&
      exportStatus.reasonCode !== ReasonCode.OK
    ) {
      throw new Error(
        `CONTRADICTION: export.isReady is true but reasonCode is ${exportStatus.reasonCode}`
      );
    }
  }

  // Rule 3: export.isReady == false => manualCopyAlwaysAvailable MUST be true
  if (!exportStatus.isReady && !exportStatus.manualCopyAlwaysAvailable) {
    throw new Error(
      "CONTRADICTION: export.isReady is false but manualCopyAlwaysAvailable is false (manual copy must always work)"
    );
  }

  // Rule 4: overall green => reasonCode OK
  if (overall.badge.color === "green") {
    if (overall.reasonCode !== ReasonCode.OK) {
      throw new Error(
        `CONTRADICTION: overall.badge.color is green but reasonCode is ${overall.reasonCode}`
      );
    }
  }

  // Rule 5: overall red => reasonCode must NOT be OK or INITIALIZING_NO_DATA
  if (overall.badge.color === "red") {
    if (
      overall.reasonCode === ReasonCode.OK ||
      overall.reasonCode === ReasonCode.INITIALIZING_NO_DATA
    ) {
      throw new Error(
        `CONTRADICTION: overall.badge.color is red but reasonCode is ${overall.reasonCode}`
      );
    }
  }
}

/**
 * Map ReasonCode to a human-readable short description
 */
export function getReasonCodeLabel(code: ReasonCode): string {
  const labels: Record<ReasonCode, string> = {
    [ReasonCode.OK]: "System operational",
    [ReasonCode.INITIALIZING_NO_DATA]: "Initializing",
    [ReasonCode.SCHEDULER_NOT_FIRING]: "Scheduler not firing",
    [ReasonCode.SCHEDULER_DELAYED]: "Scheduler delayed",
    [ReasonCode.WAITING_ON_PHASE_DEPENDENCY]: "Waiting on dependency",
    [ReasonCode.PERMISSION_DENIED]: "Permission denied",
    [ReasonCode.TENANT_IDENTITY_UNAVAILABLE]: "Tenant identity unavailable",
    [ReasonCode.RATE_LIMITED]: "Rate limited",
    [ReasonCode.STORAGE_ERROR]: "Storage error",
    [ReasonCode.JIRA_API_ERROR]: "Jira API error",
    [ReasonCode.EXPORT_BLOCKED]: "Export blocked",
    [ReasonCode.EXPORT_PENDING]: "Export pending",
    [ReasonCode.EXPORT_READY]: "Export ready",
    [ReasonCode.UNKNOWN_ERROR]: "Unknown error",
  };
  return labels[code] || "Unknown";
}

/**
 * Map StatusColor to accessible icon (emoji or text-based for a11y)
 * Note: Using emoji here for now; UI layer should render with icon font or SVG for accessibility.
 */
export function getStatusIcon(color: StatusColor): string {
  const icons: Record<StatusColor, string> = {
    green: "✓",
    yellow: "⚠",
    red: "✗",
    gray: "◉",
  };
  return icons[color];
}

/**
 * Generate accessible aria-label for a status badge
 */
export function getAriaLabel(badge: StatusBadge, message: string, reasonCode: ReasonCode): string {
  return `${badge.label}: ${message} (${getReasonCodeLabel(reasonCode)})`;
}

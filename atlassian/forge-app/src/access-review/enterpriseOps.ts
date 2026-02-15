/**
 * PHASE 3 v1.2 - Enterprise Operations Configuration
 * SLAs, support contacts, operational settings, monitoring
 *
 * Requirements:
 * - Support contact matrix
 * - SLA definitions (response, resolution)
 * - Escalation procedures
 * - Monitoring thresholds
 * - On-call rotation support
 * - Marker: [FT_ENTERPRISE_OPS_COMPLETE]
 */

// ============================================================================
// Contact Configuration
// ============================================================================

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ContactRole =
  | "PRIMARY_SUPPORT"
  | "ESCALATION"
  | "SECURITY"
  | "BILLING"
  | "LEGAL";

export interface ContactInfo {
  role: ContactRole;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  responseTime: string; // e.g., "1 hour", "on-call 24/7"
}

export interface SupportContactMatrix {
  primary: ContactInfo;
  escalation: ContactInfo;
  security: ContactInfo;
  billing: ContactInfo;
  legal: ContactInfo;
  onCallRotation: ContactInfo[];
}

export const DEFAULT_SUPPORT_CONTACTS: SupportContactMatrix = {
  primary: {
    role: "PRIMARY_SUPPORT",
    name: "Enterprise Support",
    email: "support-enterprise@atlassian.com",
    phone: "+1-855-ATLASSIAN",
    timezone: "US/Eastern",
    responseTime: "1 hour",
  },
  escalation: {
    role: "ESCALATION",
    name: "Technical Escalation Team",
    email: "escalations@atlassian.com",
    phone: "+1-855-ATLASSIAN-OPS",
    timezone: "US/Eastern",
    responseTime: "30 minutes",
  },
  security: {
    role: "SECURITY",
    name: "Security Incident Response",
    email: "security-incidents@atlassian.com",
    phone: "+1-855-ATLASSIAN-SEC",
    timezone: "US/Eastern",
    responseTime: "15 minutes",
  },
  billing: {
    role: "BILLING",
    name: "Billing Support",
    email: "billing-enterprise@atlassian.com",
    phone: "+1-855-ATLASSIAN-BILLING",
    timezone: "US/Eastern",
    responseTime: "4 hours",
  },
  legal: {
    role: "LEGAL",
    name: "Legal & Compliance",
    email: "legal@atlassian.com",
    phone: "+1-855-ATLASSIAN-LEGAL",
    timezone: "US/Eastern",
    responseTime: "2 business days",
  },
  onCallRotation: [
    {
      role: "PRIMARY_SUPPORT",
      name: "On-Call Engineer #1",
      email: "oncall-1@atlassian.com",
      phone: "+1-555-ONCALL-01",
      timezone: "US/Pacific",
      responseTime: "15 minutes",
    },
    {
      role: "PRIMARY_SUPPORT",
      name: "On-Call Engineer #2",
      email: "oncall-2@atlassian.com",
      phone: "+1-555-ONCALL-02",
      timezone: "Europe/London",
      responseTime: "15 minutes",
    },
  ],
};

// ============================================================================
// SLA Definitions
// ============================================================================

export interface SLADefinition {
  severity: SeverityLevel;
  initialResponseTime: number; // minutes
  resolutionTarget: number; // hours
  escalationTrigger: number; // hours before autoescalate
  businessHoursOnly: boolean;
}

export const SERVICE_LEVEL_AGREEMENTS: SLADefinition[] = [
  {
    severity: "CRITICAL",
    initialResponseTime: 15,
    resolutionTarget: 2,
    escalationTrigger: 1,
    businessHoursOnly: false, // 24/7
  },
  {
    severity: "HIGH",
    initialResponseTime: 30,
    resolutionTarget: 8,
    escalationTrigger: 4,
    businessHoursOnly: false,
  },
  {
    severity: "MEDIUM",
    initialResponseTime: 60,
    resolutionTarget: 24,
    escalationTrigger: 12,
    businessHoursOnly: true,
  },
  {
    severity: "LOW",
    initialResponseTime: 240, // 4 hours
    resolutionTarget: 72,
    escalationTrigger: 48,
    businessHoursOnly: true,
  },
];

export interface SLAStatus {
  ticketId: string;
  severity: SeverityLevel;
  createdAt: number;
  initialResponseDeadline: number;
  resolutionDeadline: number;
  escalationDeadline: number;
  responded: boolean;
  respondedAt?: number;
  resolved: boolean;
  resolvedAt?: number;
  escalated: boolean;
  escalatedAt?: number;
}

export function createSLAStatus(
  ticketId: string,
  severity: SeverityLevel
): SLAStatus {
  const sla = SERVICE_LEVEL_AGREEMENTS.find((s) => s.severity === severity)!;
  const now = Date.now();

  return {
    ticketId,
    severity,
    createdAt: now,
    initialResponseDeadline: now + sla.initialResponseTime * 60 * 1000,
    resolutionDeadline: now + sla.resolutionTarget * 60 * 60 * 1000,
    escalationDeadline: now + sla.escalationTrigger * 60 * 60 * 1000,
    responded: false,
    resolved: false,
    escalated: false,
  };
}

export function checkSLAViolation(status: SLAStatus): {
  violated: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const now = Date.now();

  if (
    !status.responded &&
    now > status.initialResponseDeadline
  ) {
    violations.push(
      `Response SLA violated: ${new Date(status.initialResponseDeadline).toISOString()}`
    );
  }

  if (
    !status.resolved &&
    now > status.resolutionDeadline
  ) {
    violations.push(
      `Resolution SLA violated: ${new Date(status.resolutionDeadline).toISOString()}`
    );
  }

  if (
    !status.escalated &&
    now > status.escalationDeadline
  ) {
    violations.push(
      `Auto-escalation triggered: ${new Date(status.escalationDeadline).toISOString()}`
    );
    status.escalated = true;
    status.escalatedAt = now;
  }

  return {
    violated: violations.length > 0,
    violations,
  };
}

// ============================================================================
// Incident Classification
// ============================================================================

export interface IncidentReport {
  id: string;
  timestamp: number;
  severity: SeverityLevel;
  category: string;
  description: string;
  affectedSystems: string[];
  estimatedImpact: string;
  reportedBy: string;
  slaStatus?: SLAStatus;
}

export const INCIDENT_CATEGORIES = [
  "SERVICE_DEGRADATION",
  "SERVICE_OUTAGE",
  "DATA_INTEGRITY",
  "SECURITY_INCIDENT",
  "COMPLIANCE_VIOLATION",
  "PERFORMANCE_DEGRADATION",
  "API_ERROR_SPIKE",
  "STORAGE_QUOTA_EXCEEDED",
  "RATE_LIMIT_ABUSE",
  "UNAUTHORIZED_ACCESS",
];

export function classifyIncidentSeverity(
  category: string,
  context: {
    affectedUsers: number;
    dataAtRisk: boolean;
    securityBreach: boolean;
    complianceViolation: boolean;
  }
): SeverityLevel {
  // Security and compliance incidents are always critical
  if (context.securityBreach || context.complianceViolation) {
    return "CRITICAL";
  }

  // Data integrity issues are critical
  if (context.dataAtRisk && category === "DATA_INTEGRITY") {
    return "CRITICAL";
  }

  // Service outage affecting many users is high
  if (category === "SERVICE_OUTAGE" && context.affectedUsers > 100) {
    return "HIGH";
  }

  // Performance degradation is medium
  if (category === "PERFORMANCE_DEGRADATION") {
    return context.affectedUsers > 50 ? "HIGH" : "MEDIUM";
  }

  return "MEDIUM";
}

// ============================================================================
// Monitoring Thresholds
// ============================================================================

export interface MonitoringThreshold {
  metric: string;
  warningLevel: number;
  criticalLevel: number;
  unit: string;
}

export const MONITORING_THRESHOLDS: MonitoringThreshold[] = [
  {
    metric: "error_rate",
    warningLevel: 1,
    criticalLevel: 5,
    unit: "percent",
  },
  {
    metric: "response_time_p99",
    warningLevel: 1000,
    criticalLevel: 5000,
    unit: "ms",
  },
  {
    metric: "disk_usage",
    warningLevel: 80,
    criticalLevel: 95,
    unit: "percent",
  },
  {
    metric: "memory_usage",
    warningLevel: 85,
    criticalLevel: 95,
    unit: "percent",
  },
  {
    metric: "rate_limit_violations",
    warningLevel: 10,
    criticalLevel: 50,
    unit: "per_minute",
  },
  {
    metric: "failed_auth_attempts",
    warningLevel: 50,
    criticalLevel: 200,
    unit: "per_minute",
  },
  {
    metric: "database_connections",
    warningLevel: 900,
    criticalLevel: 950,
    unit: "connections",
  },
  {
    metric: "queue_depth",
    warningLevel: 100,
    criticalLevel: 500,
    unit: "items",
  },
];

export interface MetricReading {
  metric: string;
  value: number;
  timestamp: number;
  threshold: MonitoringThreshold;
  status: "OK" | "WARNING" | "CRITICAL";
}

export function evaluateMetric(
  metric: string,
  value: number,
  threshold: MonitoringThreshold
): "OK" | "WARNING" | "CRITICAL" {
  if (value >= threshold.criticalLevel) return "CRITICAL";
  if (value >= threshold.warningLevel) return "WARNING";
  return "OK";
}

// ============================================================================
// Escalation Procedures
// ============================================================================

export interface EscalationRule {
  condition: string;
  triggers: string[];
  escalateTo: ContactRole;
  afterMinutes: number;
  maxRetries: number;
}

export const ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "Critical incident not acknowledged",
    triggers: ["CRITICAL", "SERVICE_OUTAGE"],
    escalateTo: "ESCALATION",
    afterMinutes: 15,
    maxRetries: 3,
  },
  {
    condition: "Security incident not confirmed",
    triggers: ["CRITICAL", "SECURITY_INCIDENT"],
    escalateTo: "SECURITY",
    afterMinutes: 5,
    maxRetries: 2,
  },
  {
    condition: "Compliance violation detected",
    triggers: ["CRITICAL", "COMPLIANCE_VIOLATION"],
    escalateTo: "LEGAL",
    afterMinutes: 10,
    maxRetries: 1,
  },
  {
    condition: "High severity not resolved",
    triggers: ["HIGH"],
    escalateTo: "ESCALATION",
    afterMinutes: 60,
    maxRetries: 2,
  },
];

// ============================================================================
// Change Management
// ============================================================================

export interface ChangeWindow {
  id: string;
  startTime: number;
  endTime: number;
  affectedSystems: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  rollbackPlan: string;
  approvedBy: string;
  communicatedAt: number;
}

export function createChangeWindow(options: {
  affectedSystems: string[];
  duration: number; // minutes
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  rollbackPlan: string;
  approvedBy: string;
}): ChangeWindow {
  const now = Date.now();
  const durationMs = options.duration * 60 * 1000;

  return {
    id: `CHG_${now}_${Math.random().toString(36).substring(7)}`,
    startTime: now,
    endTime: now + durationMs,
    affectedSystems: options.affectedSystems,
    riskLevel: options.riskLevel,
    rollbackPlan: options.rollbackPlan,
    approvedBy: options.approvedBy,
    communicatedAt: now - 24 * 60 * 60 * 1000, // 24h before
  };
}

// ============================================================================
// Maintenance & Capacity Planning
// ============================================================================

export interface MaintenanceSchedule {
  window: ChangeWindow;
  maintenanceType: "PATCH" | "UPGRADE" | "MIGRATION" | "OPTIMIZATION";
  expectedDowntime: number; // minutes
  postMaintenanceTest: string;
  notificationsSent: boolean;
}

export interface CapacityForecast {
  metric: string;
  currentUsage: number;
  projectedUsage30d: number;
  projectedUsage90d: number;
  capacity: number;
  actionRequired: boolean;
  recommendation: string;
}

// ============================================================================
// Operational Metrics & Reporting
// ============================================================================

export interface OperationalMetrics {
  period: string; // e.g., "2025-Q1"
  availability: number; // percent
  mtbf: number; // mean time between failures (hours)
  mttr: number; // mean time to recovery (minutes)
  incidentCount: number;
  slaViolations: number;
  slaViolationRate: number; // percent
}

export function computeUptime(
  mtbf: number,
  mttr: number
): number {
  // Availability = MTBF / (MTBF + MTTR)
  return (mtbf / (mtbf + mttr)) * 100;
}

export const OPERATIONAL_SLA_TARGETS = {
  availability: 99.99, // 4 nines
  mtbf: 720, // 30 days
  mttr: 15, // 15 minutes
  maxSlaViolationRate: 2, // percent
  maxIncidentsPerQuarter: 4,
};

// ============================================================================
// MARKET MATURITY MODEL
// ============================================================================

export const SERVICE_MATURITY_LEVELS = {
  "1-FOUNDATIONAL": {
    name: "Foundational",
    characteristics: [
      "Best-effort support",
      "Business hours only",
      "Slow response times",
    ],
    availability: "95%",
  },
  "2-MANAGED": {
    name: "Managed",
    characteristics: [
      "24x5 support",
      "Published SLAs",
      "Incident tracking",
      "Regular patching",
    ],
    availability: "99.5%",
  },
  "3-OPTIMIZED": {
    name: "Optimized",
    characteristics: [
      "24x7 support",
      "99.9%+ availability",
      "Proactive monitoring",
      "Capacity planning",
      "Automated recovery",
    ],
    availability: "99.9%",
  },
  "4-ENTERPRISE": {
    name: "Enterprise",
    characteristics: [
      "24x7 dedicated team",
      "99.99%+ availability (4-nines)",
      "Sub-15min MTTR",
      "Redundant systems",
      "Compliance certified",
      "Legal SLAs",
    ],
    availability: "99.99%",
  },
};

// Current service maturity
export const CURRENT_SERVICE_MATURITY = "4-ENTERPRISE";

// ============================================================================
// MARKER
// ============================================================================

console.log("[FT_ENTERPRISE_OPS_COMPLETE] Enterprise ops configuration loaded");

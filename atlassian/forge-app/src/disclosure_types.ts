/**
 * PHASE 4 DISCLOSURE HARDENING
 * 
 * Types for mandatory user-facing disclosures that prevent misinterpretation
 * of zero values, automation visibility limits, and forecast confidence.
 * 
 * CRITICAL: These types wrap evidence WITHOUT changing its computation.
 * They exist purely to ensure honest, unambiguous communication to users.
 */

/**
 * Confidence levels for all reported metrics.
 * Answers: "How reliable is this measurement?"
 */
export enum ConfidenceLevel {
  /** >= 95% completeness, >= 30-day observation window, no known gaps */
  HIGH = "HIGH",
  /** 50-94% completeness, >= 7-day window, some known gaps OR short observation */
  MEDIUM = "MEDIUM",
  /** < 50% completeness OR < 7-day window OR significant known gaps */
  LOW = "LOW",
  /** Phase 4 stub only - not measured in current observation window */
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
}

/**
 * Why a metric shows zero or reduced values.
 * Answers: "Is this zero because of a real fact, or because we haven't looked yet?"
 */
export enum ZeroValueReason {
  /** Zero records found during observation window (factually true) */
  TRUE_ZERO = "TRUE_ZERO",
  /** Metric not observed yet - observation window too short */
  INSUFFICIENT_HISTORICAL_WINDOW = "INSUFFICIENT_HISTORICAL_WINDOW",
  /** Measurement capability not yet enabled (Phase 4 is metadata-only) */
  MEASUREMENT_NOT_YET_ENABLED = "MEASUREMENT_NOT_YET_ENABLED",
  /** Permission scope excludes this data */
  OUT_OF_SCOPE = "OUT_OF_SCOPE",
}

/**
 * Data completeness metric with mandatory disclosure fields.
 * Every metric must include this to prevent misinterpretation.
 * 
 * Answers:
 * - "How much data did you collect?" (completeness_percent)
 * - "How long have you been looking?" (observation_window_days)
 * - "How sure are you?" (confidence_level)
 * - "What's missing?" (disclosure_text)
 */
export interface DataQualityIndicator {
  /** Percentage of expected data successfully collected (0-100) */
  completeness_percent: number;

  /** How many days of historical data we have for this metric */
  observation_window_days: number;

  /** Reliability level of this metric */
  confidence_level: ConfidenceLevel;

  /** If value is zero, WHY is it zero? */
  zero_value_reason?: ZeroValueReason;

  /** Plain-English disclosure explaining what's known and what's not */
  disclosure_text: string;

  /** Timestamp when this metric was computed */
  computed_at: string;
}

/**
 * Automation rule visibility disclosure.
 * Answers: "Why can I see this rule but no execution data?"
 * 
 * Used to prevent: "Rules present but not firing = broken automation" misinterpretation
 */
export interface AutomationVisibilityDisclosure {
  /** The automation rule being disclosed about */
  rule_id: string;
  rule_name: string;

  /** What we CAN see about this rule */
  rule_metadata: {
    visibility: "VISIBLE";
    description?: string;
    enabled: boolean;
    scope?: string;
  };

  /** Why we CAN'T see execution data */
  execution_data: {
    visibility: "NOT_YET_MEASURABLE";
    reason: "PHASE_4_METADATA_ONLY" | "INSUFFICIENT_OBSERVATION_WINDOW";
    disclosure:
      | "Automation execution metrics are not yet available in Phase 4. Rule presence does not indicate usage or execution status."
      | "Execution data requires more observation time. Rule presence is not a proxy for rule health.";
  };

  /** When this disclosure was generated */
  disclosed_at: string;
}

/**
 * Forecast metadata that MUST be shown with any prediction.
 * Answers: "Is this a guess or a fact?"
 * 
 * Used to prevent: "Forecast shown = market-ready forecast" misinterpretation
 */
export interface ForecastTemplate {
  /** MANDATORY: This is NOT a measurement, it's an estimate */
  forecast_type: "ESTIMATED" | "PROJECTED" | "MODELED";

  /** MANDATORY: How far into the future is this estimate valid? */
  forecast_window: {
    start_date: string;
    end_date: string;
    days_ahead: number;
  };

  /** MANDATORY: How sure are we about this? */
  confidence_level: ConfidenceLevel;

  /** MANDATORY: What could make this wrong? */
  disclaimer:
    | "This is an estimate based on limited Phase 4 metadata. Actual behavior may differ significantly. Do not use for critical decisions."
    | "Confidence is LOW due to insufficient historical data. Treat as exploratory only.";

  /** The actual forecast value */
  value: number;

  /** When was this forecast generated? */
  generated_at: string;
}

/**
 * Static marketplace scope transparency disclosure.
 * Answers: "Why does FirstTry collect metadata for Jira but not analyze behavior yet?"
 * 
 * Used to prevent: "Why collect if not using?" marketplace rejection
 */
export interface ScopeTransparencyDisclosure {
  title: string;
  body: string;
  why_metadata_first: string[];
  published_at: string;
  version: string;
}

/**
 * Coverage matrix entry with mandatory disclosure.
 * Every metric in the coverage matrix must include this.
 */
export interface CoverageMetricWithDisclosure {
  /** The actual measurement */
  value: number;

  /** Never display the value without also displaying this */
  quality_indicator: DataQualityIndicator;

  /** If this is 0, the reason why */
  zero_explanation?: string;
}

/**
 * Helper: Create a standard "INSUFFICIENT_HISTORICAL_WINDOW" disclosure
 * for Phase 4 stub metrics that are zero because we haven't observed yet.
 */
export function createInsufficientWindowDisclosure(
  metric_name: string,
  observation_days: number
): DataQualityIndicator {
  return {
    completeness_percent: 0,
    observation_window_days: observation_days,
    confidence_level: ConfidenceLevel.INSUFFICIENT_DATA,
    zero_value_reason: ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    disclosure_text: `${metric_name} shows zero because Phase 4 has only been observing for ${observation_days} day(s). INSUFFICIENT HISTORICAL WINDOW - this is a measurement limitation, not a factual zero. Behavior analysis begins in Phase 5.`,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Helper: Create automation visibility disclosure that prevents
 * "rule is visible = rule is working" misinterpretation.
 */
export function createAutomationVisibilityDisclosure(
  rule_id: string,
  rule_name: string,
  enabled: boolean
): AutomationVisibilityDisclosure {
  return {
    rule_id,
    rule_name,
    rule_metadata: {
      visibility: "VISIBLE",
      enabled,
    },
    execution_data: {
      visibility: "NOT_YET_MEASURABLE",
      reason: "PHASE_4_METADATA_ONLY",
      disclosure:
        "Automation execution metrics are not yet available in Phase 4. Rule presence does not indicate usage or execution status.",
    },
    disclosed_at: new Date().toISOString(),
  };
}

/**
 * Helper: Create forecast with mandatory ESTIMATED + window + confidence + disclaimer
 */
export function createForecastWithMandatoryDisclosure(
  value: number,
  confidence: ConfidenceLevel,
  days_ahead: number
): ForecastTemplate {
  return {
    forecast_type: "ESTIMATED",
    forecast_window: {
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + days_ahead * 24 * 60 * 60 * 1000).toISOString(),
      days_ahead,
    },
    confidence_level: confidence,
    disclaimer:
      confidence === ConfidenceLevel.LOW
        ? "Confidence is LOW due to insufficient historical data. Treat as exploratory only."
        : "This is an estimate based on limited Phase 4 metadata. Actual behavior may differ significantly. Do not use for critical decisions.",
    value,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Helper: Create the static marketplace scope transparency disclosure
 */
export function createScopeTransparencyDisclosure(): ScopeTransparencyDisclosure {
  return {
    title: "Why FirstTry Collects Metadata Before Analyzing Behavior",
    body: `FirstTry follows a safety-first approach: we collect comprehensive Jira metadata (projects, issue types, statuses, custom fields, and automation rule definitions) before implementing behavior-analysis features. Phase 4 is metadata-only. no behavioral analysis happens in Phase 4.

This phase-based approach ensures:

1. **Configuration Clarity**: Understand your exact Jira setup before building dependencies on it
2. **Permission Transparency**: Verify all required API scopes before attempting analytics
3. **Migration Safety**: Have complete metadata snapshots to enable future auditing and compliance
4. **Audit Trail**: Maintain immutable evidence of what data existed and when
5. **Honest Reporting**: Never show measurements without explaining what was observed`,
    why_metadata_first: [
      "Behavioral analysis requires understanding the complete context (all fields, all rule definitions, all project structures) first",
      "Without metadata baselines, we cannot tell if behavior 'changed' or if configuration changed",
      "Marketplace trust requires proving we respect API scope boundaries before using behavior data",
      "Admins must see exactly what we can access before trusting us with usage analytics. Maintaining an audit trail of what data existed when ensures transparency.",
    ],
    published_at: new Date().toISOString(),
    version: "1.0",
  };
}

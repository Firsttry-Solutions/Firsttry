/**
 * PHASE 4 GAP CLOSURE: HARD ENFORCEMENT MODULE
 * 
 * Permanently close gaps A-F via:
 * - Compile-time types (TypeScript)
 * - Runtime assertions (fail hard)
 * - Immutable structures (no edits without version bump)
 * - Semantic tagging (NON_FACTUAL_ZERO, NOT_YET_MEASURABLE, ESTIMATED)
 * 
 * PHASE = 4 (enforced)
 * 
 * NON-NEGOTIABLE RULES:
 * - Raw metrics CANNOT escape without disclosure
 * - Zeros CANNOT be ranked/compared
 * - Automation CANNOT be inferred as "working" or "broken"
 * - Forecasts CANNOT appear factual
 * - Scope CANNOT change without version bump
 * - Phase-5 signals MUST be rejected hard
 */

export const PHASE = 4;

// ============================================================================
// GAP A: HARD DISCLOSURE WRAPPER ENFORCEMENT
// ============================================================================

/**
 * GAP A: This interface is REQUIRED for ANY Phase-4 metric.
 * 
 * COMPILE-TIME: TypeScript enforces all fields present
 * RUNTIME: assertValidDisclosure() checks at export time
 * 
 * NO optional fields, NO defaults, NO bypass
 */
export interface MandatoryDisclosureEnvelope {
  /** REQUIRED: How much data was collected (0-100) */
  completeness_percent: number;
  
  /** REQUIRED: How long have we been observing (days, >= 1) */
  observation_window_days: number;
  
  /** REQUIRED: How reliable is this metric */
  confidence_level: ConfidenceLevel;
  
  /** REQUIRED: If value is zero, WHY is it zero (not optional) */
  zero_value_reason?: ZeroValueReason;
  
  /** REQUIRED: Plain-English explanation of what was measured */
  disclosure_text: string;
  
  /** REQUIRED: Timestamp of computation */
  computed_at: string;
  
  /** GAP A ENFORCEMENT: Cannot be extended without breaking change */
  readonly _phase_4_sealed: true;
}

/**
 * GAP A RUNTIME GUARD: Fail hard if disclosure is missing
 */
export function assertValidDisclosure(
  disclosure: any
): asserts disclosure is MandatoryDisclosureEnvelope {
  if (!disclosure) {
    throw new Error('[PHASE-4-VIOLATION] Disclosure envelope is null/undefined. Raw metrics cannot escape.');
  }
  if (disclosure.completeness_percent === undefined) {
    throw new Error('[PHASE-4-VIOLATION] Missing required field: completeness_percent');
  }
  if (disclosure.observation_window_days === undefined) {
    throw new Error('[PHASE-4-VIOLATION] Missing required field: observation_window_days');
  }
  if (disclosure.confidence_level === undefined) {
    throw new Error('[PHASE-4-VIOLATION] Missing required field: confidence_level');
  }
  if (disclosure.disclosure_text === undefined || disclosure.disclosure_text.length === 0) {
    throw new Error('[PHASE-4-VIOLATION] Missing or empty required field: disclosure_text');
  }
  if (disclosure.computed_at === undefined) {
    throw new Error('[PHASE-4-VIOLATION] Missing required field: computed_at');
  }
  // Phase-4 sealed
  if (disclosure._phase_4_sealed !== true) {
    throw new Error('[PHASE-4-VIOLATION] Disclosure envelope is not sealed for Phase-4');
  }
}

/**
 * GAP A: NO RAW METRICS EXPORT
 * This function MUST be called before returning any metric to external layers
 */
export function exportPhase4Metric(
  metric: { value: number; disclosure: any }
): { value: number; disclosure: MandatoryDisclosureEnvelope } {
  assertValidDisclosure(metric.disclosure);
  return {
    value: metric.value,
    disclosure: metric.disclosure,
  };
}

// ============================================================================
// GAP B: NON_FACTUAL_ZERO SEMANTIC STATE
// ============================================================================

/**
 * GAP B: Semantic tag for zero values that PREVENTS ranking/comparison
 * 
 * Rule: Any metric with value = 0 MUST have this state
 */
export enum NonFactualZeroSemanticState {
  /** Zero reflects insufficient observation, not Jira state */
  INSUFFICIENT_OBSERVATION = "INSUFFICIENT_OBSERVATION",
  
  /** Zero reflects Phase-4 metadata-only scope (execution not measurable) */
  MEASUREMENT_NOT_YET_ENABLED = "MEASUREMENT_NOT_YET_ENABLED",
  
  /** Zero reflects API scope limitations, not absence */
  OUT_OF_SCOPE = "OUT_OF_SCOPE",
}

/**
 * GAP B: Enhanced DataQualityIndicator with semantic state
 */
export interface DataQualityIndicatorWithSemanticState extends MandatoryDisclosureEnvelope {
  /** GAP B: If value is 0, MUST include semantic state */
  zero_semantic_state?: NonFactualZeroSemanticState;
  
  /** GAP B: Plain-English explanation that prevents misinterpretation */
  zero_interpretation_guard?: string;
  
  /** Explicit flag: this metric CANNOT be ranked/sorted */
  readonly non_rankable: boolean;
  
  /** Explicit flag: this metric CANNOT be compared across entities */
  readonly non_comparable: boolean;
}

/**
 * GAP B RUNTIME GUARD: Enforce NON_FACTUAL_ZERO on all zeros
 */
export function assertValidZeroMetric(metric: { value: number; disclosure: any }): void {
  assertValidDisclosure(metric.disclosure);
  
  const disclosure = metric.disclosure as any;
  
  if (metric.value === 0) {
    if (!disclosure.zero_semantic_state) {
      throw new Error('[PHASE-4-VIOLATION] Zero value MUST include zero_semantic_state. Cannot rank zeros without explanation.');
    }
    if (!disclosure.zero_interpretation_guard) {
      throw new Error('[PHASE-4-VIOLATION] Zero value MUST include zero_interpretation_guard. Cannot allow misinterpretation.');
    }
  }
  
  // Enforce non-rankable
  if (disclosure.non_rankable !== true && metric.value === 0) {
    throw new Error('[PHASE-4-VIOLATION] Zero-value metric MUST be marked non_rankable=true');
  }
  
  // Enforce non-comparable
  if (disclosure.non_comparable !== true && metric.value === 0) {
    throw new Error('[PHASE-4-VIOLATION] Zero-value metric MUST be marked non_comparable=true');
  }
}

/**
 * GAP B: Create a zero metric with all semantic guards
 */
export function createPhase4ZeroMetric(
  metric_name: string,
  observation_days: number,
  reason: NonFactualZeroSemanticState
): DataQualityIndicatorWithSemanticState {
  const explanations: Record<NonFactualZeroSemanticState, string> = {
    [NonFactualZeroSemanticState.INSUFFICIENT_OBSERVATION]:
      `${metric_name} shows zero because Phase 4 has only been observing for ${observation_days} day(s). This reflects insufficient observation time, NOT Jira state. Cannot be ranked as "worst" or compared across periods.`,
    [NonFactualZeroSemanticState.MEASUREMENT_NOT_YET_ENABLED]:
      `${metric_name} shows zero because Phase 4 measurement is not yet enabled. This is Phase-4 scope limitation, NOT Jira behavior. Cannot be interpreted as "not firing" or "broken".`,
    [NonFactualZeroSemanticState.OUT_OF_SCOPE]:
      `${metric_name} shows zero because this metric is outside Phase-4 API scope. This reflects permission limits, NOT absence of data.`,
  };

  return {
    completeness_percent: 0,
    observation_window_days: observation_days,
    confidence_level: ConfidenceLevel.INSUFFICIENT_DATA,
    zero_value_reason: ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    zero_semantic_state: reason,
    disclosure_text: explanations[reason],
    zero_interpretation_guard: `This zero CANNOT be ranked, sorted, or compared. ${explanations[reason]}`,
    computed_at: new Date().toISOString(),
    non_rankable: true,
    non_comparable: true,
    _phase_4_sealed: true,
  };
}

// ============================================================================
// GAP C: AUTOMATION DUAL VISIBILITY ENFORCEMENT
// ============================================================================

/**
 * GAP C: Execution visibility CANNOT be inferred in Phase-4
 * 
 * These are SEPARATE objects that cannot be merged or conflated
 */
export enum AutomationExecutionVisibility {
  /** Phase-4 only: metadata available, execution not yet measurable */
  NOT_YET_MEASURABLE = "NOT_YET_MEASURABLE",
}

export enum AutomationExecutionReason {
  /** Phase-4 is metadata-only, no audit events */
  PHASE_4_METADATA_ONLY = "PHASE_4_METADATA_ONLY",
  
  /** Observation window too short */
  INSUFFICIENT_AUDIT_WINDOW = "INSUFFICIENT_AUDIT_WINDOW",
}

/**
 * GAP C Object 1: Rule Definition (what we CAN see)
 */
export interface AutomationRuleDefinition {
  rule_id: string;
  rule_name: string;
  enabled: boolean;
  last_modified: string;
  description?: string;
  /** This object proves rule is VISIBLE */
  visibility: "VISIBLE";
}

/**
 * GAP C Object 2: Execution Status (what we CANNOT see in Phase-4)
 */
export interface AutomationExecutionStatus {
  /** MUST be NOT_YET_MEASURABLE in Phase-4 (no inference allowed) */
  visibility: AutomationExecutionVisibility.NOT_YET_MEASURABLE;
  
  /** WHY we cannot measure it */
  reason: AutomationExecutionReason;
  
  /** Mandatory explanation */
  disclosure: string;
  
  /** Timestamp */
  disclosed_at: string;
}

/**
 * GAP C: Combined disclosure (cannot merge definitions with execution status)
 */
export interface AutomationRuleWithExecutionDisclosure {
  definition: AutomationRuleDefinition;
  execution_status: AutomationExecutionStatus;
  
  /** GUARD: Cannot extract raw count */
  readonly execution_count_forbidden: true;
}

/**
 * GAP C RUNTIME GUARD: Prevent execution inference
 */
export function assertAutomationRuleCannotBeInferred(
  rule: any
): asserts rule is AutomationRuleWithExecutionDisclosure {
  if (!rule.definition) {
    throw new Error('[PHASE-4-VIOLATION] Missing automation rule definition');
  }
  if (!rule.execution_status) {
    throw new Error('[PHASE-4-VIOLATION] Missing automation execution status disclosure');
  }
  if (rule.execution_status.visibility !== AutomationExecutionVisibility.NOT_YET_MEASURABLE) {
    throw new Error('[PHASE-4-VIOLATION] Phase-4 automation execution MUST be NOT_YET_MEASURABLE');
  }
  if (rule.execution_count_forbidden !== true) {
    throw new Error('[PHASE-4-VIOLATION] Automation execution count extraction is forbidden in Phase-4');
  }
}

/**
 * GAP C: Create automation rule with execution disclosure
 */
export function createAutomationRuleWithExecutionDisclosure(
  rule_id: string,
  rule_name: string,
  enabled: boolean,
  last_modified: string
): AutomationRuleWithExecutionDisclosure {
  return {
    definition: {
      rule_id,
      rule_name,
      enabled,
      last_modified,
      visibility: "VISIBLE",
    },
    execution_status: {
      visibility: AutomationExecutionVisibility.NOT_YET_MEASURABLE,
      reason: AutomationExecutionReason.PHASE_4_METADATA_ONLY,
      disclosure: `Rule is visible and metadata available, but execution data is NOT_YET_MEASURABLE in Phase-4. Rule presence does not indicate usage, health, or execution. Automation execution analysis begins in Phase-5+.`,
      disclosed_at: new Date().toISOString(),
    },
    execution_count_forbidden: true,
  };
}

// ============================================================================
// GAP D: FORECAST IMMUTABILITY ENFORCEMENT
// ============================================================================

/**
 * GAP D: Forecasts MUST always be labeled ESTIMATED
 * Cannot appear factual, must include confidence and disclaimer
 */
export interface ForecastWithMandatoryImmutability {
  /** MUST be "ESTIMATED" - never "PROJECTED", "FORECAST", "LIKELY", etc */
  forecast_type: "ESTIMATED";
  
  /** MUST be present and >= 1 */
  observation_window_days: number;
  
  /** MUST be present */
  confidence_level: ConfidenceLevel;
  
  /** MANDATORY: If window < 7 days, confidence MUST be LOW */
  confidence_window_enforced: boolean;
  
  /** REQUIRED: Cannot be empty, must warn about estimation */
  disclaimer: string;
  
  /** The actual forecast value */
  value: number;
  
  /** When generated */
  generated_at: string;
  
  /** GAP D GUARD: Cannot be modified or aggregated */
  readonly immutable: true;
}

/**
 * GAP D RUNTIME GUARD: Enforce forecast constraints
 */
export function assertValidForecast(
  forecast: any
): asserts forecast is ForecastWithMandatoryImmutability {
  if (forecast.forecast_type !== "ESTIMATED") {
    throw new Error('[PHASE-4-VIOLATION] Forecast type MUST be "ESTIMATED", not implied or projected');
  }
  if (!forecast.observation_window_days || forecast.observation_window_days < 1) {
    throw new Error('[PHASE-4-VIOLATION] Forecast must include observation_window_days >= 1');
  }
  if (!forecast.confidence_level) {
    throw new Error('[PHASE-4-VIOLATION] Forecast must include confidence_level');
  }
  if (forecast.observation_window_days < 7 && forecast.confidence_level !== ConfidenceLevel.LOW) {
    throw new Error('[PHASE-4-VIOLATION] Forecast window < 7 days FORCES confidence_level to LOW');
  }
  if (!forecast.disclaimer || forecast.disclaimer.length === 0) {
    throw new Error('[PHASE-4-VIOLATION] Forecast disclaimer is required and cannot be empty');
  }
  if (!forecast.disclaimer.toLowerCase().includes('estimate')) {
    throw new Error('[PHASE-4-VIOLATION] Forecast disclaimer must explicitly warn about estimation');
  }
  if (forecast.immutable !== true) {
    throw new Error('[PHASE-4-VIOLATION] Forecast must be marked immutable=true');
  }
}

/**
 * GAP D: Create forecast with mandatory enforcement
 */
export function createPhase4Forecast(
  value: number,
  observation_window_days: number
): ForecastWithMandatoryImmutability {
  const confidence = observation_window_days < 7 ? ConfidenceLevel.LOW : ConfidenceLevel.MEDIUM;
  const disclaimer =
    observation_window_days < 7
      ? `ESTIMATED value for exploratory use only. Window is ${observation_window_days} days (< 7). Confidence is LOW. Do not use for critical decisions.`
      : `ESTIMATED value based on Phase-4 metadata. Actual behavior may differ significantly. Do not use for critical decisions.`;

  return {
    forecast_type: "ESTIMATED",
    observation_window_days,
    confidence_level: confidence,
    confidence_window_enforced: true,
    disclaimer,
    value,
    generated_at: new Date().toISOString(),
    immutable: true,
  };
}

// ============================================================================
// GAP E: VERSIONED SCOPE TRANSPARENCY (IMMUTABLE + CHANGELOG)
// ============================================================================

/**
 * GAP E: Scope disclosure CANNOT change without version bump
 * Older versions remain accessible for audit trail
 */
export interface VersionedScopeTransparency {
  /** REQUIRED: Unique version identifier */
  version: string;
  
  /** REQUIRED: When this version was published */
  published_at: string;
  
  /** REQUIRED: Title explaining Phase-4 scope */
  title: string;
  
  /** REQUIRED: Body explaining what Phase-4 does (and what it does NOT do) */
  body: string;
  
  /** REQUIRED: Why metadata is collected before behavior */
  why_metadata_first: string[];
  
  /** OPTIONAL: What explicitly is NOT done in Phase-4 */
  explicit_exclusions?: string[];
  
  /** GUARD: If text changes, version must change */
  readonly immutable_content: true;
}

/**
 * GAP E: Changelog tracks all versions (immutable)
 */
export interface ScopeTransparencyChangeLog {
  /** All versions ever published (append-only) */
  versions: VersionedScopeTransparency[];
  
  /** Most recent version */
  current_version: string;
  
  /** When this changelog was last updated */
  last_updated_at: string;
  
  /** GUARD: Cannot be edited in place */
  readonly changelog_immutable: true;
}

/**
 * GAP E: Get current version or raise error
 */
export function getScopeTransparencyCurrentVersion(
  changelog: ScopeTransparencyChangeLog
): VersionedScopeTransparency {
  const current = changelog.versions.find((v) => v.version === changelog.current_version);
  if (!current) {
    throw new Error(
      `[PHASE-4-VIOLATION] Current version "${changelog.current_version}" not found in changelog`
    );
  }
  return current;
}

/**
 * GAP E: Add new version (append-only, validates version bump)
 */
export function addScopeTransparencyVersion(
  changelog: ScopeTransparencyChangeLog,
  newVersion: VersionedScopeTransparency
): ScopeTransparencyChangeLog {
  const current = getScopeTransparencyCurrentVersion(changelog);

  // Ensure content actually changed
  if (
    newVersion.title === current.title &&
    newVersion.body === current.body &&
    JSON.stringify(newVersion.why_metadata_first) === JSON.stringify(current.why_metadata_first)
  ) {
    throw new Error('[PHASE-4-VIOLATION] Scope text unchanged but new version provided. Version bump requires actual changes.');
  }

  // Ensure version string is different
  if (newVersion.version === current.version) {
    throw new Error('[PHASE-4-VIOLATION] New version string must differ from current version');
  }

  return {
    versions: [...changelog.versions, newVersion],
    current_version: newVersion.version,
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true,
  };
}

// ============================================================================
// GAP F: PHASE-4 BOUNDARY GUARDS
// ============================================================================

/**
 * GAP F: Forbidden Phase-5+ signals
 * If ANY of these are detected in Phase-4 context, fail hard
 */
export enum ForbiddenPhase5Signals {
  TRANSITION_COUNTS = "TRANSITION_COUNTS",
  EXECUTION_COUNTS = "EXECUTION_COUNTS",
  EXECUTION_TRENDS = "EXECUTION_TRENDS",
  TIME_SERIES_DATA = "TIME_SERIES_DATA",
  HYGIENE_SCORES = "HYGIENE_SCORES",
  RECOMMENDATIONS = "RECOMMENDATIONS",
  BEHAVIOR_INFERENCES = "BEHAVIOR_INFERENCES",
  BENCHMARKS = "BENCHMARKS",
  PROJECTIONS = "PROJECTIONS",
}

/**
 * GAP F: Detect and reject Phase-5 behavior signals
 */
export function rejectPhase5Signals(obj: any, context: string = "Phase-4"): void {
  const phase5Keys = [
    'transition_count',
    'execution_count',
    'trending',
    'time_series',
    'hygiene_score',
    'recommendation',
    'behavior_confidence',
    'benchmark',
    'projection',
    'forecast_value',
    'estimated_impact',
  ];

  const checkRecursive = (o: any, path: string = "") => {
    if (o === null || o === undefined) return;

    if (typeof o === "object") {
      for (const key of Object.keys(o)) {
        const lowerKey = key.toLowerCase();

        // Check if key contains Phase-5 signals
        for (const phase5Key of phase5Keys) {
          if (lowerKey.includes(phase5Key)) {
            throw new Error(
              `[PHASE-4-VIOLATION] Detected Phase-5 signal in ${context}: "${key}" at path "${path}". Phase-4 is metadata-only. Behavior analysis begins in Phase-5+.`
            );
          }
        }

        // Recurse
        checkRecursive(o[key], `${path}.${key}`);
      }
    }
  };

  checkRecursive(obj);
}

/**
 * GAP F: Assert we are in Phase-4 context
 */
export function assertPhase4Context(): void {
  if (PHASE !== 4) {
    throw new Error(`[PHASE-4-VIOLATION] Expected PHASE=4, got ${PHASE}`);
  }
}

// ============================================================================
// SUPPORTING ENUMS & TYPES (from previous implementation)
// ============================================================================

export enum ConfidenceLevel {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
}

export enum ZeroValueReason {
  TRUE_ZERO = "TRUE_ZERO",
  INSUFFICIENT_HISTORICAL_WINDOW = "INSUFFICIENT_HISTORICAL_WINDOW",
  MEASUREMENT_NOT_YET_ENABLED = "MEASUREMENT_NOT_YET_ENABLED",
  OUT_OF_SCOPE = "OUT_OF_SCOPE",
}

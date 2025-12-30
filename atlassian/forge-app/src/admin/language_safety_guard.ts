/**
 * LANGUAGE SAFETY GUARD
 * 
 * Prevents accidental editorialization in UI strings.
 * 
 * Design:
 * 1. Define forbidden words/phrases
 * 2. Scan all UI static copy
 * 3. Reject any UI string containing forbidden words EXCEPT when in report-provided text
 */

/**
 * Forbidden words in UI copy.
 * 
 * These indicate the UI is making judgments, inferences, or recommendations.
 * They CANNOT appear in UI static strings.
 * 
 * They CAN appear inside:
 * - report.disclosure_text
 * - reason_detail_text
 * - Stored error messages
 * - Any data coming FROM the report
 */
export const FORBIDDEN_UI_WORDS = [
  'recommend',
  'recommendation',
  'should',
  'improve',
  'improvement',
  'decline',
  'declining',
  'trend',
  'trending',
  'best',
  'worst',
  'health',
  'healthy',
  'unhealthy',
  'score',
  'scoring',
  'benchmark',
  'benchmarking',
  'optimize',
  'optimization',
  'fix',
  'problem',
  'bad',
  'good',
  'excellent',
  'poor',
  'potential issue',
  'potential issues',
  'insight',
  'insights',
  'indicates',
  'implies',
  'infer',
  'suggests',
  'suggests that',
  'this means',
  'this indicates',
  'this shows',
  'so what',
  'compare',
  'comparison',
  'ranking',
  'percentile',
  'execution',
  'transition',
  'hygiene',
  'upgrade',
  'downgrade',
] as const;

/**
 * Check if a UI string contains forbidden words.
 * 
 * This is for static UI copy only.
 * Do NOT use to validate report-provided text.
 * 
 * @param text - UI static string
 * @param context - Where this string appears (for error messages)
 * @throws Error if forbidden word found
 */
export function validateUIStaticString(text: string, context: string): void {
  const lowerText = text.toLowerCase();
  
  for (const word of FORBIDDEN_UI_WORDS) {
    if (lowerText.includes(word)) {
      throw new Error(
        `[LANGUAGE-GUARD] Forbidden word "${word}" found in UI copy at ${context}. ` +
        `UI must be purely a renderer, not an interpreter.`
      );
    }
  }
}

/**
 * Get all static UI strings for validation.
 * 
 * Called at module load time to validate all UI copy.
 */
export const STATIC_UI_STRINGS = {
  // Top banner
  PAGE_TITLE: 'FirstTry Proof-of-Life Report (Phase 5)',
  PAGE_SUBTITLE: 'This report is disclosure-first. It shows what was observed and what is missing. It does not judge Jira quality.',
  
  // Disclosure explanation (in banner)
  CONFIDENCE_EXPLANATION: 'Confidence is based on observation window and completeness; not a quality judgment.',
  
  // Generated at label
  GENERATED_AT_LABEL: 'Generated at',
  TRIGGER_TYPE_LABEL: 'Trigger type',
  OBSERVATION_WINDOW_LABEL: 'Observation window',
  
  // No report state
  NO_REPORT_YET: 'No report generated yet',
  NEXT_ELIGIBILITY: 'AUTO report generates at first scheduler run after 12h/24h. This is periodic, not exact time.',
  
  // Manual generation
  GENERATE_NOW_BUTTON: 'Generate Now',
  GENERATING_STATE: 'Generating…',
  GENERATION_FAILED: 'Generation failed. No report was created.',
  GENERATION_ERROR_CODE: 'Error code:',
  GENERATION_ERROR_AT: 'at',
  
  // Report section headers
  SECTION_A_HEADER: 'A) WHAT WE COLLECTED',
  SECTION_B_HEADER: 'B) COVERAGE DISCLOSURE',
  SECTION_C_HEADER: 'C) PRELIMINARY OBSERVATIONS',
  SECTION_D_HEADER: 'D) FORECAST',
  
  // Section A items
  PROJECTS_SCANNED: 'Projects scanned',
  ISSUES_SCANNED: 'Issues scanned',
  FIELDS_DETECTED: 'Fields detected',
  
  // Disclosure fields (these are labels for report data)
  COMPLETENESS_LABEL: 'Completeness',
  OBSERVATION_WINDOW_SHORT_LABEL: 'Window',
  CONFIDENCE_LEVEL_LABEL: 'Confidence',
  ZERO_SEMANTIC_STATE_LABEL: 'Zero semantic state',
  REASON_LABEL: 'Reason',
  DISCLOSURE_LABEL: 'Disclosure',
  
  // Coverage table headers
  DATASET_NAME_HEADER: 'Dataset name',
  AVAILABILITY_STATE_HEADER: 'Availability state',
  COVERAGE_PERCENT_HEADER: 'Coverage %',
  MISSING_REASON_HEADER: 'Missing reason',
  
  // Forecast section
  FORECAST_AVAILABLE_CHIP: 'ESTIMATED',
  FORECAST_UNAVAILABLE_MESSAGE: 'Forecast unavailable',
  FORECAST_INSUFFICIENT_WINDOW: 'INSUFFICIENT_OBSERVATION_WINDOW',
  FORECAST_DISCLAIMER: 'This forecast is not based on full historical data.',
  
  // Scheduler status panel
  SCHEDULER_STATUS_HEADER: 'Scheduler Status',
  LAST_RUN_AT: 'Last run at',
  AUTO_12H_DONE_AT: 'AUTO_12H done at',
  AUTO_24H_DONE_AT: 'AUTO_24H done at',
  NOT_DONE_YET: 'not done',
  LAST_ERROR_HEADER: 'Last error',
  SCHEDULER_RUNS_PERIODICALLY: 'Runs periodically; generates on first run after threshold.',
  
  // Validation error
  REPORT_VALIDATION_FAILED: 'Stored report failed validation and cannot be displayed.',
  REPORT_VALIDATION_ERROR_CODE: 'Error code:',
  
  // Load error (generic)
  LOAD_ERROR_GENERIC: 'Unable to load data. Please refresh or contact support.',
  
  // Tenant context error
  TENANT_CONTEXT_ERROR: 'Tenant context unavailable. Please try again.',
} as const;

/**
 * Validate all static UI strings at module load.
 */
export function validateAllStaticUIStrings(): void {
  for (const [key, value] of Object.entries(STATIC_UI_STRINGS)) {
    if (typeof value === 'string') {
      validateUIStaticString(value, `STATIC_UI_STRINGS.${key}`);
    }
  }
}

// Run validation at module load (in Node.js environment only)
if (typeof window === 'undefined') {
  // Running in Node.js (server-side) - safe to validate
  validateAllStaticUIStrings();
}

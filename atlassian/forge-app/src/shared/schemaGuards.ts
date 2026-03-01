/**
 * schemaGuards.ts — Fail-closed schema validation for audit-critical paths
 * 
 * Purpose: Eliminate silent failures from default fallbacks (|| [], || {}, || 0).
 * Required fields throw on missing data. Optional fields track degradation.
 * 
 * Design: Deterministic error messages with FT_SCHEMA_REQUIRED_MISSING prefix.
 * No timestamps, no randomness, no external dependencies.
 */

export interface GuardReport {
  missingData: string[];
  warnings: string[];
  degraded: boolean;
}

export function createGuardReport(): GuardReport {
  return {
    missingData: [],
    warnings: [],
    degraded: false,
  };
}

export function addMissing(report: GuardReport, path: string, msg: string): void {
  const entry = `${path}: ${msg}`;
  if (!report.missingData.includes(entry)) {
    report.missingData.push(entry);
  }
  report.degraded = true;
}

export function addWarning(report: GuardReport, path: string, msg: string): void {
  const entry = `${path}: ${msg}`;
  if (!report.warnings.includes(entry)) {
    report.warnings.push(entry);
  }
}

/**
 * requireString — Require non-empty string, throw on missing
 */
export function requireString(
  obj: any,
  path: string,
  report: GuardReport
): string {
  if (obj === undefined || obj === null) {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is undefined or null`);
  }
  if (typeof obj !== 'string') {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is not a string (got ${typeof obj})`);
  }
  if (obj.trim() === '') {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is empty string`);
  }
  return obj;
}

/**
 * requireObject — Require non-null object, throw on missing
 */
export function requireObject(
  obj: any,
  path: string,
  report: GuardReport
): Record<string, any> {
  if (obj === undefined || obj === null) {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is undefined or null`);
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is not an object (got ${typeof obj})`);
  }
  return obj;
}

/**
 * requireArray — Require array, throw on missing
 */
export function requireArray(
  obj: any,
  path: string,
  report: GuardReport
): any[] {
  if (obj === undefined || obj === null) {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is undefined or null`);
  }
  if (!Array.isArray(obj)) {
    throw new Error(`FT_SCHEMA_REQUIRED_MISSING: ${path} is not an array (got ${typeof obj})`);
  }
  return obj;
}

/**
 * optString — Optional string with default, track missing data
 */
export function optString(
  obj: any,
  path: string,
  report: GuardReport,
  defaultValue: string = ''
): string {
  if (obj === undefined || obj === null) {
    addMissing(report, path, 'missing (defaulted to empty string)');
    return defaultValue;
  }
  if (typeof obj !== 'string') {
    addMissing(report, path, `not a string (got ${typeof obj}, defaulted to empty string)`);
    return defaultValue;
  }
  return obj;
}

/**
 * optObject — Optional object with default, track missing data
 */
export function optObject(
  obj: any,
  path: string,
  report: GuardReport,
  defaultValue: Record<string, any> = {}
): Record<string, any> {
  if (obj === undefined || obj === null) {
    addMissing(report, path, 'missing (defaulted to empty object)');
    return defaultValue;
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    addMissing(report, path, `not an object (got ${typeof obj}, defaulted to empty object)`);
    return defaultValue;
  }
  return obj;
}

/**
 * optArray — Optional array with default, track missing data
 */
export function optArray(
  obj: any,
  path: string,
  report: GuardReport,
  defaultValue: any[] = []
): any[] {
  if (obj === undefined || obj === null) {
    addMissing(report, path, 'missing (defaulted to empty array)');
    return defaultValue;
  }
  if (!Array.isArray(obj)) {
    addMissing(report, path, `not an array (got ${typeof obj}, defaulted to empty array)`);
    return defaultValue;
  }
  return obj;
}

/**
 * optNumber — Optional number with default, track missing data
 */
export function optNumber(
  obj: any,
  path: string,
  report: GuardReport,
  defaultValue: number = 0
): number {
  if (obj === undefined || obj === null) {
    addMissing(report, path, 'missing (defaulted to 0)');
    return defaultValue;
  }
  if (typeof obj !== 'number' || isNaN(obj)) {
    addMissing(report, path, `not a number (got ${typeof obj}, defaulted to 0)`);
    return defaultValue;
  }
  return obj;
}

/**
 * getSummary — Get deterministic summary of schema degradation
 */
export function getSummary(report: GuardReport): {
  degraded: boolean;
  missing_count: number;
  missing_sample: string[];
  warnings_count: number;
} {
  // Sort for determinism
  const sortedMissing = [...report.missingData].sort();
  const sortedWarnings = [...report.warnings].sort();
  
  return {
    degraded: report.degraded,
    missing_count: sortedMissing.length,
    missing_sample: sortedMissing.slice(0, 10),
    warnings_count: sortedWarnings.length,
  };
}

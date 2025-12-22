/**
 * P1.3: EXPORT TRUTH GUARANTEE
 *
 * Requires complete and verifiable data exports with metadata that warns about incomplete data.
 *
 * Requirements:
 * - Export schema version (breaking changes must bump version)
 * - Metadata: generatedAt timestamp, snapshotAge, completenessStatus
 * - Missing data tracking: list what data is incomplete or missing
 * - Confidence level: how confident are we in the data?
 * - Warnings: if data is incomplete, export must warn explicitly
 * - Backward compatibility: old export consumers must know format version
 *
 * Schema (ExportV1):
 * {
 *   schemaVersion: "1.0",
 *   generatedAt: "2024-12-20T05:00:00Z",
 *   snapshotAge: { days: 0, hours: 2, minutes: 34 },
 *   completenessStatus: "complete" | "partial" | "incomplete",
 *   missingDataList: [
 *     { category: "raw_events", reason: "storage_timeout", count: 42 },
 *     { category: "daily_aggregates", reason: "computation_failed", date: "2024-12-19" }
 *   ],
 *   confidenceLevel: 0.95, // 0-1
 *   warnings: [
 *     "⚠️ Missing 42 raw events (storage timeout on 2024-12-20 02:15 UTC)",
 *     "⚠️ Confidence level 95% (typical 99%)"
 *   ],
 *   data: { ...actual exported data... }
 * }
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Export schema version
 * Increment when making breaking changes to export format
 */
export const EXPORT_SCHEMA_VERSION = '1.0';

/**
 * Completeness status
 */
export type CompletenessStatus = 'complete' | 'partial' | 'incomplete';

/**
 * Missing data entry
 */
export interface MissingDataEntry {
  category: string; // raw_events, daily_aggregates, weekly_aggregates, etc.
  reason: string; // storage_timeout, computation_failed, access_denied, etc.
  count?: number; // How many items missing
  date?: string; // ISO date (for time-specific issues)
  details?: string; // Additional context
}

/**
 * Export metadata (required for every export)
 */
export interface ExportMetadata {
  schemaVersion: string; // For backward compatibility
  generatedAt: string; // ISO timestamp
  snapshotAge: {
    days: number;
    hours: number;
    minutes: number;
  };
  completenessStatus: CompletenessStatus;
  missingDataList: MissingDataEntry[];
  confidenceLevel: number; // 0-1, where 1 = 100% confidence
  warnings: string[]; // Human-readable warnings
}

/**
 * Full export with metadata
 */
export interface DataExportV1<T = any> {
  metadata: ExportMetadata;
  data: T;
}

/**
 * Calculate snapshot age from generatedAt to now
 */
export function calculateSnapshotAge(generatedAt: string): {
  days: number;
  hours: number;
  minutes: number;
} {
  const generated = new Date(generatedAt);
  const now = new Date();
  const diffMs = now.getTime() - generated.getTime();

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(diffMins / (24 * 60));
  const hours = Math.floor((diffMins % (24 * 60)) / 60);
  const minutes = diffMins % 60;

  return { days, hours, minutes };
}

/**
 * Determine completeness status based on missing data
 */
export function determineCompletenessStatus(
  missingDataList: MissingDataEntry[]
): CompletenessStatus {
  if (missingDataList.length === 0) {
    return 'complete';
  }

  const totalMissing = missingDataList.reduce((sum, entry) => sum + (entry.count || 1), 0);
  if (totalMissing > 100) {
    return 'incomplete';
  }

  return 'partial';
}

/**
 * Calculate confidence level
 *
 * Confidence decreases based on:
 * - Missing data (each missing item reduces confidence)
 * - Age of snapshot (older = less confident)
 * - Failed operations (compute errors, timeouts)
 */
export function calculateConfidenceLevel(
  missingDataList: MissingDataEntry[],
  snapshotAge: { days: number; hours: number; minutes: number }
): number {
  let confidence = 1.0;

  // Missing data penalty
  const totalMissing = missingDataList.reduce((sum, entry) => sum + (entry.count || 1), 0);
  confidence -= Math.min(0.3, totalMissing * 0.001); // Max 30% penalty

  // Age penalty (older exports are less confident)
  const ageHours = snapshotAge.days * 24 + snapshotAge.hours;
  if (ageHours > 24) {
    confidence -= Math.min(0.1, (ageHours - 24) * 0.001); // Max 10% penalty
  }

  // Error penalty (if any errors occurred)
  const hasErrors = missingDataList.some(entry =>
    ['storage_timeout', 'computation_failed', 'access_denied'].includes(entry.reason)
  );
  if (hasErrors) {
    confidence -= 0.05;
  }

  return Math.max(0, Math.min(1, confidence)); // Clamp to [0, 1]
}

/**
 * Generate warning messages based on missing data and confidence
 */
export function generateWarnings(
  missingDataList: MissingDataEntry[],
  confidenceLevel: number,
  generatedAt: string
): string[] {
  const warnings: string[] = [];

  // Warnings for missing data
  for (const entry of missingDataList) {
    const count = entry.count ? ` (${entry.count} items)` : '';
    const date = entry.date ? ` on ${entry.date}` : '';
    warnings.push(
      `⚠️ Missing ${entry.category}${count}: ${entry.reason}${date}`
    );
  }

  // Warning if confidence is low
  if (confidenceLevel < 0.9) {
    warnings.push(
      `⚠️ Confidence level: ${Math.round(confidenceLevel * 100)}% (typical: 99%)`
    );
  }

  // Warning if snapshot is old
  const age = calculateSnapshotAge(generatedAt);
  if (age.days > 0) {
    warnings.push(
      `⚠️ Snapshot is ${age.days}d ${age.hours}h old`
    );
  }

  return warnings;
}

/**
 * Create export metadata
 */
export function createExportMetadata(
  missingDataList: MissingDataEntry[] = [],
  generatedAt: string = new Date().toISOString()
): ExportMetadata {
  const snapshotAge = calculateSnapshotAge(generatedAt);
  const completenessStatus = determineCompletenessStatus(missingDataList);
  const confidenceLevel = calculateConfidenceLevel(missingDataList, snapshotAge);
  const warnings = generateWarnings(missingDataList, confidenceLevel, generatedAt);

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt,
    snapshotAge,
    completenessStatus,
    missingDataList,
    confidenceLevel,
    warnings,
  };
}

/**
 * Create complete export with metadata
 */
export function createDataExport<T>(
  data: T,
  missingDataList: MissingDataEntry[] = []
): DataExportV1<T> {
  return {
    metadata: createExportMetadata(missingDataList),
    data,
  };
}

/**
 * Validate export schema
 */
export function validateExportSchema(exportData: any): boolean {
  if (!exportData.metadata) {
    throw new Error('Export missing metadata');
  }

  const metadata = exportData.metadata;

  if (!metadata.schemaVersion) {
    throw new Error('Metadata missing schemaVersion');
  }

  if (!metadata.generatedAt) {
    throw new Error('Metadata missing generatedAt');
  }

  if (!metadata.snapshotAge || typeof metadata.snapshotAge.days !== 'number') {
    throw new Error('Metadata invalid snapshotAge');
  }

  if (!['complete', 'partial', 'incomplete'].includes(metadata.completenessStatus)) {
    throw new Error('Metadata invalid completenessStatus');
  }

  if (!Array.isArray(metadata.missingDataList)) {
    throw new Error('Metadata missingDataList must be array');
  }

  if (typeof metadata.confidenceLevel !== 'number' || metadata.confidenceLevel < 0 || metadata.confidenceLevel > 1) {
    throw new Error('Metadata confidenceLevel must be number between 0 and 1');
  }

  if (!Array.isArray(metadata.warnings)) {
    throw new Error('Metadata warnings must be array');
  }

  if (!exportData.data) {
    throw new Error('Export missing data field');
  }

  return true;
}

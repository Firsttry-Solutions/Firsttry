/**
 * MILESTONE 1 ENGINE 6G: Platform Feature Detection
 * 
 * Output:
 * {
 *   "platformFeatures": {
 *     "fieldSchemeModel": "LEGACY" | "NEW",
 *     "detectedAtUtc": "..."
 *   }
 * }
 * 
 * Determinism:
 * - detectedAtUtc must equal snapshot.createdAtUtc (NOT current time)
 * 
 * Maps into snapshot.platformFeatureFlags with stable shape
 */

import api from '@forge/api';
import type { PlatformFeatures, Snapshot } from '../models';
import { canonicalizeValue } from '../canonicalize';

type FieldSchemeModel = 'LEGACY' | 'NEW';

/**
 * Detect field scheme model from Jira API
 * 
 * NEW model: Jira has migrated to new field scheme system
 * LEGACY model: Using old field scheme system
 */
async function detectFieldSchemeModel(): Promise<FieldSchemeModel> {
  try {
    // Query field configuration schemes
    // If endpoint returns new schema structure -> NEW
    // Otherwise -> LEGACY
    
    const fieldsRes = await api
      .asUser()
      .requestJira('/rest/api/3/fieldconfiguration/groups');
    
    // If we get a response with new-style structure, it's NEW
    // Otherwise assume LEGACY
    if (fieldsRes && typeof fieldsRes === 'object') {
      // Check for new-style response structure
      if ('values' in fieldsRes || 'paginated' in fieldsRes) {
        return 'NEW';
      }
    }
    
    return 'LEGACY';
  } catch (err) {
    console.warn('[PlatformFeatureEngine] Could not detect field scheme model:', err);
    // Default to LEGACY if we can't detect
    return 'LEGACY';
  }
}

/**
 * Build platform features detection report
 * 
 * Important: detectedAtUtc must equal the snapshot's createdAtUtc, NOT current time
 */
export async function buildPlatformFeaturesReport(
  snapshotId: string,
  createdAtUtc: string // Must use snapshot's createdAtUtc, not Date.now()
): Promise<PlatformFeatures> {
  try {
    const fieldSchemeModel = await detectFieldSchemeModel();

    // Canonicalize
    const canonicalFeatures = canonicalizeValue({
      fieldSchemeModel,
      detectedAtUtc: createdAtUtc, // MUST be snapshot's timestamp, not current
    });

    const features: PlatformFeatures = {
      snapshotId,
      createdAtUtc,
      platformFeatures: canonicalFeatures as any,
    };

    return features;
  } catch (error) {
    console.error('[PlatformFeatureEngine] Error building platform features report:', error);
    throw error;
  }
}

/**
 * Extract platform feature flags for snapshot
 * Maps platformFeatures into snapshot.platformFeatureFlags
 */
export function extractPlatformFeatureFlags(features: PlatformFeatures): Snapshot['platformFeatureFlags'] {
  return {
    fieldSchemeModel: features.platformFeatures.fieldSchemeModel,
    detectedAtUtc: features.platformFeatures.detectedAtUtc,
  };
}

/**
 * Validate platform features report
 */
export function validatePlatformFeaturesReport(report: PlatformFeatures): boolean {
  if (!report.snapshotId || !report.createdAtUtc || !report.platformFeatures) {
    return false;
  }

  const pf = report.platformFeatures;
  if (!['LEGACY', 'NEW'].includes(pf.fieldSchemeModel) || !pf.detectedAtUtc) {
    return false;
  }

  // detectedAtUtc must equal createdAtUtc (for determinism)
  if (pf.detectedAtUtc !== report.createdAtUtc) {
    return false;
  }

  return true;
}

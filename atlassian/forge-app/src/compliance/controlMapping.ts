/**
 * // FT_ECL_PHASE: ECL-7 CONTROL_MAPPING_STATIC
 *
 * Static-only mapping table.
 * - No runtime generation.
 * - No certification claims.
 * - Explanations are generic and factual.
 */

export const _ECL7_MAPPING_VERSION = 'v1' as const;

/**
 * DriftCategory:
 * Use the system's real drift categories if you already export them elsewhere.
 * If not available, keep this minimal and ONLY map categories that exist in your UI findings.
 *
 * NOTE: This file is static-only and may be refined to match real categories as they evolve.
 */
export type DriftCategory = string;

export type ControlMapping = Readonly<{
  control: string;
  explanation: string;
}>;

/**
 * DRIFT_TO_SOC2:
 * Static mapping from drift category -> SOC 2 style control reference.
 * Mapping is by static rule only; NOT a certification claim.
 *
 * Deterministic ordering by declaration.
 */
export const DRIFT_TO_SOC2: Readonly<Record<string, ControlMapping>> = Object.freeze({
  // Example categories — KEEP ONLY THOSE THAT EXIST IN YOUR SYSTEM OUTPUTS.
  // If unsure, prefer fewer entries and let UI show "Unmapped" for everything else.
  'PERMISSION_CHANGE': Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
  'ADMIN_GRANTED':      Object.freeze({ control: 'CC6.2', explanation: 'Mapped by static rule.' }),
  'ADMIN_REVOKED':      Object.freeze({ control: 'CC6.2', explanation: 'Mapped by static rule.' }),
  'PROJECT_VISIBILITY': Object.freeze({ control: 'CC6.3', explanation: 'Mapped by static rule.' }),
  'GROUP_MEMBERSHIP':   Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
});

/**
 * REVIEWFAIL_TO_ISO27001:
 * Static mapping from reviewer-style finding -> ISO/IEC 27001 Annex A reference.
 * Mapping is by static rule only; NOT a certification claim.
 *
 * Deterministic ordering by declaration.
 */
export const REVIEWFAIL_TO_ISO27001: Readonly<Record<string, ControlMapping>> = Object.freeze({
  // Use keys that your UI actually displays for reviewer findings (if any).
  'NO_OUTBOUND_NETWORKING': Object.freeze({ control: 'A.8.24', explanation: 'Mapped by static rule.' }),
  'NO_SCOPE_CHANGES':      Object.freeze({ control: 'A.5.1',  explanation: 'Mapped by static rule.' }),
  'NO_SECRET_IN_SOURCE':   Object.freeze({ control: 'A.8.12', explanation: 'Mapped by static rule.' }),
  'READ_ONLY_APP':         Object.freeze({ control: 'A.8.9',  explanation: 'Mapped by static rule.' }),
  'AUDIT_LOG_INTEGRITY':   Object.freeze({ control: 'A.8.15', explanation: 'Mapped by static rule.' }),
  'CHANGE_CONTROL':        Object.freeze({ control: 'A.8.32', explanation: 'Mapped by static rule.' }),
});

export const _ECL7_END = 'FT_ECL_PHASE_END:ECL-7' as const;

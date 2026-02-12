/**
 * Transparent Risk Score v1 - PHASE 1
 * 
 * CRITICAL: All weights and formulas are exposed.
 * NO HIDDEN LOGIC.
 * 
 * Risk Formula:
 * finalRiskScore = (adminDensity * 40) + (externalExposureScore * 5) + (toxicHitCount * 3) + (publicProjectCount * 2)
 * 
 * Risk Tiers:
 * 0-20: LOW
 * 21-50: MEDIUM
 * 51+: HIGH
 */

import { AccessSurfaceSnapshot } from './types';

// TRANSPARENT WEIGHT CONSTANTS (all exposed)
export const RISK_WEIGHTS = {
  ADMIN_DENSITY: 40,
  EXTERNAL_EXPOSURE: 5,
  TOXIC_HITS: 3,
  PUBLIC_PROJECTS: 2,
} as const;

export const RISK_THRESHOLDS = {
  LOW: { min: 0, max: 20 },
  MEDIUM: { min: 21, max: 50 },
  HIGH: { min: 51, max: Infinity },
} as const;

export type RiskTier = 'low' | 'medium' | 'high';

export interface RiskCalculation {
  adminDensity: number;
  adminDensityScore: number;
  externalExposureScore: number;
  externalExposureScoreComponent: number;
  toxicHitCount: number;
  toxicHitScore: number;
  publicProjectCount: number;
  publicProjectScore: number;
  finalRiskScore: number;
  riskTier: RiskTier;
  explanation: string;
}

/**
 * Calculate risk score with full transparency
 * Shows breakdown of each component
 */
export function calculateRiskScore(snapshot: AccessSurfaceSnapshot): RiskCalculation {
  // Component 1: Admin Density
  // Calculate percentage of users who are global admins
  const adminCount = snapshot.exposure.globalAdmins.length;
  const totalUsers = snapshot.totals.totalUsers;
  const adminDensity = totalUsers > 0 ? (adminCount / totalUsers) * 100 : 0;
  const adminDensityScore = adminDensity * RISK_WEIGHTS.ADMIN_DENSITY;

  // Component 2: External Exposure Score
  // Count of external users with elevated privileges
  const externalExposureScore = snapshot.exposure.externalElevatedUsers.length;
  const externalExposureScoreComponent = externalExposureScore * RISK_WEIGHTS.EXTERNAL_EXPOSURE;

  // Component 3: Toxic Findings
  // Count of detected access antipatterns
  const toxicHitCount = snapshot.toxicFindings.length;
  const toxicHitScore = toxicHitCount * RISK_WEIGHTS.TOXIC_HITS;

  // Component 4: Public Projects
  // Count of publicly accessible projects
  const publicProjectCount = snapshot.exposure.publicProjects.length;
  const publicProjectScore = publicProjectCount * RISK_WEIGHTS.PUBLIC_PROJECTS;

  // Final Score (sum of all weighted components)
  const finalRiskScore =
    adminDensityScore +
    externalExposureScoreComponent +
    toxicHitScore +
    publicProjectScore;

  // Determine risk tier
  const riskTier = determineRiskTier(finalRiskScore);

  // Generate human-readable explanation
  const explanation = generateRiskExplanation(
    adminDensity,
    adminCount,
    totalUsers,
    externalExposureScore,
    toxicHitCount,
    publicProjectCount,
    finalRiskScore,
    riskTier
  );

  return {
    adminDensity: parseFloat(adminDensity.toFixed(2)),
    adminDensityScore: parseFloat(adminDensityScore.toFixed(2)),
    externalExposureScore,
    externalExposureScoreComponent,
    toxicHitCount,
    toxicHitScore,
    publicProjectCount,
    publicProjectScore,
    finalRiskScore: parseFloat(finalRiskScore.toFixed(2)),
    riskTier,
    explanation,
  };
}

function determineRiskTier(score: number): RiskTier {
  if (score <= RISK_THRESHOLDS.LOW.max) {
    return 'low';
  } else if (score <= RISK_THRESHOLDS.MEDIUM.max) {
    return 'medium';
  } else {
    return 'high';
  }
}

function generateRiskExplanation(
  adminDensity: number,
  adminCount: number,
  totalUsers: number,
  externalElevated: number,
  toxicHits: number,
  publicProjects: number,
  finalScore: number,
  tier: RiskTier
): string {
  const components: string[] = [];

  // Admin density explanation
  if (adminDensity > 5) {
    components.push(
      `${adminDensity.toFixed(1)}% of users (${adminCount}/${totalUsers}) are global admins (threshold: 5%)`
    );
  }

  // External exposure explanation
  if (externalElevated > 0) {
    components.push(`${externalElevated} external user(s) with elevated privileges`);
  }

  // Toxic findings explanation
  if (toxicHits > 0) {
    components.push(`${toxicHits} access antipattern(s) detected`);
  }

  // Public projects explanation
  if (publicProjects > 0) {
    components.push(`${publicProjects} public project(s)`);
  }

  const tierLabel = tier.toUpperCase();
  const componentText = components.length > 0
    ? ` Contributing factors: ${components.join('; ')}.`
    : '';

  return `Risk Score: ${finalScore} [${tierLabel}].${componentText}`;
}

/**
 * Format risk tier for display
 */
export function formatRiskTier(tier: RiskTier): string {
  const icons = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
  };
  return `${icons[tier]} ${tier.toUpperCase()}`;
}

/**
 * Get detailed weight documentation
 */
export function getWeightDocumentation(): string {
  return `
# Risk Score Weight Documentation

## Formula
finalRiskScore = (adminDensity * ${RISK_WEIGHTS.ADMIN_DENSITY}) + (externalExposure * ${RISK_WEIGHTS.EXTERNAL_EXPOSURE}) + (toxicHits * ${RISK_WEIGHTS.TOXIC_HITS}) + (publicProjects * ${RISK_WEIGHTS.PUBLIC_PROJECTS})

## Component Weights

### Admin Density (Weight: ${RISK_WEIGHTS.ADMIN_DENSITY})
- Metric: Percentage of users with global admin privileges
- Calculation: (globalAdmins / totalUsers) * 100
- Rationale: Excessive admin concentration increases risk of privilege abuse
- Threshold: > 5% triggers medium findings

### External Elevation (Weight: ${RISK_WEIGHTS.EXTERNAL_EXPOSURE})
- Metric: Count of external users with elevated privileges
- Calculation: Count of external users in globalAdmins or projectAdmins
- Rationale: External accounts pose higher compromise risk
- Threshold: Any count above 0 is concerning

### Toxic Findings (Weight: ${RISK_WEIGHTS.TOXIC_HITS})
- Metric: Count of detected access antipatterns
- Calculation: Length of toxicFindings array
- Rationale: Pre-identified patterns indicate known risks
- Threshold: Each finding adds risk

### Public Projects (Weight: ${RISK_WEIGHTS.PUBLIC_PROJECTS})
- Metric: Count of publicly accessible projects
- Calculation: Count of projects with isPrivate=false
- Rationale: Public projects expose issues to all authenticated users
- Threshold: Each project adds small but cumulative risk

## Risk Tiers

### LOW (0-20)
- Minimal risk exposure
- Recommended actions: Monitor and maintain current controls

### MEDIUM (21-50)
- Elevated risk requiring attention
- Recommended actions: Review admin assignments, limit public projects

### HIGH (51+)
- Critical risk requiring immediate remediation
- Recommended actions: Urgent privilege review, external audit recommended
`;
}

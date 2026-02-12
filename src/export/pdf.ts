/**
 * Executive PDF Report Generator - PHASE 1
 * 
 * Generates a deterministic 1-page PDF summary containing:
 * - Title: "Jira Access Governance Summary"
 * - Total Users
 * - Global Admin Count
 * - External Elevated Users
 * - Toxic Findings Summary
 * - Risk Score Tier (0-20: Low, 21-50: Medium, 51+: High)
 * - Footer: Canonical hash for verification
 */

import { AccessSurfaceSnapshot } from './types';
import { calculateRiskScore, formatRiskTier } from './risk';

/**
 * Generate deterministic executive PDF as Buffer
 * Note: Production implementation would use a PDF library (e.g., PDFKit)
 * For Phase 1, we generate a text-based structure that can be converted to PDF
 */
export async function generateExecutivePDF(snapshot: AccessSurfaceSnapshot): Promise<Buffer> {
  const riskCalc = calculateRiskScore(snapshot);

  const pdfContent = generatePDFContent(snapshot, riskCalc);

  // In production, this would use a PDF library like PDFKit to create actual PDF
  // For Phase 1, return UTF-8 encoded content that represents the PDF structure
  return Buffer.from(pdfContent, 'utf8');
}

function generatePDFContent(snapshot: AccessSurfaceSnapshot, riskCalc: any): string {
  const lines: string[] = [];

  // PDF Header (would be binary in real PDF)
  lines.push('%PDF-1.4');
  lines.push('%PHASE1-EXECUTIVE-REPORT');
  lines.push('');

  // Title
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  JIRA ACCESS GOVERNANCE SUMMARY');
  lines.push('  FirstTry Access Intelligence Engine v1');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  // Report Metadata
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Schema Version: ${snapshot.schemaVersion}`);
  lines.push(`Build: ${snapshot.buildShaShort} (${snapshot.buildUtc})`);
  lines.push(`Site ID: ${snapshot.siteId}`);
  lines.push('');

  // Section 1: User Statistics
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('USER STATISTICS');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`Total Users:           ${snapshot.totals.totalUsers}`);
  lines.push(`Active Users:          ${snapshot.totals.activeUsers}`);
  lines.push(`External Users:        ${snapshot.totals.externalUsers}`);
  lines.push('');

  // Section 2: Admin Analysis
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('ADMIN ANALYSIS');
  lines.push('───────────────────────────────────────────────────────────');
  const adminCount = snapshot.exposure.globalAdmins.length;
  const adminPercentage = snapshot.totals.totalUsers > 0
    ? ((adminCount / snapshot.totals.totalUsers) * 100).toFixed(1)
    : '0.0';
  lines.push(`Global Admin Count:    ${adminCount}`);
  lines.push(`Admin Density:         ${adminPercentage}%`);
  lines.push(`Project Admin Groups:  ${Object.keys(snapshot.exposure.projectAdmins).length} projects`);
  lines.push('');

  // Section 3: External Access
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('EXTERNAL ACCESS');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`External Elevated:     ${snapshot.exposure.externalElevatedUsers.length} user(s)`);
  lines.push(`Public Projects:       ${snapshot.exposure.publicProjects.length} project(s)`);
  lines.push('');

  // Section 4: Toxic Findings
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('ACCESS ANTIPATTERNS DETECTED');
  lines.push('───────────────────────────────────────────────────────────');
  if (snapshot.toxicFindings.length === 0) {
    lines.push('No toxic findings detected.');
  } else {
    snapshot.toxicFindings.forEach((finding, idx) => {
      lines.push(`  ${idx + 1}. [${finding.severity.toUpperCase()}] ${finding.ruleId}`);
      lines.push(`     ${finding.explanation.substring(0, 60)}...`);
    });
  }
  lines.push('');

  // Section 5: Risk Assessment
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('RISK ASSESSMENT');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Risk Score:            ${riskCalc.finalRiskScore}`);
  lines.push(`Risk Tier:             ${riskCalc.riskTier.toUpperCase()}`);
  lines.push('');

  // Risk Tier Definition
  lines.push('RISK TIER DEFINITIONS:');
  lines.push('  LOW      (0-20)   Minimal risk, maintain current controls');
  lines.push('  MEDIUM  (21-50)   Requires attention and review');
  lines.push('  HIGH    (51+)     Critical, immediate remediation needed');
  lines.push('');

  // Risk Components Breakdown
  lines.push('SCORE BREAKDOWN:');
  lines.push(`  Admin Density:       ${riskCalc.adminDensityScore} points (${riskCalc.adminDensity}% density)`);
  lines.push(`  External Exposure:   ${riskCalc.externalExposureScoreComponent} points (${riskCalc.externalExposureScore} accounts)`);
  lines.push(`  Toxic Findings:      ${riskCalc.toxicHitScore} points (${riskCalc.toxicHitCount} issues)`);
  lines.push(`  Public Projects:     ${riskCalc.publicProjectScore} points (${riskCalc.publicProjectCount} projects)`);
  lines.push('');

  // Recommendations
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('RECOMMENDATIONS');
  lines.push('───────────────────────────────────────────────────────────');

  if (riskCalc.riskTier === 'high') {
    lines.push('URGENT: Risk score indicates critical exposure.');
    lines.push('  • Schedule immediate access audit');
    lines.push('  • Review all global admin assignments');
    lines.push('  • Restrict external user access');
    lines.push('  • Consider external security assessment');
  } else if (riskCalc.riskTier === 'medium') {
    lines.push('ACTION REQUIRED: Moderate risk detected.');
    lines.push('  • Review admin group membership');
    lines.push('  • Evaluate public project necessity');
    lines.push('  • Monitor external account usage');
    lines.push('  • Address identified antipatterns');
  } else {
    lines.push('MAINTAIN: Risk is currently within acceptable parameters.');
    lines.push('  • Continue regular access reviews');
    lines.push('  • Monitor for changes in utilization');
    lines.push('  • Maintain least-privilege practices');
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('VERIFICATION');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Canonical Hash: ${snapshot.canonicalHash}`);
  lines.push('');
  lines.push('This report is generated by FirstTry Access Intelligence v1.');
  lines.push('All data is sourced from read-only Jira APIs.');
  lines.push('No user data is stored outside Atlassian Forge storage.');
  lines.push('');
  lines.push('To verify this export has not been tampered with, run:');
  lines.push('  node verify.js');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('END OF REPORT');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\\n');
}

/**
 * Helper: Generate risk summary for PDF footer
 */
export function generateRiskSummary(riskScore: number): string {
  if (riskScore <= 20) {
    return 'LOW RISK';
  } else if (riskScore <= 50) {
    return 'MEDIUM RISK';
  } else {
    return 'HIGH RISK';
  }
}

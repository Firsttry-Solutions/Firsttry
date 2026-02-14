/**
 * FirstTry Phase 3 — Compliance Control Mapping
 * 
 * Generates evidence artifacts for access review workflows aligned with:
 * - SOC 2 CC6.7 (Change Management & Segregation of Duties)
 * - NIST 800-53 AC-2 (Account Management)
 * - ISO 27001 A.9.2 (User Access Management)
 *
 * CRITICAL:
 * - DO NOT claim certification
 * - DO NOT claim compliance
 * - Only generate evidence artifacts for control alignment
 * - Include reviewId + snapshotHash for traceability
 */

import { ReviewWorkflow } from "../access-review/types";

/**
 * Compliance control evidence structure
 */
export interface ComplianceEvidence {
  generatedAt: string;
  schemaVersion: string;
  reviewId: string;
  snapshotHash: string;

  // SOC 2 — CC6.7: Change Management
  soc2_cc6_7: {
    description: "Demonstrates periodic review of logical system access rights (SOC 2 CC6.7)";
    controlId: "CC6.7";
    controlName: "Change Management";
    framework: "SOC 2";
    evidenceArtifacts: string[]; // Files in export pack: review-manifest.json, access-review.csv, etc.
    reviewId: string;
    snapshotHash: string;
    timestamp: string;
  };

  // NIST 800-53 — AC-2: Account Management
  nist_800_53_ac2: {
    description: "Account management – review of user privileges (NIST SP 800-53 AC-2(2))";
    controlId: "AC-2(2)";
    controlName: "Account Management";
    framework: "NIST SP 800-53";
    evidenceArtifacts: string[]; // Files in export pack
    reviewId: string;
    completionTime?: string;
  };

  // ISO 27001 — A.9.2: User Access Management
  iso_27001_a9_2: {
    description: "User access management – periodic review of access rights (ISO/IEC 27001 Annex A 9.2)";
    controlId: "A.9.2";
    controlName: "User Access Management";
    framework: "ISO/IEC 27001";
    evidenceArtifacts: string[]; // Files in export pack
    reviewId: string;
    snapshotHash: string;
    riskProfile: {
      highRiskItems: number;
      mediumRiskItems: number;
      lowRiskItems: number;
    };
  };

  // General metadata
  disclaimers: string[];
}

/**
 * ComplianceEvidenceGenerator: Create evidence artifacts (NOT certifications)
 */
export class ComplianceEvidenceGenerator {
  static readonly SCHEMA_VERSION = "3.0.0";

  /**
   * Generate compliance evidence from closed review workflow
   * 
   * Fail-closed: Must be closed
   */
  static generateEvidence(workflow: ReviewWorkflow, testGeneratedAt?: string): ComplianceEvidence {
    if (workflow.status !== "closed") {
      throw new Error(
        "FAIL_CLOSED: Cannot generate compliance evidence for open review"
      );
    }

    if (!workflow.closedAt) {
      throw new Error("FAIL_CLOSED: Review missing closedAt timestamp");
    }

    const exportPackFiles = [
      "review-manifest.json",
      "review-summary.json",
      "access-review.csv",
      "exceptions.csv",
      "snapshot-hash.txt",
    ];

    const riskProfile = {
      highRiskItems: 0,
      mediumRiskItems: 0,
      lowRiskItems: 0,
    };

    for (const item of Object.values(workflow.items)) {
      if (item.riskLevel === "high") {
        riskProfile.highRiskItems++;
      } else if (item.riskLevel === "medium") {
        riskProfile.mediumRiskItems++;
      } else if (item.riskLevel === "low") {
        riskProfile.lowRiskItems++;
      }
    }

    // Compute completion time
    const createdTime = new Date(workflow.createdAt);
    const closedTime = new Date(workflow.closedAt);
    const completionMs = closedTime.getTime() - createdTime.getTime();
    const completionHours = Math.round(completionMs / (1000 * 60 * 60));
    const completionTime = `${completionHours} hours`;

    const evidence: ComplianceEvidence = {
      generatedAt: testGeneratedAt || new Date().toISOString(),
      schemaVersion: this.SCHEMA_VERSION,
      reviewId: workflow.reviewId,
      snapshotHash: workflow.snapshotHash,

      soc2_cc6_7: {
        description: "Demonstrates periodic review of logical system access rights (SOC 2 CC6.7)",
        controlId: "CC6.7",
        controlName: "Change Management",
        framework: "SOC 2",
        evidenceArtifacts: exportPackFiles,
        reviewId: workflow.reviewId,
        snapshotHash: workflow.snapshotHash,
        timestamp: workflow.closedAt!,
      },

      nist_800_53_ac2: {
        description: "Account management – review of user privileges (NIST SP 800-53 AC-2(2))",
        controlId: "AC-2(2)",
        controlName: "Account Management",
        framework: "NIST SP 800-53",
        evidenceArtifacts: exportPackFiles,
        reviewId: workflow.reviewId,
        completionTime: completionTime,
      },

      iso_27001_a9_2: {
        description: "User access management – periodic review of access rights (ISO/IEC 27001 Annex A 9.2)",
        controlId: "A.9.2",
        controlName: "User Access Management",
        framework: "ISO/IEC 27001",
        evidenceArtifacts: exportPackFiles,
        reviewId: workflow.reviewId,
        snapshotHash: workflow.snapshotHash,
        riskProfile: riskProfile,
      },

      disclaimers: [
        "These are evidence artifacts only and do NOT constitute a certification or guarantee of compliance.",
        "Evidence is generated for control mapping purposes. Actual compliance assessment requires independent audit.",
        "FirstTry provides tools for access review workflows. Organizations remain responsible for their overall compliance posture.",
        "Evidence artifacts are point-in-time snapshots. Compliance claims require continuous controls and monitoring.",
      ],
    };

    console.log(`[FT_COMPLIANCE] Generated evidence for reviewId=${workflow.reviewId}`);
    console.log(`[FT_COMPLIANCE] soc2_cc6_7: Evidence artifacts mapped`);
    console.log(`[FT_COMPLIANCE] nist_800_53_ac2: Evidence artifacts mapped`);
    console.log(`[FT_COMPLIANCE] iso_27001_a9_2: Evidence artifacts mapped`);

    return evidence;
  }

  /**
   * Export evidence as JSON (for inclusion in export pack or separate storage)
   */
  static exportEvidenceJSON(evidence: ComplianceEvidence): string {
    return JSON.stringify(evidence, null, 2);
  }

  /**
   * Create markdown report from evidence (for human review)
   */
  static generateEvidenceReport(evidence: ComplianceEvidence): string {
    return `# Compliance Evidence Report

Generated: ${evidence.generatedAt}  
Review ID: ${evidence.reviewId}  
Snapshot Hash: ${evidence.snapshotHash}  

## SOC 2 CC6.7 — Change Management

**Control:** ${evidence.soc2_cc6_7.controlName}  
**Framework:** ${evidence.soc2_cc6_7.framework}  
**ID:** ${evidence.soc2_cc6_7.controlId}  

**Description:** ${evidence.soc2_cc6_7.description}

**Evidence Artifacts:**
${evidence.soc2_cc6_7.evidenceArtifacts.map((f) => `- ${f}`).join("\n")}

**Timestamp:** ${evidence.soc2_cc6_7.timestamp}

---

## NIST SP 800-53 AC-2 — Account Management

**Control:** ${evidence.nist_800_53_ac2.controlName}  
**Framework:** ${evidence.nist_800_53_ac2.framework}  
**ID:** ${evidence.nist_800_53_ac2.controlId}  

**Description:** ${evidence.nist_800_53_ac2.description}

**Completion Time:** ${evidence.nist_800_53_ac2.completionTime}

**Evidence Artifacts:**
${evidence.nist_800_53_ac2.evidenceArtifacts.map((f) => `- ${f}`).join("\n")}

---

## ISO/IEC 27001 A.9.2 — User Access Management

**Control:** ${evidence.iso_27001_a9_2.controlName}  
**Framework:** ${evidence.iso_27001_a9_2.framework}  
**ID:** ${evidence.iso_27001_a9_2.controlId}  

**Description:** ${evidence.iso_27001_a9_2.description}

**Risk Profile:**
- High Risk: ${evidence.iso_27001_a9_2.riskProfile.highRiskItems}
- Medium Risk: ${evidence.iso_27001_a9_2.riskProfile.mediumRiskItems}
- Low Risk: ${evidence.iso_27001_a9_2.riskProfile.lowRiskItems}

**Evidence Artifacts:**
${evidence.iso_27001_a9_2.evidenceArtifacts.map((f) => `- ${f}`).join("\n")}

---

## Important Disclaimers

${evidence.disclaimers.map((d) => `- ${d}`).join("\n")}

---

*This report is generated automatically from FirstTry access review workflows. The evidence artifacts above do NOT constitute a certification or compliance claim. They are provided for control alignment mapping purposes only.*
`;
  }
}

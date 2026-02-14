/**
 * FirstTry Phase 3 — Fail-Closed Guard Extension
 * 
 * Guards prevent:
 * - Export of open/incomplete reviews
 * - Snapshot hash mismatches
 * - Canonical hash corruption
 * - Missing reviewers
 * - Partial CSV/exports
 *
 * All failures return FT_REVIEW_INCOMPLETE marker
 * No fallback, no bypass
 */

import { ReviewWorkflow } from "../access-review/types";
import { ReviewWorkflowEngine } from "../access-review/workflow";
import { ReviewExportPack } from "../export/reviewPack";

/**
 * Guard validation result
 */
export interface GuardValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  marker: string; // FT_REVIEW_COMPLETE or FT_REVIEW_INCOMPLETE
}

/**
 * ReviewGuards: Fail-closed validation layer
 */
export class ReviewGuards {
  /**
   * Validate workflow is exportable
   * Fail-closed: Any failure returns INCOMPLETE marker
   */
  static validateExportable(workflow: ReviewWorkflow): GuardValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: Review must be closed
    if (workflow.status !== "closed") {
      errors.push(`Review status is '${workflow.status}', must be 'closed' to export`);
    }

    // Check 2: closedAt must be present
    if (!workflow.closedAt) {
      errors.push("Review marked closed but closedAt timestamp is missing");
    }

    // Check 3: Snapshot hash must exist
    if (!workflow.snapshotHash) {
      errors.push("Workflow missing snapshotHash (snapshot lock failure)");
    }

    // Check 4: Canonical hash must exist and be non-empty
    if (!workflow.canonicalHash || workflow.canonicalHash.length === 0) {
      errors.push("Workflow missing or empty canonicalHash (integrity failure)");
    }

    // Check 5: Reviewers must exist
    if (!workflow.reviewers || workflow.reviewers.length === 0) {
      errors.push("No reviewers assigned to workflow");
    }

    // Check 6: Items must exist
    if (!workflow.items || Object.keys(workflow.items).length === 0) {
      errors.push("No items in review (snapshot failure)");
    }

    // Check 7: Decisions must exist for all items
    if (!workflow.decisions) {
      errors.push("Decisions structure missing or null");
    } else {
      const itemIds = Object.keys(workflow.items);
      const decisionIds = Object.keys(workflow.decisions);
      if (!itemIds.every((id) => decisionIds.includes(id))) {
        errors.push("Decisions incomplete: missing decision records for some items");
      }
    }

    // Check 8: Build version must be set
    if (!workflow.buildVersion) {
      warnings.push("Build version not set (should be set for traceability)");
    }

    // Warning: Progress should be 100% for closed review
    if (workflow.progress < 100) {
      warnings.push(
        `Review closed with progress=${workflow.progress}% (items still undecided)`
      );
    }

    // Warning: Check for orphaned exceptions
    if (workflow.exceptions && workflow.exceptions.length > 0) {
      for (const exc of workflow.exceptions) {
        const expirationDate = new Date(exc.expirationDate);
        if (expirationDate < new Date()) {
          warnings.push(`Exception for ${exc.entityId} is already expired`);
        }
      }
    }

    const valid = errors.length === 0;
    const marker = valid ? "FT_REVIEW_COMPLETE" : "FT_REVIEW_INCOMPLETE";

    if (errors.length > 0) {
      console.error(`[${marker}] Validation failed with errors:`, errors);
    }

    return {
      valid,
      errors,
      warnings,
      marker,
    };
  }

  /**
   * Validate snapshot hash immutability
   * Ensures snapshot wasn't modified during workflow
   */
  static validateSnapshotImmutability(
    workflow: ReviewWorkflow,
    originalSnapshotHash: string
  ): GuardValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (workflow.snapshotHash !== originalSnapshotHash) {
      errors.push(
        `Snapshot hash mismatch: expected ${originalSnapshotHash}, got ${workflow.snapshotHash}`
      );
    }

    const valid = errors.length === 0;
    const marker = valid ? "FT_REVIEW_SNAPSHOT_IMMUTABLE" : "FT_REVIEW_INCOMPLETE";

    return {
      valid,
      errors,
      warnings,
      marker,
    };
  }

  /**
   * Validate canonical hash integrity
   * Ensures workflow state hasn't been corrupted
   */
  static validateCanonicalHash(workflow: ReviewWorkflow): GuardValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const storedHash = workflow.canonicalHash;

    // Compute what the hash should be
    const recomputedHash = ReviewWorkflowEngine.hashWorkflow(
      (workflow as unknown) as Parameters<typeof ReviewWorkflowEngine.hashWorkflow>[0]
    );

    if (storedHash !== recomputedHash) {
      errors.push(
        `Canonical hash mismatch: stored=${storedHash}, computed=${recomputedHash} (workflow corruption detected)`
      );
    }

    const valid = errors.length === 0;
    const marker = valid ? "FT_REVIEW_HASH_VALID" : "FT_REVIEW_INCOMPLETE";

    return {
      valid,
      errors,
      warnings,
      marker,
    };
  }

  /**
   * Validate export pack completeness
   * Ensures no partial exports
   */
  static validateExportPackComplete(
    files: Record<string, string>
  ): GuardValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check all required files present
    for (const requiredFile of ReviewExportPack.REQUIRED_FILES) {
      if (!files[requiredFile]) {
        errors.push(`Missing required export file: ${requiredFile}`);
      }
    }

    // Check all files are non-empty
    for (const [filename, content] of Object.entries(files)) {
      if (!content || content.length === 0) {
        errors.push(`Export file is empty: ${filename}`);
      }
    }

    // Check CSV structure for access-review.csv
    if (files["access-review.csv"]) {
      const csv = files["access-review.csv"];
      const lines = csv.split("\n");
      if (lines.length < 2) {
        errors.push("access-review.csv has no data rows (only header)");
      }
      if (!csv.includes("entityId,entityType")) {
        errors.push("access-review.csv has invalid header format");
      }
    }

    const valid = errors.length === 0;
    const marker = valid ? "FT_EXPORT_PACK_COMPLETE" : "FT_REVIEW_INCOMPLETE";

    return {
      valid,
      errors,
      warnings,
      marker,
    };
  }

  /**
   * Master validation: Run all guards
   * Returns COMPLETE only if all pass
   */
  static validateComplete(
    workflow: ReviewWorkflow,
    exportFiles?: Record<string, string>,
    originalSnapshotHash?: string
  ): GuardValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Check 1: Exportable
    const exportableResult = this.validateExportable(workflow);
    allErrors.push(...exportableResult.errors);
    allWarnings.push(...exportableResult.warnings);

    // Check 2: Snapshot immutability (if hash provided)
    if (originalSnapshotHash) {
      const snapResult = this.validateSnapshotImmutability(
        workflow,
        originalSnapshotHash
      );
      allErrors.push(...snapResult.errors);
      allWarnings.push(...snapResult.warnings);
    }

    // Check 3: Canonical hash
    const hashResult = this.validateCanonicalHash(workflow);
    allErrors.push(...hashResult.errors);
    allWarnings.push(...hashResult.warnings);

    // Check 4: Export pack completeness (if files provided)
    if (exportFiles) {
      const packResult = this.validateExportPackComplete(exportFiles);
      allErrors.push(...packResult.errors);
      allWarnings.push(...packResult.warnings);
    }

    const valid = allErrors.length === 0;
    const marker = valid ? "FT_REVIEW_COMPLETE" : "FT_REVIEW_INCOMPLETE";

    if (!valid) {
      console.error(`[${marker}] Master validation failed:`, allErrors);
    } else {
      console.log(`[${marker}] All guards pass`);
    }

    return {
      valid,
      errors: allErrors,
      warnings: allWarnings,
      marker,
    };
  }
}

/**
 * Import stub for ReviewWorkflow hash function
 * In real code, would import from workflow.ts
 */

/**
 * Trust Panel Initialization (read-only, logging-based)
 * Emits markers for auditor visibility without requiring traditional UI integration
 */

import { TRUST_DOC_PATHS } from "./trustDocs";
import { EXPECTED_PROOF_MARKERS } from "./proofMarkers";
import { SCOPE_ALLOWLIST } from "../security/scopeAllowlist";
import { SCOPE_RATIONALE } from "../security/scopeRationale";

export function initializeTrustPanel(): void {
  // Log trust panel initialization
  console.log("[FT_TRUST_PANEL_INITIALIZED]");

  // Log trust invariants (read-only, fail-closed, deterministic, tenant-isolated)
  console.log("=== Trust & Proof Invariants ===");
  console.log("- Read-only by default; no Jira mutations");
  console.log("- No outbound networking (no external fetch)");
  console.log("- Deterministic exports (canonical JSON + SHA-256)");
  console.log("- Tenant isolation enforced by Forge boundaries + internal invariant");
  console.log("- Fail-closed: no partial exports");

  // Log expected proof markers
  console.log("");
  console.log("=== Expected Proof Markers ===");
  EXPECTED_PROOF_MARKERS.forEach((marker) => {
    console.log(`  ${marker}`);
  });

  // Log doc paths (non-clickable)
  console.log("");
  console.log("=== Trust Documentation Paths (repository paths, not clickable in UI) ===");
  TRUST_DOC_PATHS.forEach((path) => {
    console.log(`  ${path}`);
  });

  // Log scopes & rationale
  console.log("");
  console.log("=== Scopes & Rationale ===");
  SCOPE_ALLOWLIST.sort().forEach((scope) => {
    const rationale = SCOPE_RATIONALE[scope] || "(no rationale provided)";
    console.log(`  ${scope}: ${rationale}`);
  });

  console.log("[FT_TRUST_PANEL_RENDERED]");
}

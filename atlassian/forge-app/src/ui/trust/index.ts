/**
 * Trust Infrastructure Index
 * Exports all trust and security components for visibility and testing
 */

export { TRUST_DOC_PATHS } from "./trustDocs";
export { EXPECTED_PROOF_MARKERS } from "./proofMarkers";
export { initializeTrustPanel } from "./initTrustPanel";

// The trust panel initialization should be called during app startup or test initialization
// Example usage:
// import { initializeTrustPanel } from 'src/ui/trust/index'
// initializeTrustPanel()  // Logs trust invariants and proof markers to console

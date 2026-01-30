/**
 * CSP Violation Listener & Forensics
 * 
 * Captures Content Security Policy violations for debugging.
 * Stores violations in window.__FT_LAST_CSP_VIOLATION and logs them with marker "UI_CSP_VIOLATION_EVENT".
 * 
 * CSP-Safe: Does not inject styles or use unsafe-inline.
 */

export interface CSPViolationEvent {
  marker: string;
  violatedDirective: string;
  effectiveDirective: string;
  blockedURI: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
  sample?: string;
  documentURI: string;
  ts: string;
}

// Store latest violation globally for debugging
declare global {
  interface Window {
    __FT_LAST_CSP_VIOLATION?: CSPViolationEvent;
    __FT_CSP_VIOLATIONS?: CSPViolationEvent[];
  }
}

export function initCSPViolationListener(): void {
  // Initialize array if not present
  if (!window.__FT_CSP_VIOLATIONS) {
    window.__FT_CSP_VIOLATIONS = [];
  }

  // Listen for CSP violations (use capture phase to catch all events)
  window.addEventListener(
    "securitypolicyviolation",
    (event: SecurityPolicyViolationEvent) => {
      try {
        const violation: CSPViolationEvent = {
          marker: "UI_CSP_VIOLATION_EVENT",
          violatedDirective: event.violatedDirective || "unknown",
          effectiveDirective: event.effectiveDirective || "unknown",
          blockedURI: event.blockedURI || "unknown",
          sourceFile: event.sourceFile || "unknown",
          lineNumber: event.lineNumber || 0,
          columnNumber: event.columnNumber || 0,
          sample: event.sample || undefined,
          documentURI: event.documentURI || document.location.href,
          ts: new Date().toISOString(),
        };

        // Store globally
        window.__FT_LAST_CSP_VIOLATION = violation;
        window.__FT_CSP_VIOLATIONS!.push(violation);

        // Log structured JSON line
        console.log(JSON.stringify(violation));

        // Also log human-readable form
        console.warn(
          `[CSP_VIOLATION] ${violation.violatedDirective} at ${violation.sourceFile}:${violation.lineNumber}`,
          {
            blockedURI: violation.blockedURI,
            sample: violation.sample,
          }
        );
      } catch (err) {
        // Fail-closed: don't throw even if logging fails
        console.error("[CSP_LISTENER_ERROR]", err);
      }
    },
    true // Use capture phase
  );
}

export function getCSPViolations(): CSPViolationEvent[] {
  return window.__FT_CSP_VIOLATIONS || [];
}

export function getLatestCSPViolation(): CSPViolationEvent | undefined {
  return window.__FT_LAST_CSP_VIOLATION;
}

export function hasCSPViolations(): boolean {
  return (window.__FT_CSP_VIOLATIONS?.length || 0) > 0;
}

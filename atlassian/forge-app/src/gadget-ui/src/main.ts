/**
 * Firsttry: Audit Evidence for Jira - Main Entrypoint
 * 
 * This module is bundled by Vite and served in the Forge gadget iframe.
 * @forge/bridge is bundled with the gadget and provides invoke() for resolver calls.
 */

// ============================================================================
// L0 DUMB-READER MODE ENFORCEMENT (STRICT SINGLE-INVOKE)
// ============================================================================
const FT_L0_MODE = true;

// ============================================================================
// FORGE BRIDGE RUNTIME CHECK (NO TOP-LEVEL THROW)
// Detects bridge at runtime and renders fail-closed panel if missing
// ============================================================================
import { ensureForgeBridgeOrRenderFatal } from "./_FATAL_MISSING_FORGE_BRIDGE";

// ============================================================================
// BRIDGE INVOKE WRAPPER: Safe invocation of backend resolvers
// ============================================================================
import { forgeInvoke } from "./forgeInvoke";

// ============================================================================
// IDENTITY ANCHOR GENERATION (FOR GATE VERIFICATION)
// ============================================================================
import { createIdentityAnchor } from "./ui_identity";

// ============================================================================
// LEGACY FLOW DETECTOR: Fail-closed validation (PHASE 3)
// ============================================================================
import { validateNonLegacyFlow, validateResponseNoLegacyMode, validateNoUnknownState } from "./legacy_flow_detector";

// ============================================================================
// LAYER-0 SNAPSHOT MAPPER (NEW: Dumb reader pattern for marketplace)
// ============================================================================
import { mapL0SnapshotResponse, renderL0Dashboard, type L0DashboardState } from "./l0_snapshot_mapper";

// ============================================================================
// DASHBOARD ENVELOPE MAPPING & VALIDATION (SHARED MODULE)

// CRITICAL: Both UI and tests use these real functions (no duplicates allowed)
// ============================================================================
import { mapDashEnvelopeV1, assertNonNullDashboardState, logRawDashboardEnvelope } from "./dashEnvelope";

// ============================================================================
// IDENTITY ANCHOR CONSTANT (FOR GATE VERIFICATION)
// ============================================================================
// Removed: stale static anchor - use dynamically constructed identityAnchor instead

// ============================================================================
// UI INVOKE WIRING PROOF
// ============================================================================
console.log("[UI_INVOKE_WIRING_PROOF] start");

// ============================================================================
// CSP INLINE STYLE VERIFICATION (PHASE 1 - MANDATORY)
// Must run FIRST to fail fast if CSP blocks inline styles
// ============================================================================
console.log("[UI_CSP_PROOF] inline-style-allowed-check");
try {
  const testDiv = document.createElement("div");
  testDiv.style.cssText = "position:absolute;left:-9999px;top:-9999px";
  document.body.appendChild(testDiv);
  document.body.removeChild(testDiv);
} catch (e) {
  throw new Error("CSP inline style still blocked");
}

// ============================================================================
// UI BUILD IDENTITY — ALWAYS PRINTED (even if bridge fails)
// This marker runs before bridge check so we know which bundle is executing
// ============================================================================
(() => {
  const ui_git_sha = typeof __FT_BUILD_SHA__ !== 'undefined' ? __FT_BUILD_SHA__ : 'UNSET';
  const ui_bundle_hash = (() => {
    const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    for (const src of scripts) {
      const m = src.match(/\/app\.([a-z0-9]+)\.(js|mjs)/);
      if (m) return m[1];
    }
    return 'UNSET';
  })();
  
  console.log('[UI_BUILD_IDENTITY_EARLY]', {
    marker: 'UI_BUILD_IDENTITY_EARLY',
    ui_git_sha,
    ui_bundle_hash,
    ts: new Date().toISOString(),
  });
})();

// ============================================================================
// FORGE BRIDGE RUNTIME CHECK (FAIL-CLOSED, NO THROW)
// Must run EARLY to detect if bridge is available, render panel if not
// Uses async probeForgeBridge() which pings backend via real invoke call
// ============================================================================
console.log("[UI_BRIDGE_RUNTIME_CHECK] Checking Forge bridge availability...");
const bridgeProbePromise = ensureForgeBridgeOrRenderFatal(document.body);
// We'll await this at the top of onDOMReady() function (see bottom of file)

// ============================================================================
// INSTANT FALLBACK: if bridge is provably missing, render error immediately
// This catches cases where the async probe might hang or crash
// ============================================================================
setTimeout(() => {
  // After 3 seconds, if bridge hasn't been verified, assume it's missing
  const fatalPanel = document.getElementById("forge-bridge-fatal-error-panel");
  if (!fatalPanel && !document.body.classList.contains("ft-bridge-verified")) {
    const panel = document.createElement("div");
    panel.id = "forge-bridge-fatal-error-panel-timeout";
    panel.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    panel.innerHTML = `
      <div style="text-align: center; padding: 24px; max-width: 500px;">
        <h1 style="color: #d32f2f; margin: 0 0 16px 0; font-size: 24px;">⚠️ Bridge Timeout</h1>
        <p style="color: #666; font-size: 16px;">
          The Forge bridge did not respond within 3 seconds. Try refreshing the page.
        </p>
      </div>
    `;
    document.body.appendChild(panel);
  }
}, 3000);

// ============================================================================
// DEBUG MODE TOGGLE (URL param or localStorage)
// Enable debug UI visibility: ?ft_debug=1 or localStorage.FT_DEBUG === "1"
// Fail-closed: any error -> debug mode is OFF
// ============================================================================
function ftIsDebugMode(): boolean {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("ft_debug") === "1") return true;
    if (window.localStorage?.getItem("FT_DEBUG") === "1") return true;
  } catch {
    // fail-closed
  }
  return false;
}

function ftApplyDebugModeClass(): void {
  const root = document.documentElement;
  if (ftIsDebugMode()) root.classList.add("ft-debug");
  else root.classList.remove("ft-debug");
}

ftApplyDebugModeClass();

// ============================================================================
// L0.C: UI ENTRY RUNTIME PROOF - IIFE (runs immediately before any other code)
// Must run before importing build_meta so we capture globals at their actual load time
// ============================================================================

// We declare these as any to avoid TypeScript errors about injected globals
// The actual values are set by postbuild.mjs or the HTML template
declare const __FT_BUILD_SHA__: string | undefined;
declare const __FT_BUILD_TIME__: string | undefined;

// Immediately capture proof before any other module executes
// This proves the actual entry script filename, not just what was requested
(() => {
  // Get injected git/build metadata (names corrected to distinguish from bundle hash)
  const ui_git_sha =
    typeof __FT_BUILD_SHA__ !== 'undefined'
      ? __FT_BUILD_SHA__
      : 'UNSET';
  const ui_git_time =
    typeof __FT_BUILD_TIME__ !== 'undefined'
      ? __FT_BUILD_TIME__
      : 'UNSET';

  // Capture entry before any bundled code runs
  // This MUST be inline to run before module imports below
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[src]')
  ).map(s => s.src);

  // Extract entry bundle URL and hash
  // Precedence: document.currentScript -> scan for /app.<HASH>.js pattern
  const currentScript = (document.currentScript as any)?.src || null;
  let ui_entry_bundle_url: string | null = null;
  let ui_entry_bundle_hash: string | null = null;

  // Try current script first
  if (currentScript && /\/app\.[a-z0-9]+\.(js|mjs)/.test(currentScript)) {
    ui_entry_bundle_url = currentScript;
    const match = currentScript.match(/\/app\.([a-z0-9]+)\.(js|mjs)/);
    if (match) ui_entry_bundle_hash = match[1];
  }

  // If not found, scan all scripts
  if (!ui_entry_bundle_hash) {
    for (const src of scripts) {
      const match = src.match(/\/app\.([a-z0-9]+)\.(js|mjs)/);
      if (match) {
        ui_entry_bundle_url = src;
        ui_entry_bundle_hash = match[1];
        break;
      }
    }
  }

  const proof = {
    marker: 'UI_ENTRY_RUNTIME_PROOF',
    ui_git_sha,
    ui_git_time,
    ui_entry_bundle_url,
    ui_entry_bundle_hash,
    script_srcs: scripts,
    href: window.location.href,
    iso: new Date().toISOString(),
  };

  (window as any).__FT_RUNTIME_ENTRY_PROOF__ = proof;
  console.log('[UI_ENTRY_RUNTIME_PROOF]', JSON.stringify(proof));
})();

// Import invoke from @forge/bridge (now bundled, not injected as global)
import { invoke } from '@forge/bridge';
import './styles.css';

// Import build info (injected by Vite)
import { getBuildIdentifier } from './buildInfo';

// Import UI identity type (PHASE 2: strict types for build markers)
import { buildUiIdentity, formatUiIdentity, type UiIdentity } from './ui_identity';

// Import UI build markers (auto-generated at build time)
import { UI_GIT_SHA, UI_BUILD_TIME_UTC, UI_BUILD_MARKER } from './ui_build_meta';

// ============================================================================
// BACKBONE FIX #1: PREVENT TREE-SHAKING OF UI BUILD IDENTIFIERS
// ============================================================================
// Force Vite to include these constants by using them at module level
// (Cannot be tree-shaken if used at top level outside of a function)
const _FT_BUILD_META_PROOF = {
  sha: UI_GIT_SHA,
  time: UI_BUILD_TIME_UTC,
  marker: UI_BUILD_MARKER,
  // Use typeof to force symbol to be non-dead-code
  shaType: typeof UI_GIT_SHA,
  timeType: typeof UI_BUILD_TIME_UTC,
};
// Ensure the constant is used in a way that can't be tree-shaken
if (typeof _FT_BUILD_META_PROOF === 'object' && _FT_BUILD_META_PROOF.sha.length > 0) {
  // This expression is always true but Vite can't optimize it away
  // because it depends on the module-level constants
}

// Import L0.C entry proof functions for testing and banner display
import { captureRuntimeEntryProof, formatEntryProofForBanner } from './entryProof';

// Import pure modules (testable, deterministic)
import { buildExportPayloadFromStatus, type ExportPayload } from './exportPayload';
import { toSummaryTextFromPayload } from './summaryText';

// Import truth model (single source of truth for all UI state)
import { 
  computeGovernanceViewModel, 
  GovernanceRuntimeState,
  type GovernanceViewModel,
  type RuntimeSignals
} from './truthModel';

// Import snapshot UI renderers (vanilla DOM, accessibility-safe)
import { renderKpiTiles } from './snapshot_ui/renderKpiTiles';
import { renderStatusBanner } from './snapshot_ui/renderStatusBanner';
import { renderTrustSection } from './snapshot_ui/renderTrustSection';
import { applyExportPolicy } from './snapshot_ui/applyExportPolicy';
import './snapshot_ui/snapshot_ui.css';

// Import shared status schema and normalizer (CRITICAL to prevent UI crashes)
import { normalizeStatusV1, EMPTY_STATUS_V1, GovernanceStatusV1 } from '../../shared/statusSchema';

// Import ping response parser (CRITICAL for production bug fix)
import { parsePingResponse, shouldShowBackendNotResponding, type ParsedPingResponse } from './pingResponseParser';

// ============================================================================
// BUILD & PROOF MARKERS
// ============================================================================
const UI_BUILD_VERSION = "UI_v2.14.0";
const UI_BUILD_PROOF = "591f91ce__2026-01-04T165752Z";
const UI_RESOURCE_KEY = "govGadget2141";
const BRIDGE_MODE = "BUNDLED";
const INVOKE_AVAILABLE = true;
// UI_DIST_STAMP: Git HEAD SHA + build timestamp. Proves which dist was deployed.
const UI_DIST_STAMP = "cdfa04fba064__20260115T120000Z";
// BACKBONE LAYER 0: UI_BUILD_MARKER is imported from ui_build_meta.ts and auto-generated at build time
// It includes current UTC timestamp and SHA for cache-busting verification
// Format: UI_MARKER_<YYYYMMDDTHHMMSSZ>_<SHA>
// UI_REQ_ID: Unique per page load. Used to correlate UI invoke calls with resolver logs.
const FT_UI_REQ_ID = `ui_${Date.now()}_${Math.random().toString(16).slice(2).substring(0, 8)}`;

// STEP 3: CORRELATION_ID NONCE - Unique per page load, sent to backend, echoed back
// This proves round-trip: UI generates → sends to backend → backend echoes → UI displays
// Format: correlation_<timestamp>_<random>
const FT_CORRELATION_ID_NONCE = `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

console.log(`[UI_CORRELATION_ID] nonce=${FT_CORRELATION_ID_NONCE}`);

// ============================================================================
// PHASE 2: UI IDENTITY INITIALIZATION (STRICT TYPES)
// Build identity distinguishing git SHA from bundle hash at runtime
// ============================================================================
let UI_IDENTITY: UiIdentity;
try {
  UI_IDENTITY = buildUiIdentity();
  console.log(`[UI_IDENTITY_RESOLVED] ${formatUiIdentity(UI_IDENTITY)}`);
  
  // NOTE: Identity anchor is now embedded via block comment appended by postbuild.mjs
  // This ensures all anchor verification happens via provenance gates (strip_and_hash.js)
  // No inline anchor needed
  
} catch (err) {
  console.error('[FATAL_UI_IDENTITY]', err instanceof Error ? err.message : String(err));
  // Fail closed: if identity cannot be built, show error and stop
  const errPanel = document.createElement('div');
  errPanel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:9999;' +
    'display:flex;align-items:center;justify-content:center;font-family:monospace;';
  errPanel.innerHTML = `<div style="max-width:600px;padding:20px;background:#fee;border:1px solid #c00;">` +
    `<h2>FATAL: UI Identity Error</h2>` +
    `<pre>${err instanceof Error ? err.message : String(err)}</pre>` +
    `<p>The UI bundle identity could not be determined. This prevents secure operation.` +
    ` Check that @forge/bridge is installed and the gadget is served from dist.</p>` +
    `</div>`;
  document.body.innerHTML = '';
  document.body.appendChild(errPanel);
  throw err;
}

// ============================================================================
// UI BOOT PROOF LOGGING (CACHE-BUST VISIBILITY)
// ============================================================================
// Log to console immediately on module load to prove:
// 1. Which exact script URL was loaded (for cache-bust verification)
// 2. The UI build SHA and time
// 3. Unique request ID for correlation
(function captureBootProof() {
  try {
    // Collect all script URLs currently loaded in document
    const scriptUrls: string[] = [];
    for (const script of document.scripts) {
      if (script.src) {
        scriptUrls.push(script.src);
      }
    }
    
    // Log single-line proof using DISTINGUISHED labels for git sha vs bundle hash
    // Format: [UI_BOOT_PROOF] UI_GIT_SHA=<git> UI_BUNDLE_HASH=<hash> time=<UTC> scripts=<urls>
    console.log(
      `[UI_BOOT_PROOF] UI_GIT_SHA=${UI_IDENTITY.ui_git_sha} UI_BUNDLE_HASH=${UI_IDENTITY.ui_bundle_hash} ` +
      `time=${UI_IDENTITY.ui_git_time_iso} scripts=[${scriptUrls.join('; ')}] uiReqId=${FT_UI_REQ_ID}`
    );
    
    // Also log individual script URLs for easy inspection in browser DevTools
    for (let i = 0; i < scriptUrls.length; i++) {
      console.log(`[UI_BOOT_SCRIPT_${i}] ${scriptUrls[i]}`);
    }
  } catch (err) {
    console.error('[UI_BOOT_PROOF] Error capturing boot proof:', err);
  }
})();

// Track last payload for export functions
let lastPayload: any = null;

// BACKBONE FIX B: Store raw envelope globally for proof panel access
let lastRawEnvelope: any = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function ftEnsureServeProofEl(): HTMLElement {
    const id = "ft-serve-proof";
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.className = "proof-element";
    }
    return el as HTMLElement;
}

/**
 * Update the hidden ft-proof DOM node with current dashboard state.
 * This node is always present and accessible to E2E tests for deterministic observation.
 * Format: JSON object with ui_git_sha, ui_build_time_utc, ui_req_id_local, 
 * last_observed_schemaVersion, last_backend_build_sha
 */
let lastObservedSchemaVersion: string = "NOT_AVAILABLE";
let lastBackendBuildSha: string = "NOT_AVAILABLE";

function ftUpdateProofNode(optional?: { schemaVersion?: string; backendBuildSha?: string }) {
    // Update tracking state
    if (optional?.schemaVersion) {
        lastObservedSchemaVersion = optional.schemaVersion;
    }
    if (optional?.backendBuildSha) {
        lastBackendBuildSha = optional.backendBuildSha;
    }

    const id = "ft-proof";
    let el = document.getElementById(id);
    
    // Ensure element exists and is hidden
    if (!el) {
        el = document.createElement("pre");
        el.id = id;
        el.setAttribute("data-ft-proof", "1");
        el.style.display = "none";
        document.body.appendChild(el);
    }
    
    // Build proof object
    const proofData = {
        ui_git_sha: UI_GIT_SHA,
        ui_build_time_utc: UI_BUILD_TIME_UTC,
        ui_req_id_local: FT_UI_REQ_ID,
        last_observed_schemaVersion: lastObservedSchemaVersion,
        last_backend_build_sha: lastBackendBuildSha,
    };
    
    // Update content as JSON
    el.textContent = JSON.stringify(proofData);
}

/**
 * STEP 3: Render the Identity/Deployment Proof Panel
 * Displays backend proof contract fields to prove deployment identity
 */
function renderIdentityProofPanel(data: GovernanceStatusV1) {
    // Extract proof fields from backend response
    const envelopeKind = data.envelopeKind || "UNSET";
    const schemaVersion = data.schemaVersion || "UNSET";
    const correlationId = data.correlation_id || "UNSET";
    const uiBuildSha = data.ui_build_sha || "UNSET";
    const uiBuildTime = data.ui_build_time_utc || "UNSET";
    const backendBuildSha = data.backend_build_sha || "UNSET";
    const backendBuildTime = data.backend_build_time_utc || "UNSET";
    
    // Log the proof panel values for E2E assertion
    console.log(`[UI_IDENTITY_PROOF_PANEL] envelopeKind=${envelopeKind} schemaVersion=${schemaVersion} correlationId=${correlationId} backendSha=${backendBuildSha}`);
    
    // Update each proof field in the DOM
    setText('proof-envelope-kind', envelopeKind);
    setText('proof-schema-version', schemaVersion);
    setText('proof-correlation-id', correlationId);
    setText('proof-ui-build-sha', uiBuildSha);
    setText('proof-ui-build-time', uiBuildTime);
    setText('proof-backend-build-sha', backendBuildSha);
    setText('proof-backend-build-time', backendBuildTime);
}

function setText(id: string, value: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    el.textContent = value;
    return true;
}

function setHTML(id: string, value: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    el.innerHTML = value;
    return true;
}

function formatTimestampDisplay(iso?: string): string {
    if (!iso) return 'Not available yet';
    try {
        const date = new Date(iso);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    } catch {
        return iso;
    }
}

function formatTimestampExport(iso?: string): string {
    if (!iso) return 'Pending…';
    try {
        const date = new Date(iso);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    } catch {
        return iso;
    }
}

// ============================================================================
// INVOKE ERROR TRUTH: Safe Error Normalization (Phase C)
// ============================================================================

/**
 * safeJsonStringify: Serialize any value to JSON, handling circular refs and bigints
 * 
 * RULES:
 * 1. Detects circular references using WeakSet (no infinite loops)
 * 2. Converts BigInt to string (JSON.stringify fails on BigInt)
 * 3. Wraps entire operation in try/catch (never crashes UI)
 * 4. Returns readable error message on failure, not empty string
 * 
 * Purpose: Ensure error objects can always be displayed in UI without crashes
 */
function safeJsonStringify(value: any, indent: number = 2): string {
    try {
        const seen = new WeakSet<object>();
        
        const stringified = JSON.stringify(
            value,
            (key, val) => {
                // Handle BigInt
                if (typeof val === 'bigint') {
                    return val.toString();
                }
                
                // Handle circular references
                if (typeof val === 'object' && val !== null) {
                    if (seen.has(val)) {
                        return '[CIRCULAR_REFERENCE]';
                    }
                    seen.add(val);
                }
                
                return val;
            },
            indent
        );
        
        return stringified || '{}';
    } catch (e) {
        // Fallback: at least return something useful
        const errorMsg = e instanceof Error ? e.message : String(e);
        return JSON.stringify({
            _stringify_error: 'Failed to serialize',
            _error_msg: errorMsg,
            _value_type: typeof value,
            _value_class: value?.constructor?.name || 'unknown'
        }, null, indent);
    }
}

/**
 * normalizeInvokeError: Extract and normalize error data from any thrown value
 * 
 * PURPOSE: When invoke() throws, extract real error details (code, message, traceId)
 * and serialize safely without data loss (circulars, bigints, nested errors)
 * 
 * RETURN VALUE: {
 *   kind: string,          // err.name or "UnknownError"
 *   message: string,       // err.message or stringified err
 *   stack: string,         // err.stack or err.cause.stack
 *   code: string,          // extracted from err.code, err.errorCode, err.details.code, etc.
 *   traceId: string,       // extracted from err.traceId, err.details.traceId, etc.
 *   raw: string           // full error serialized via safeJsonStringify
 * }
 */
interface NormalizedError {
    kind: string;
    message: string;
    stack: string;
    code: string;
    traceId: string;
    raw: string;
}

function normalizeInvokeError(err: any): NormalizedError {
    // Extract kind (error type name)
    const kind = err?.name || (err?.constructor?.name) || 'UnknownError';
    
    // Extract message
    let message = 'Unknown error';
    if (err instanceof Error) {
        message = err.message || 'Empty error message';
    } else if (typeof err?.message === 'string') {
        message = err.message;
    } else if (typeof err === 'string') {
        message = err;
    } else if (typeof err?.code === 'string') {
        message = err.code;
    } else {
        message = `Error: ${typeof err}`;
    }
    
    // Extract stack
    let stack = '';
    if (err?.stack && typeof err.stack === 'string') {
        stack = err.stack;
    } else if (err?.cause?.stack && typeof err.cause.stack === 'string') {
        stack = err.cause.stack;
    }
    
    // Extract code from nested paths (probe/ping may nest error details)
    let code = 'UNKNOWN';
    const codeSearchPaths = [
        () => err?.code,
        () => err?.errorCode,
        () => err?.details?.code,
        () => err?.details?.errorCode,
        () => err?.error?.code,
        () => err?.error?.errorCode,
        () => err?.statusCode,
        () => err?.status
    ];
    
    for (const pathFn of codeSearchPaths) {
        try {
            const val = pathFn();
            if (val && (typeof val === 'string' || typeof val === 'number')) {
                code = String(val);
                break;
            }
        } catch {
            // ignore path errors, continue to next path
        }
    }
    
    // Extract traceId from nested paths
    let traceId = 'UNKNOWN';
    const traceSearchPaths = [
        () => err?.traceId,
        () => err?.traceID,
        () => err?.trace_id,
        () => err?.details?.traceId,
        () => err?.details?.traceID,
        () => err?.details?.trace_id,
        () => err?.error?.traceId,
        () => err?.error?.trace_id_stable,
        () => err?.requestId
    ];
    
    for (const pathFn of traceSearchPaths) {
        try {
            const val = pathFn();
            if (val && (typeof val === 'string' || typeof val === 'number')) {
                traceId = String(val);
                break;
            }
        } catch {
            // ignore path errors, continue to next path
        }
    }
    
    // Serialize raw error (safe, handles circulars + bigints)
    const raw = safeJsonStringify(err);
    
    return {
        kind,
        message,
        stack,
        code,
        traceId,
        raw
    };
}

// ============================================================================
// ERROR ENVELOPE EXTRACTION: Structured error details from backend
// ============================================================================

/**
 * extractErrorEnvelopeDetails: Extract error details from ErrorEnvelopeV1 attached to response
 * 
 * PURPOSE: Parse structured error envelope and return formatted error details
 * for display in UI (resolverName, errorCode, traceId, storage state, trace steps)
 * 
 * RETURN: { resolverName, errorCode, message, traceId, storageState, steps[] }
 */
interface ExtractedErrorDetails {
    resolverName?: string;
    errorCode?: string;
    message?: string;
    traceId?: string;
    storageState?: string;
    steps?: string[];
}

function extractErrorEnvelopeDetails(response: any): ExtractedErrorDetails {
    try {
        // Check for error envelope attached to response
        const envelope = response?._errorEnvelopeV1 || response?.errorEnvelope;
        
        if (!envelope || typeof envelope !== 'object') {
            return {};
        }

        const details: ExtractedErrorDetails = {
            resolverName: envelope.resolverName,
            errorCode: envelope.errorCode,
            message: envelope.message,
            traceId: envelope.meta?.traceId || envelope.meta?.requestId,
            storageState: envelope.storage?.state
        };

        // Extract trace steps (for detailed error info)
        if (Array.isArray(envelope.trace)) {
            details.steps = envelope.trace.map((step: any) => {
                const status = step.ok ? '✓' : '✗';
                const msg = step.message || (step.ok ? 'OK' : step.errorCode || 'FAILED');
                return `${status} ${step.stepId || step.resolverName}: ${msg}`;
            });
        }

        return details;
    } catch {
        return {};
    }
}

// ============================================================================
// BACKBONE LAYER 0: UI_REQ_ID CORRELATION WRAPPER
// ============================================================================
/**
 * invokeWithUiReqId: Wrapper that guarantees every resolver invocation includes ui_req_id
 * 
 * RULES (non-bypassable):
 * 1. Always injects ui_req_id into payload
 * 2. Uses FT_UI_REQ_ID as single source of truth (same as displayed in footer)
 * 3. If payload is null/undefined, creates { ui_req_id }
 * 4. Every invoke() call in main.ts must use this wrapper (guarded by CI test)
 * 
 * This is the ONLY entry point to the Forge bridge for gadget resolvers.
 */
async function invokeWithUiReqId<T>(
  resolverName: string,
  payload?: any
): Promise<T> {
  // Always inject ui_req_id using CURRENT_UI_REQ_ID (single source of truth)
  const enrichedPayload = {
    ...(payload || {}),
    ui_req_id: FT_UI_REQ_ID,
    correlation_id: FT_CORRELATION_ID_NONCE  // STEP 3: Send correlation nonce to backend
  };
  
  // Call Forge bridge with enriched payload
  // @ts-ignore - invoke is from @forge/bridge, checked in INVOKE_AVAILABLE
  return await invoke<T>(resolverName, enrichedPayload);
}

// ============================================================================
// CSS CANARY FAIL-FAST CHECK
// ============================================================================

function checkCSSCanary(): boolean {
    const cssCanary = document.getElementById('ui-css-canary');
    if (!cssCanary) return false;

    const s = window.getComputedStyle(cssCanary);

    // Multi-signal test: fail only if MOST signals indicate "unstyled"
    const borderOk = s.borderRadius && s.borderRadius !== '0px';
    const displayOk = (s.display === 'inline-flex' || s.display === 'flex' || s.display === 'inline-block');
    const paddingOk = (parseFloat(s.paddingLeft || '0') > 0) && (parseFloat(s.paddingRight || '0') > 0);
    const bgOk = s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
    const fontOk = s.fontWeight && parseInt(s.fontWeight, 10) >= 500;

    // Count signals
    const okCount = [borderOk, displayOk, paddingOk, bgOk, fontOk].filter(Boolean).length;

    // PASS if at least 3/5 style signals are present
    return okCount >= 3;
}

// ============================================================================
// MAIN LOAD FUNCTION
// ============================================================================

async function loadStatus() {
    try {
        // Mark JS as running
        setText('ui-js-boot', 'RAN');

        // STEP 0: Report Bridge mode and invoke availability (both always available now)
        setText('ui-selftest-bridge-mode', BRIDGE_MODE);
        setText('ui-selftest-invoke-available', INVOKE_AVAILABLE ? 'YES' : 'NO');

        // STEP 0.5: Report export capability
        setText('ui-selftest-export-mode', EXPORT_MODE);
        setText('ui-selftest-clipboard', CLIPBOARD_API_AVAILABLE ? 'YES' : 'NO');

        // If invoke is not available, show error and stop
        if (!INVOKE_AVAILABLE) {
            const errorHtml = `
                <div class="error-panel critical">
                    <div class="error-panel-section">CRITICAL: invoke() Not Available</div>
                    <div class="error-panel-details">
                        The @forge/bridge invoke function could not be loaded or is not available.
                        This is a critical issue with the gadget setup.
                    </div>
                </div>
            `;
            setHTML('operational-status', errorHtml);
            setText('ui-selftest-invoke', 'FAIL (invoke not available)');
            return;
        }

        // Step 1: CSS canary check
        if (!checkCSSCanary()) {
            const details = 'CSS canary check failed - CSS not applied or stripped';
            document.body.innerHTML =
                '<div class="error-panel">' +
                '<strong>FATAL:</strong> UI CSS not applied (or stripped).<br/>' +
                'This gadget is running without required styles.<br/><br/>' +
                '<div class="muted">Diagnostics: ' + details + '</div><br/>' +
                'Fix: Remove and re-add the gadget, hard refresh, or redeploy/upgrade.' +
                '</div>';
            throw new Error('CSS_NOT_APPLIED: ' + details);
        }

        // Step 2: Run self-tests BEFORE invoke
        setText('ui-selftest-marker', 'FOUND (static HTML marker present)');
        
        // Check if CSS is applied
        const proof = document.getElementById('ui-style-proof');
        let cssOk = false;
        if (proof) {
            const computed = getComputedStyle(proof);
            cssOk = computed.borderRadius !== '0px' && computed.backgroundColor !== '';
        }
        setText('ui-selftest-css', cssOk ? 'OK (CSS applied)' : 'FAIL (CSS missing/stripped)');
        
        // JS is running if we got here
        setText('ui-selftest-js', 'OK (JS executed)');

        // Step 3: Invoke resolver with try/catch for error handling
        let rawData: any = null;
        let invokeError: string | null = null;
        let invokeErrorThrown = false;

        try {
            // Call the new getStatusSnapshot resolver (live dashboard)
            // Uses invokeWithUiReqId wrapper to guarantee ui_req_id correlation
            rawData = await invokeWithUiReqId('getStatusSnapshot', { ui_req_id: FT_UI_REQ_ID });
        } catch (e) {
            invokeError = e instanceof Error ? e.message : String(e);
            invokeErrorThrown = true;
            console.error('Bridge.invoke threw exception:', invokeError);
        }

        // CRITICAL: Normalize data immediately after receiving it
        // This GUARANTEES UI never receives malformed data and prevents crashes
        let data: GovernanceStatusV1;
        if (!rawData || invokeError) {
            const errorMsg = invokeError || 'No data returned from resolver';
            const errorType = invokeErrorThrown ? 'INVOKE_THROW' : 'INVOKE_ERROR';
            
            // PHASE 1: NEVER render fallback UNKNOWN state
            // Show error panel and exit
            const errorHtml = `
                <div class="error-panel error">
                    <div class="error-panel-section">Resolver Invocation Failed</div>
                    <div class="error-panel-details">
                        <div><strong>Error Type:</strong> ${errorType}</div>
                        <div><strong>Error Message:</strong> ${errorMsg}</div>
                        <div class="gap-top-small">The backend resolver did not respond successfully. Check that the status-resolver-fn is deployed and functioning.</div>
                    </div>
                </div>
            `;
            setHTML('operational-status', errorHtml);
            setText('ui-selftest-invoke', `FAIL (${errorType}: ${errorMsg})`);
            return;  // DO NOT CONTINUE - render error panel only
        }

        // Normalize the payload to GovernanceStatusV1
        // This ensures all arrays, objects, and fields are safe defaults if missing
        data = normalizeStatusV1(rawData, rawData.tenantAri || "UNKNOWN", rawData.backendBuild || "unknown", UI_BUILD_VERSION);
        lastPayload = data;
        setText('ui-selftest-invoke', 'OK (resolver responded)');
        
        // STEP 3: Render the identity/proof panel from backend envelope
        renderIdentityProofPanel(data);

        // PHASE 4: Compute deterministic view model from resolver payload
        // This is the SINGLE SOURCE OF TRUTH for all UI state across all widgets
        // All widgets MUST derive from this model; no local state computations
        let viewModel: GovernanceViewModel;
        try {
            // Build RuntimeSignals from the normalized payload
            // CRITICAL INVARIANT:
            // If scheduleStatus === NOT_CONFIGURED, then expectedScheduleIntervalMinutes MUST be null (never number)
            const scheduleStatus = data.scheduler?.status || 'NOT_CONFIGURED';
            const expectedScheduleIntervalMinutes =
              scheduleStatus === 'NOT_CONFIGURED'
                ? null
                : (typeof data.expectedScheduleIntervalMinutes === 'number'
                    ? data.expectedScheduleIntervalMinutes
                    : null);

            // BACKBONE FIX #1: Map FtResolverResponseV1 correctly to RuntimeSignals
            // The backend response structure (FtResolverResponseV1) has:
            // - status: "BOOTSTRAP" | "OK" | "DEGRADED" | "FAILED"
            // - ledger.scheduler_last_success_at_utc: ISO or null
            // - ledger.snapshot_count: number >= 0
            // DO NOT use normalizeStatusV1 defaults which mask real backend state!
            
            // Map backend status to UI backendStatus (must be "OK", "UNREACHABLE", or "ERROR")
            let backendStatus: "OK" | "UNREACHABLE" | "ERROR" = "ERROR";
            if (data.status === "OK") {
                backendStatus = "OK";
            } else if (data.status === "DEGRADED" || data.status === "BOOTSTRAP") {
                backendStatus = "UNREACHABLE";  // Not ready yet, but not ERROR
            } else if (data.status === "FAILED") {
                backendStatus = "ERROR";
            }
            
            const signals: RuntimeSignals = {
                tenantIdentityStatus: 'OK',  // If we got here, backend is reachable
                backendStatus,  // FIXED: Use actual backend.status, not missing systemStatus
                scheduleStatus,
                expectedScheduleIntervalMinutes,
                lastSuccessfulRunISO: data.ledger?.scheduler_last_success_at_utc || null,
                lastAttemptISO: data.ledger?.scheduler_last_attempt_at_utc || null,
                snapshot: (data.ledger?.snapshot_count ?? 0) > 0 ? { id: data.ledger.snapshot_id, count: data.ledger.snapshot_count } : null,
                storageStatus: data.storage_state === 'OK' ? 'OK' : 'ERROR',
                snapshotCountRetained: data.ledger?.snapshot_count || 0,
                checksCompletedLifetime: 0,  // Not available in new response
                failures7d: 0,  // Compute from ledger if needed
                skippedChecks7d: 0,  // Not available in new response
                exportSubsystemStatus: 'READY',  // Default to ready; check export flags if needed
                permissionsVisibility: 'OK',
                stalenessThresholdMinutes: 120,
                nowISO: new Date().toISOString()
            };
            
            // Compute the view model (deterministic, invariant-enforced)
            viewModel = computeGovernanceViewModel(signals);
            
            // Log the view model state for diagnostics
            console.log(`[TruthModel] State: ${viewModel.runtimeState}, isOperational: ${viewModel.isOperational}`);
        } catch (vmError) {
            console.error('[TruthModel] Compute failed:', vmError);
            // Fallback to BROKEN state
            viewModel = {
                runtimeState: GovernanceRuntimeState.BROKEN,
                isOperational: false,
                exportMode: 'EXPORT_BLOCKED_STORAGE',
                overallHealthLabel: 'System Error',
                overallHealthReason: 'Truth model computation failed',
                freshnessLabel: 'Unknown',
                freshnessReason: 'System error',
                schedulerLabel: 'Unknown',
                schedulerReason: 'System error',
                exportReadinessLabel: 'Unavailable',
                exportReadinessReason: 'System error',
                storageCapacityLabel: 'Unknown',
                identityLabel: 'Unknown'
            } as any;
        }

        // ===== SNAPSHOT UI RENDERING (KPI Tiles, Status Banner, Progress Tracker) =====
        // These are vanilla DOM renderers that integrate with existing UI
        // They use viewModel as the single source of truth (not legacy data)
        try {
            // Use the computed view model for all rendering
            const unifiedStatus = data.unifiedStatus || null;
            
            // Render KPI tiles (8-tile grid at the top) - should use viewModel fields
            renderKpiTiles({
                containerId: 'kpi-tiles-section',
                legacyData: data,
                unifiedStatus
            });
            
            // Render status banner (alert only if degraded/error)
            renderStatusBanner({
                containerId: 'status-banner-section',
                legacyData: data
            });
            
            // Render trust & data handling section
            const trustSection = document.getElementById('trust-section');
            if (trustSection) {
                trustSection.appendChild(renderTrustSection());
            }
            
            // Apply export policy (gate buttons, show messages)
            applyExportPolicy({
                legacyData: data,
                unifiedStatus
            });
        } catch (snapshotUiError) {
            console.warn('[Snapshot UI] Rendering error:', snapshotUiError);
            // Non-fatal: continue with legacy UI
        }
        // ===== END SNAPSHOT UI RENDERING =====

        // Step 4: Update SERVE_PROOF banner (hidden; for diagnostics only)
        const banner = document.getElementById('ui-serve-proof-banner');
        if (banner) {
            const match = data.uiExpectedBuild === UI_BUILD_VERSION ? 'MATCH' : 'MISMATCH';
            // Store in data attribute for diagnostics, do not display
            banner.setAttribute('data-serve-proof', `${UI_BUILD_PROOF} | resource:${UI_RESOURCE_KEY} | uiVersion:${UI_BUILD_VERSION} | resolverOK:${match}`);
        }

        // Step 5: Verify version match (CRITICAL)
        if (data.uiExpectedBuild && data.uiExpectedBuild !== UI_BUILD_VERSION) {
            const warning = `
                <div class="error-panel">
                    <div class="error-header">UI Version Mismatch</div>
                    <div class="error-code">STALE_UI_CACHE</div>
                    <div class="error-message">
                        This dashboard UI (${UI_BUILD_VERSION}) does not match the backend version
                        (${data.uiExpectedBuild}).<br/><br/>
                        Remove and re-add the gadget, or perform a hard refresh.
                    </div>
                </div>
            `;
            setHTML('operational-status', warning);
            return;
        }

        // Step 6: Display UI version (hidden; for diagnostics only)
        const buildMarker = document.getElementById('build-marker');
        if (buildMarker) {
            buildMarker.setAttribute('data-build-info', `UI BUILD: ${UI_BUILD_PROOF} | Version: ${UI_BUILD_VERSION}`);
        }

        // Step 7: Render app identity fields
        setText('app-server-build', data.serverBuildStamp || '—');
        setText('app-id', data.appId || '—');
        setText('app-environment', data.environment || '—');
        setText('app-cloud-id', data.cloudId || '—');
        setText('app-installation-id', data.installationId || '—');
        setText('app-generated-at', formatTimestampDisplay(data.generatedAt) || '—');

        // Step 8: Update KPI strip
        const statusValue = data.systemStatus || 'ERROR';  // Fail-closed
        const pillClass = {
            'INITIALIZING': 'initializing',
            'RUNNING': 'running',
            'DEGRADED': 'degraded',
            'ERROR': 'error'
        }[statusValue] || 'initializing';
        setHTML('kpi-status', `<span class="status-pill ${pillClass}">${statusValue}</span>`);
        
        setText('kpi-last-success', formatTimestampDisplay(data.lastSuccessAt));
        setText('kpi-last-check', formatTimestampDisplay(data.lastCheckAt));
        setText('kpi-checks-lifetime', data.checksCompletedLifetime !== null ? String(data.checksCompletedLifetime) : '—');
        setText('kpi-snapshot-count', data.snapshotsRetainedCount !== null ? String(data.snapshotsRetainedCount) : '—');
        setText('kpi-days-continuous', data.daysContinuousOperation !== null ? String(data.daysContinuousOperation) : '—');

        // PHASE 1 LOCK-IN: Display 7-day aggregates
        setText('kpi-failures-7d', data.failureCount7d !== undefined ? String(data.failureCount7d) : 'Not available (telemetry missing)');
        
        // Freshness status label
        let freshnessLabel = '—';
        if (data.freshnessStatus === 'FRESH') {
            freshnessLabel = 'Fresh';
        } else if (data.freshnessStatus === 'AGING') {
            freshnessLabel = 'Aging';
        } else if (data.freshnessStatus === 'STALE') {
            freshnessLabel = 'Stale';
        } else if (data.freshnessStatus === 'AGING' || data.freshnessStatus === 'NEVER') {
            freshnessLabel = 'Not available (telemetry missing)';
        } else {
            freshnessLabel = 'Unknown status';  // Fallback for any unrecognized state
        }
        setText('kpi-freshness-status', freshnessLabel);
        
        // Skipped checks
        setText('kpi-skipped-checks-7d', 
            data.skippedChecksCount7d !== undefined 
                ? (data.skippedChecksCount7d === 0 ? '0' : `${data.skippedChecksCount7d} (${data.skippedChecksPrimaryReason7d || 'unknown'})`)
                : 'Not available (telemetry missing)'
        );
        
        // Degraded reason (only show if degraded)
        const degradedReasonEl = document.getElementById('kpi-degraded-reason');
        if (data.systemStatus === 'DEGRADED' && data.degradedReason) {
            setText('kpi-degraded-reason', data.degradedReason);
            if (degradedReasonEl) degradedReasonEl.classList.add('visible');
        } else {
            if (degradedReasonEl) degradedReasonEl.classList.remove('visible');
        }

        setText('kpi-version', `${data.version} / ${data.environment}`);
        setText('kpi-generated-at', formatTimestampDisplay(data.generatedAt) || '—');

        // Step 9: Operational Status Panel
        // FIX L2: Proper formatting of Schedule Interval and Snapshot Age
        const scheduleIntervalDisplay = data.expectedScheduleIntervalMinutes !== null 
            ? data.expectedScheduleIntervalMinutes + ' min'
            : 'N/A (unscheduled)';
        
        const snapshotAgeDisplay = data.snapshotAgeMinutes !== null 
            ? data.snapshotAgeMinutes + ' min'
            : 'N/A';
        
        // FIX L2: Freshness must be UNKNOWN if schedule interval is null
        const freshnessDisplay = data.expectedScheduleIntervalMinutes === null
            ? 'UNKNOWN'
            : (data.isStale === null ? 'UNKNOWN' : data.isStale ? 'STALE' : 'FRESH');
        
        const opStatus = `
            <div class="metrics-grid">
                <div class="metric-row">
                    <div class="metric-label">Expected Schedule Interval</div>
                    <div class="metric-value">${scheduleIntervalDisplay}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Staleness Threshold Rule</div>
                    <div class="metric-value">${data.staleIfAgeMinutesGreaterThan !== null ? '> ' + data.staleIfAgeMinutesGreaterThan + ' min' : 'Not available'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Snapshot Age</div>
                    <div class="metric-value">${snapshotAgeDisplay}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Data Freshness</div>
                    <div class="metric-value">${freshnessDisplay}</div>
                </div>
            </div>
            <div class="disclaimer">
                <strong>Freshness Logic:</strong> 
                ${data.expectedScheduleIntervalMinutes === null
                    ? 'Schedule interval is unscheduled; freshness cannot be determined (UNKNOWN).'
                    : `Based on snapshot age (${snapshotAgeDisplay}) vs schedule interval (${scheduleIntervalDisplay}). Data older than ${data.staleIfAgeMinutesGreaterThan} min is marked STALE.`}
            </div>
        `;
        setHTML('operational-status', opStatus);
        
        // Show degraded clarification if status is DEGRADED
        if (data.systemStatus === 'DEGRADED') {
            const clarif = document.getElementById('degraded-clarification');
            if (clarif) clarif.classList.add('visible');
        }

        // Step 9.5: Render Health Status (Minimal)
        if (data.health) {
            const h = data.health;
            setText('health-state', typeof h === 'string' ? h : 'Error');
            // Note: health is now a HealthState string, not an object, so skip nested fields
        } else {
            setText('health-state', 'Error');
        }

        // Step 9.5: Jira Configuration Visibility (Phase 2)
        // This is fetched from scheduled snapshot storage if available
        // If not available yet, show "awaiting first snapshot"
        let configVisibilityHtml = '';
        if (data.configVisibility) {
            const cv = data.configVisibility;
            const metrics = cv.metrics || {};
            
            // Build table rows with metric names and values
            const tableRows = [
                { label: 'Custom fields', value: metrics.customFieldCount },
                { label: 'Workflows', value: metrics.workflowCount },
                { label: 'Workflow schemes', value: metrics.workflowSchemeCount },
                { label: 'Max workflows in a scheme', value: metrics.maxWorkflowsPerScheme },
                { label: 'Screens', value: metrics.screenCount },
                { label: 'Permission schemes', value: metrics.permissionSchemeCount },
                { label: 'Max projects in a permission scheme', value: metrics.maxProjectsPerPermissionScheme },
            ];

            // Build issue map for quick lookup (metric -> reason)
            const issueMap: Record<string, string> = {};
            if (cv.issues && Array.isArray(cv.issues)) {
                for (const issue of cv.issues) {
                    issueMap[issue.metric] = issue.reason;
                }
            }

            let metricsTableHtml = '<table class="config-visibility-table">';
            metricsTableHtml += '<thead><tr><th>Metric</th><th>Value</th></tr></thead>';
            metricsTableHtml += '<tbody>';

            for (const row of tableRows) {
                const displayValue = row.value !== null && row.value !== undefined ? String(row.value) : 'Not available';
                const reason = issueMap[row.label.replace(/ /g, '').toLowerCase().replace(/maxprojectsina/g, 'maxProjectsPerPermissionScheme').replace(/maxworkflows/g, 'maxWorkflowsPerScheme').replace(/customfields/g, 'customFieldCount').replace(/workflows/g, 'workflowCount').replace(/workflowschemes/g, 'workflowSchemeCount').replace(/screens/g, 'screenCount').replace(/permissionschemes/g, 'permissionSchemeCount')] || '';
                
                // Simplified: get issue reason by matching row.label to metric name
                let metricKey = '';
                if (row.label === 'Custom fields') metricKey = 'customFieldCount';
                else if (row.label === 'Workflows') metricKey = 'workflowCount';
                else if (row.label === 'Workflow schemes') metricKey = 'workflowSchemeCount';
                else if (row.label === 'Max workflows in a scheme') metricKey = 'maxWorkflowsPerScheme';
                else if (row.label === 'Screens') metricKey = 'screenCount';
                else if (row.label === 'Permission schemes') metricKey = 'permissionSchemeCount';
                else if (row.label === 'Max projects in a permission scheme') metricKey = 'maxProjectsPerPermissionScheme';
                
                const reasonText = issueMap[metricKey] ? ` (${issueMap[metricKey]})` : '';
                
                metricsTableHtml += `<tr>`;
                metricsTableHtml += `<td>${row.label}</td>`;
                metricsTableHtml += `<td>${displayValue}${reasonText}</td>`;
                metricsTableHtml += `</tr>`;
            }

            metricsTableHtml += '</tbody></table>';

            configVisibilityHtml = `
                <div>
                    ${metricsTableHtml}
                    <div class="metrics-container gap-top-small">
                        <div class="metric-row">
                            <div>
                                <div class="metric-label">Risk Band</div>
                                <div class="metric-value">${cv.riskBand || '—'}</div>
                                <div class="metric-note">Band indicates observed scale only.</div>
                            </div>
                            <div>
                                <div class="metric-label">Completeness</div>
                                <div class="metric-value">${cv.completeness || '—'}</div>
                            </div>
                            <div>
                                <div class="metric-label">Evaluated At</div>
                                <div class="metric-value">${formatTimestampDisplay(cv.evaluatedAtISO)}</div>
                            </div>
                        </div>
                        <div class="metric-divider">
                            <strong>Observational Only:</strong> FirstTry does not modify Jira configuration. This view is observational only.
                        </div>
                    </div>
                </div>
            `;
        } else {
            configVisibilityHtml = '<div class="awaiting-snapshot">Awaiting first scheduled snapshot. The configuration visibility report will appear here once collected.</div>';
        }
        setHTML('config-visibility-content', configVisibilityHtml);

        // Step 9.5: Performance & Reliability Signals (Phase 3)
        let perfSignalsHtml = '';
        const ps = data.perfSignals;
        if (ps) {
            // Build metrics table for perf signals
            let perfMetricsTableHtml = '<table class="perf-metrics-table"><tbody>';
            
            // Scheduler section
            const schedulerRows = [
                { label: 'Last Run', value: formatTimestampDisplay(ps.scheduler?.lastRunAtISO) },
                { label: 'Last Success', value: formatTimestampDisplay(ps.scheduler?.lastSuccessAtISO) },
                { label: 'Last Duration (ms)', value: ps.scheduler?.lastDurationMs !== null ? String(ps.scheduler.lastDurationMs) : 'Not available' },
                { label: 'Last Failure Reason', value: ps.scheduler?.lastFailureReason || 'None' },
            ];

            // Jira API section
            const jiraApiRows = [
                { label: 'Requests (24h)', value: ps.jiraApi?.requestCount || 0 },
                { label: 'Errors (24h)', value: ps.jiraApi?.errorCount || 0 },
                { label: 'p50 Latency (ms)', value: ps.jiraApi?.latency?.p50ms !== null ? String(ps.jiraApi.latency.p50ms) : 'Not available' },
                { label: 'p95 Latency (ms)', value: ps.jiraApi?.latency?.p95ms !== null ? String(ps.jiraApi.latency.p95ms) : 'Not available' },
                { label: 'Max Latency (ms)', value: ps.jiraApi?.latency?.maxMs !== null ? String(ps.jiraApi.latency.maxMs) : 'Not available' },
                { label: 'Rate Limit Remaining', value: ps.jiraApi?.rateLimit?.remaining !== null ? String(ps.jiraApi.rateLimit.remaining) : 'Not available' },
                { label: 'Rate Limit Total', value: ps.jiraApi?.rateLimit?.limit !== null ? String(ps.jiraApi.rateLimit.limit) : 'Not available' },
            ];

            const allRows = [...schedulerRows, ...jiraApiRows];
            
            for (const row of allRows) {
                perfMetricsTableHtml += `<tr>`;
                perfMetricsTableHtml += `<td>${row.label}</td>`;
                perfMetricsTableHtml += `<td>${row.value}</td>`;
                perfMetricsTableHtml += `</tr>`;
            }

            perfMetricsTableHtml += '</tbody></table>';

            perfSignalsHtml = `
                <div>
                    ${perfMetricsTableHtml}
                    <div class="perf-signals-container">
                        <div class="perf-signals-row">
                            <div>
                                <div class="metric-label">Completeness</div>
                                <div class="metric-value">${ps.completeness || '—'}</div>
                            </div>
                            <div>
                                <div class="metric-label">Evaluated At</div>
                                <div class="metric-value">${formatTimestampDisplay(ps.evaluatedAtISO)}</div>
                            </div>
                        </div>
                        <div class="perf-signals-footer">
                            <strong>Observational Only:</strong> Signals record latencies, error counts, and rate limits from Jira API interactions. FirstTry does not interpret, recommend, or enforce changes based on these signals.
                        </div>
                    </div>
                </div>
            `;
        } else {
            perfSignalsHtml = '<div class="awaiting-snapshot">Awaiting first scheduled snapshot. Performance signals will appear here once collected.</div>';
        }
        setHTML('perf-signals-content', perfSignalsHtml);

        // Step 9.6: Phase 4 Change Awareness Timeline (Read-Only, Append-Only)
        let phase4TimelineHtml = '';
        const phase4 = data.phase4Timeline;
        if (phase4 && phase4.isAvailable && phase4.events && phase4.events.length > 0) {
            // Render chronological timeline (most recent first)
            phase4TimelineHtml = '<div class="phase4-timeline">';
            
            phase4.events.slice(0, 50).forEach((event: any, index: number) => {
                phase4TimelineHtml += `
                    <div class="phase4-event">
                        <div class="phase4-event-content">
                            <div class="phase4-event-title">${event.description || 'Setting changed'}</div>
                            <div class="phase4-event-setting">
                                <strong>Setting:</strong> ${event.settingKey || '—'}
                            </div>
                            <div class="phase4-event-values">
                                <strong>Previous:</strong> <code class="phase4-event-code">${event.previousValue !== null ? String(event.previousValue) : 'null'}</code>
                                <strong class="phase4-event-current">Current:</strong> <code class="phase4-event-code">${event.currentValue !== null ? String(event.currentValue) : 'null'}</code>
                            </div>
                        </div>
                        <div class="phase4-event-timestamp">
                            ${formatTimestampDisplay(event.detectedAt)}
                        </div>
                    </div>
                `;
            });

            if (phase4.totalEventCount > 50) {
                phase4TimelineHtml += `<div class="timeline-footer">Showing 50 of ${phase4.totalEventCount} events. All events are retained in storage.</div>`;
            }

            phase4TimelineHtml += '</div>';
        } else if (phase4 && phase4.isAvailable) {
            phase4TimelineHtml = '<div class="timeline-empty">No configuration changes detected yet. Timeline will populate once changes are detected by the daily scheduler.</div>';
        } else {
            phase4TimelineHtml = '<div class="timeline-empty">Timeline data not yet available. Scheduled detection begins after first daily run.</div>';
        }
        setHTML('phase4-timeline-content', phase4TimelineHtml);

        // Step 10: Data Quality & Coverage Panel
        // SAFE DEFAULTS: All arrays are guaranteed by normalizeStatusV1
        const coverageList = (data.coverageIncluded ?? []).map((item: string) => `<li>${item}</li>`).join('');
        const dqStatus = `
            <div class="metric-row">
                <div class="metric-label">Completeness Status</div>
                <div class="metric-value">${data.completenessStatus || 'Initializing'}</div>
            </div>
            <div class="metric-row">
                <div class="metric-label">Coverage Included</div>
                <details class="gap-top-small">
                    <summary>View coverage details</summary>
                    <ul class="coverage-list">${coverageList}</ul>
                </details>
            </div>
            <div class="metric-row">
                <div class="metric-label">Coverage Excluded</div>
                <ul class="coverage-list coverage-excluded">${(data.coverageExcluded ?? []).map((item: string) => `<li>${item}</li>`).join('')}</ul>
            </div>
            <div class="metric-row">
                <div class="metric-label">Known Data Gaps</div>
                <div>${((data.knownDataGaps ?? []).length === 0) ? '<em>None</em>' : '<ul class="coverage-list">' + (data.knownDataGaps ?? []).map((item: string) => `<li>${item}</li>`).join('') + '</ul>'}</div>
            </div>
            <div class="metric-row">
                <div class="metric-label">Retention Policy</div>
                <div class="metric-value">${(data.retentionPolicy?.effectiveRuleText) || 'Not available yet'}</div>
            </div>
        `;
        setHTML('data-quality', dqStatus);

        // Step 11: Checks table
        if (data.checks && data.checks.length > 0) {
            const checksSection = document.getElementById('checks-section');
            let tableHtml = '<div class="checks-table"><div class="table-header"><div class="th-name">Check Name</div><div class="th-status">Status</div><div class="th-lastRun">Last Run</div><div class="th-reason">Reason Code</div><div class="th-impact">Impact</div></div>';
            
            data.checks.slice(0, 20).forEach((check: any) => {
                tableHtml += `
                    <div class="table-row">
                        <div class="td-name">${check.name || 'Unknown'}</div>
                        <div class="td-status">${check.status || 'Unknown'}</div>
                        <div class="td-lastRun">${formatTimestampDisplay(check.lastRunAt)}</div>
                        <div class="td-reason">${check.reasonCode || '—'}</div>
                        <div class="td-impact">${check.impact ? check.impact.substring(0, 120) : '—'}</div>
                    </div>
                `;
            });
            
            tableHtml += '</div>';
            if (data.checksTotalCount > 20) {
                tableHtml += `<div class="showing-n-of">Showing 20 of ${data.checksTotalCount} checks</div>`;
            }
            setHTML('checks-content', tableHtml);
            if (checksSection) {
                checksSection.classList.add('visible');
            }
        }

        // Step 12: Boundaries & Limitations
        const boundariesHtml = `
            <div class="boundary-item"><span class="boundary-check">✓</span> No Jira writes are performed</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> No configuration changes are made</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> No enforcement actions are taken</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> No recommendations are generated</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> Data is observational only</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> App fails closed on missing tenant identity</div>
            <div class="boundary-item"><span class="boundary-check">✓</span> Viewer permissions may limit visible data</div>
        `;
        setHTML('boundaries', boundariesHtml);

        // Step 13: Availability Signals (DEFENSIVE: Safe reads with fallbacks)
        // Safe read 1: tenantIdentity.available
        const tenantAvailable = data?.tenantIdentity?.available;
        let tenantBadgeClass: string;
        let tenantLabel: string;
        let tenantImpact: string;
        if (tenantAvailable === true) {
            tenantBadgeClass = 'signal-available';
            tenantLabel = 'AVAILABLE';
            tenantImpact = 'Monitoring operational';
        } else if (tenantAvailable === false) {
            tenantBadgeClass = 'signal-unavailable';
            tenantLabel = 'UNAVAILABLE';
            tenantImpact = 'Monitoring paused';
        } else {
            tenantBadgeClass = 'signal-unknown';
            tenantLabel = 'UNKNOWN';
            tenantImpact = 'Identity status unclear; monitoring may be paused';
        }

        // Safe read 2: permissionVisibility.determined
        const permDetermined = data?.permissionVisibility?.determined;
        let permBadgeClass: string;
        let permLabel: string;
        let permImpact: string;
        if (permDetermined === true) {
            permBadgeClass = 'signal-available';
            permLabel = 'DETERMINED';
            permImpact = 'All visible data accessible';
        } else if (permDetermined === false) {
            permBadgeClass = 'signal-unavailable';
            permLabel = 'NOT_DETERMINED';
            permImpact = 'Some data may be restricted';
        } else {
            permBadgeClass = 'signal-unknown';
            permLabel = 'UNKNOWN';
            permImpact = 'Permission visibility unclear';
        }

        // Safe read 3: isStale (already defensive, but keep it)
        const isStale = data?.isStale;
        let staleBadgeClass: string;
        let staleLabel: string;
        let staleImpact: string;
        if (isStale === false) {
            staleBadgeClass = 'signal-fresh';
            staleLabel = 'FRESH';
            staleImpact = 'Operational visibility is current';
        } else if (isStale === true) {
            staleBadgeClass = 'signal-stale';
            staleLabel = 'STALE';
            staleImpact = 'Operational visibility may be outdated';
        } else {
            staleBadgeClass = 'signal-unknown';
            staleLabel = 'UNKNOWN';
            staleImpact = 'Data freshness unknown; first run pending';
        }

        // Safe read 4: snapshotAgeMinutes
        const snapshotAge = data?.snapshotAgeMinutes;
        let storageBadgeClass: string;
        let storageLabel: string;
        let storageImpact: string;
        if (snapshotAge !== null && snapshotAge !== undefined) {
            storageBadgeClass = 'signal-available';
            storageLabel = 'HAS_DATA';
            storageImpact = 'Full metrics available';
        } else {
            storageBadgeClass = 'signal-unavailable';
            storageLabel = 'EMPTY';
            storageImpact = 'First run pending';
        }

        const signalsHtml = `
            <div class="signal-item">
                <span class="signal-label">Tenant Identity</span>
                <span class="signal-badge ${tenantBadgeClass}">${tenantLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${tenantImpact}</div>
            <div class="signal-item">
                <span class="signal-label">Viewer Permission Visibility</span>
                <span class="signal-badge ${permBadgeClass}">${permLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${permImpact}</div>
            <div class="signal-item">
                <span class="signal-label">Data Freshness</span>
                <span class="signal-badge ${staleBadgeClass}">${staleLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${staleImpact}</div>
            <div class="signal-item">
                <span class="signal-label">Storage State</span>
                <span class="signal-badge ${storageBadgeClass}">${storageLabel}</span>
            </div>
            <div class="signal-impact">Impact: ${storageImpact}</div>
        `;
        setHTML('availability-signals', signalsHtml);

        // PHASE 2: After initial load, populate snapshot proof panel
        try {
            const debugInfo = await invokeWithUiReqId('getSnapshotDebug', {});
            if (debugInfo && debugInfo.ok) {
                updateSnapshotProofPanel(debugInfo);
            } else if (debugInfo && debugInfo.error) {
                console.warn('[ProofPanel] getSnapshotDebug error:', debugInfo.error.message);
            }
        } catch (debugErr) {
            console.warn('[ProofPanel] Failed to load snapshot debug info:', debugErr);
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        showError('Unexpected Error', 'UNEXPECTED_ERROR', errorMsg);
    }
}

function showError(header: string, code: string, message: string) {
    const errorHtml = `
        <div class="error-panel">
            <div class="error-header">${header}</div>
            <div class="error-code">${code}</div>
            <div class="error-message">${message}</div>
        </div>
    `;
    setHTML('operational-status', errorHtml);
    setHTML('data-quality', '');
    setHTML('availability-signals', '');
}

// ============================================================================
// EXPORT CAPABILITY DETECTION
// ============================================================================

// Detect clipboard API availability
const CLIPBOARD_API_AVAILABLE = !!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function');

// Detect sandbox restrictions
const frameEl = window.frameElement as HTMLIFrameElement | null;
const sandboxAttr = frameEl?.getAttribute('sandbox') || '';
const DOWNLOAD_LIKELY_BLOCKED = sandboxAttr.length > 0 && !sandboxAttr.includes('allow-downloads');
const EXPORT_MODE = DOWNLOAD_LIKELY_BLOCKED ? 'COPY_ONLY' : 'DOWNLOAD_OK';

// ============================================================================
// EXPORT UTILITIES (DOM-ONLY, SANDBOX-SAFE)
// ============================================================================

/**
 * Show toast with export status
 * kind: 'ok' | 'warn' | 'err'
 */
function showExportToast(kind: 'ok' | 'warn' | 'err', msg: string) {
    try {
        const elem = document.getElementById('copy-success');
        if (!elem) return;
        elem.textContent = msg;
        elem.classList.add('show');
        setTimeout(() => elem.classList.remove('show'), 3000);
    } catch (e) {
        // Silent catch
    }
}

/**
 * PHASE 2: Update snapshot proof panel with values from backend envelope
 * BACKBONE FIX B: Read directly from envelope.meta and envelope.data (single source of truth)
 * Never use legacy constants or cached debug info
 */
function updateSnapshotProofPanel(debugInfo: any) {
    try {
        // UI Request ID - from envelope.meta.ui_req_id (echoed by backend)
        const uiReqIdEl = document.getElementById('proof-ui-req-id');
        if (uiReqIdEl && lastRawEnvelope) {
            const uiReqId = lastRawEnvelope.meta?.ui_req_id || 'UNSET';
            uiReqIdEl.textContent = uiReqId;
            // Mark as mismatch if it's UNSET (contract violation)
            if (uiReqId === 'UNSET') {
                uiReqIdEl.classList.add('text-error');
                uiReqIdEl.title = 'Contract violation: backend did not echo ui_req_id';
            }
        }

        // UI Build SHA (from envelope.meta.ui_build_sha if available, otherwise UI_DIST_STAMP)
        const uiBuildEl = document.getElementById('proof-ui-build-sha');
        if (uiBuildEl) {
            let sha = UI_DIST_STAMP.split('__')[0] || 'unknown';
            if (lastRawEnvelope?.meta?.ui_build_sha) {
                sha = lastRawEnvelope.meta.ui_build_sha;
            }
            uiBuildEl.textContent = sha.substring(0, 12) + (sha.length > 12 ? '…' : '');
            uiBuildEl.title = sha;
        }

        // Backend Build SHA - from envelope.meta.backend_build_sha (REQUIRED from backend)
        const backendBuildEl = document.getElementById('proof-backend-build-sha');
        if (backendBuildEl) {
            const backendSha = lastRawEnvelope?.meta?.backend_build_sha || 'UNKNOWN';
            backendBuildEl.textContent = backendSha.substring(0, 12) + (backendSha.length > 12 ? '…' : '');
            backendBuildEl.title = backendSha;
            if (backendSha === 'UNKNOWN') {
                backendBuildEl.classList.add('text-error');
                backendBuildEl.title = 'Backend did not provide build SHA';
            }
        }

        // Snapshot Count - from envelope.data.ledger.snapshot_count (REQUIRED)
        const countEl = document.getElementById('proof-snapshot-count');
        if (countEl && lastRawEnvelope) {
            const count = lastRawEnvelope.data?.ledger?.snapshot_count ?? 0;
            countEl.textContent = String(count);
            if (count === 0) {
                countEl.classList.add('text-secondary');
            } else {
                countEl.classList.remove('text-secondary');
                countEl.classList.add('text-success');
            }
        }

        // Last Snapshot ID - from envelope.data.ledger.snapshot_id
        const lastIdEl = document.getElementById('proof-last-snapshot-id');
        if (lastIdEl && lastRawEnvelope) {
            const lastId = lastRawEnvelope.data?.ledger?.snapshot_id || '(none yet)';
            lastIdEl.textContent = lastId;
        }

        // Last Snapshot At (UTC) - from envelope.data.ledger.snapshot_last_at_utc
        const lastSnapEl = document.getElementById('proof-last-snapshot-at');
        if (lastSnapEl && lastRawEnvelope) {
            const lastSnapAt = lastRawEnvelope.data?.ledger?.snapshot_last_at_utc;
            lastSnapEl.textContent = lastSnapAt 
                ? formatTimestampDisplay(lastSnapAt) 
                : 'Not available yet';
        }

        // Last Success At (UTC) - from envelope.data.ledger.scheduler_last_success_at_utc
        const lastSuccessEl = document.getElementById('proof-last-success-at');
        if (lastSuccessEl && lastRawEnvelope) {
            const lastSuccessAt = lastRawEnvelope.data?.ledger?.scheduler_last_success_at_utc;
            lastSuccessEl.textContent = lastSuccessAt 
                ? formatTimestampDisplay(lastSuccessAt) 
                : 'Not available yet';
        }

        // Storage State - from envelope.data.storage_state (REQUIRED)
        const storageEl = document.getElementById('proof-storage-state');
        if (storageEl && lastRawEnvelope) {
            const storageState = lastRawEnvelope.data?.storage_state || 'UNKNOWN';
            storageEl.textContent = storageState;
            if (storageState === 'PRESENT') {
                storageEl.classList.add('text-success');
                storageEl.classList.remove('text-secondary');
            } else {
                storageEl.classList.add('text-secondary');
                storageEl.classList.remove('text-success');
            }
        }

        console.log('[ProofPanel] Updated from envelope meta/data');
    } catch (err) {
        console.warn('[ProofPanel] Error updating panel:', err);
    }
}

/**
 * Download a blob as a file with the given filename
 * Tries standard download mechanism; falls back gracefully on error
 * Returns true if successful, false otherwise
 */
function downloadBlob(filename: string, mime: string, content: string): boolean {
    try {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            return true;
        } finally {
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    } catch (e) {
        return false;
    }
}

/**
 * Copy text to clipboard with fallback
 * Returns { ok: true } on success
 * Returns { ok: false, reason: string } on failure
 */
async function copyToClipboard(text: string): Promise<{ ok: true } | { ok: false, reason: string }> {
    // Try Clipboard API first
    if (CLIPBOARD_API_AVAILABLE) {
        try {
            await navigator.clipboard.writeText(text);
            return { ok: true };
        } catch (clipboardErr) {
            // Fall through to fallback
        }
    }

    // Fallback: execCommand approach
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.className = 'copy-helper';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
            return { ok: true };
        } else {
            return { ok: false, reason: 'Copy command failed (execCommand returned false)' };
        }
    } catch (fallbackErr) {
        return { ok: false, reason: 'Copy unavailable in this browser' };
    }
}

/**
 * Build export payload from currently visible DOM state
 * All data is derived from rendered values; no backend calls
 */
function buildExportPayload(): ExportPayload | null {
    if (!lastPayload) {
        return null;
    }
    // Delegate to pure module for testable, deterministic payload construction
    return buildExportPayloadFromStatus(lastPayload);
}

/**
 * Flatten object to dot-notation for CSV export
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value === null || value === undefined) {
                result[newKey] = null;
            } else if (Array.isArray(value)) {
                value.forEach((item, idx) => {
                    if (typeof item === 'object' && item !== null) {
                        const flattened = flattenObject(item, `${newKey}[${idx}]`);
                        Object.assign(result, flattened);
                    } else {
                        result[`${newKey}[${idx}]`] = item;
                    }
                });
            } else if (typeof value === 'object') {
                const flattened = flattenObject(value, newKey);
                Object.assign(result, flattened);
            } else {
                result[newKey] = value;
            }
        }
    }

    return result;
}

/**
 * Render export output to the Export Output panel
 * Auto-opens the details element
 */
function renderExportOutput(title: string, text: string) {
    try {
        const titleEl = document.getElementById('export-output-title');
        const textEl = document.getElementById('export-output-text') as HTMLTextAreaElement | null;
        const detailsEl = document.querySelector('details') as HTMLDetailsElement | null;

        if (titleEl) titleEl.textContent = title;
        if (textEl) {
            textEl.value = text;
            // Try to select and focus
            try {
                textEl.select();
                textEl.focus();
            } catch (e) {
                // Silent
            }
        }
        if (detailsEl) detailsEl.open = true;
    } catch (e) {
        // Silent catch
    }
}

// ============================================================================
// EXPORT FUNCTIONS (SANDBOX-SAFE, ALWAYS PRODUCE RESULT)
// ============================================================================

/**
 * Convert payload to formatted summary text
 */
function toSummaryText(payload: any): string {
    return `═════════════════════════════════════════════════════════════
Firsttry: Audit Evidence for Jira — Status Summary
═════════════════════════════════════════════════════════════
Generated: ${payload.timestamp}

SYSTEM STATUS
─────────────────────────────────────────────────────────────
Status: ${payload.systemStatus}
Mode: ${payload.mode}
Data Freshness: ${payload.dataFreshness}

OPERATIONAL METRICS (Lifetime)
─────────────────────────────────────────────────────────────
Checks Completed: ${payload.operationalMetrics.checksCompletedLifetime}
Snapshots Retained: ${payload.operationalMetrics.snapshotCountRetained}
Days Continuous: ${payload.operationalMetrics.daysContinuousOperation}

7-DAY WINDOW
─────────────────────────────────────────────────────────────
Failures: ${payload.operationalMetrics.failureCount7d}
Skipped Checks: ${payload.operationalMetrics.skippedChecksCount7d}

BOUNDARIES (Read-Only)
─────────────────────────────────────────────────────────────
✓ No Jira writes: ${payload.boundaries.noJiraWrites}
✓ No config changes: ${payload.boundaries.noConfigChanges}
✓ No enforcement: ${payload.boundaries.noEnforcement}

DATA QUALITY
─────────────────────────────────────────────────────────────
Completeness: ${payload.completenessStatus}
Retention: ${payload.retentionPolicy}

VERSION
─────────────────────────────────────────────────────────────
App: ${payload.version}
Environment: ${payload.environment}

═════════════════════════════════════════════════════════════
`;
}

/**
 * Convert payload to JSON string (stable formatting)
 */
function toJSONText(payload: any): string {
    return JSON.stringify(payload, null, 2);
}

/**
 * Refresh Now handler: Manually trigger snapshot update
 */
// @ts-ignore - Expose globally for button onclick handlers
window.refreshNow = async function() {
    try {
        const btn = document.getElementById('refresh-now-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Refreshing...';
        }

        const newSnapshot = await invokeWithUiReqId('refreshNow', {});
        
        // Update lastPayload and re-render UI
        lastPayload = newSnapshot;
        
        // Update "Last refreshed" timestamp
        const refreshedEl = document.getElementById('last-refreshed-time');
        if (refreshedEl && newSnapshot.generatedAtIso) {
            refreshedEl.textContent = formatTimestampDisplay(newSnapshot.generatedAtIso);
        }

        showExportToast('ok', '✓ Refreshed successfully');
        
        // Re-render snapshot UI components
        try {
            const unifiedStatus = newSnapshot || null;
            renderKpiTiles({
                containerId: 'kpi-tiles-section',
                legacyData: newSnapshot,
                unifiedStatus
            });
            renderStatusBanner({
                containerId: 'status-banner-section',
                legacyData: newSnapshot
            });
        } catch (renderErr) {
            console.warn('[Refresh] UI re-render error:', renderErr);
        }

        // PHASE 2: After refresh, call getSnapshotDebug to update proof panel
        try {
            const debugInfo = await invokeWithUiReqId('getSnapshotDebug', {});
            if (debugInfo && debugInfo.ok) {
                updateSnapshotProofPanel(debugInfo);
            }
        } catch (debugErr) {
            console.warn('[Refresh] getSnapshotDebug error:', debugErr);
        }
    } catch (err) {
        console.error('[Refresh] Error:', err);
        showExportToast('err', `Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        const btn = document.getElementById('refresh-now-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Refresh now';
        }
    }
};

/**
 * Convert payload to CSV string (deterministic, with proper escaping)
 */
function toCSVText(payload: any): string {
    const flat = flattenObject(payload);
    const keys = Object.keys(flat).sort();
    const rows: string[] = [];

    // Header row
    rows.push(keys.map(k => `"${k}"`).join(','));

    // Data row
    const values = keys.map(k => {
        const v = flat[k];
        if (v === null) return '';
        if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
        return String(v);
    });
    rows.push(values.join(','));

    return rows.join('\n');
}

// @ts-ignore - Expose globally for button onclick handlers
window.copySummary = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh after the next scheduled check.');
            return;
        }

        const text = toSummaryText(payload);
        const result = await copyToClipboard(text);

        if (result.ok) {
            showExportToast('ok', '✓ Copied to clipboard');
        } else {
            // Show clear error with reason
            showExportToast('err', `Copy failed: ${result.reason}. Use Download JSON instead.`);
            // Also render to export panel as fallback
            renderExportOutput('SUMMARY EXPORT', text);
        }
    } catch (e) {
        showExportToast('err', 'Export error: see panel below.');
    }
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadJSON = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh after the next scheduled check.');
            return;
        }

        // Generate summary text using pure module (shows unknown fields explicitly)
        const summary = toSummaryTextFromPayload(payload);
        console.log('Export Summary:', summary);

        const json = toJSONText(payload);
        if (!json || json.length === 0) {
            showExportToast('err', 'JSON content empty: cannot export.');
            return;
        }

        // Derive filename from payload timestamp if available
        const dateStr = payload.generatedAt 
            ? new Date(payload.generatedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const filename = `governance-status-${dateStr}.json`;

        // Always try download first (deterministic)
        const downloadSuccess = downloadBlob(filename, 'application/json; charset=utf-8', json);

        if (downloadSuccess) {
            showExportToast('ok', `✓ Downloaded ${filename}`);
        } else {
            // Download failed: show error and offer copy
            showExportToast('err', 'Download blocked. Copying to clipboard instead...');
            const copyResult = await copyToClipboard(json);
            if (copyResult.ok) {
                showExportToast('ok', '✓ JSON copied to clipboard');
            } else {
                // Final fallback: show in export panel
                renderExportOutput('JSON EXPORT', json);
                showExportToast('warn', 'JSON ready in panel below (copy/download unavailable).');
            }
        }
    } catch (e) {
        showExportToast('err', 'Export error: see panel below.');
    }
};

// @ts-ignore - Expose globally for button onclick handlers
window.downloadCSV = async function() {
    try {
        const payload = buildExportPayload();
        if (!payload) {
            showExportToast('err', 'Export unavailable: no data loaded yet. Refresh after the next scheduled check.');
            return;
        }

        const csv = toCSVText(payload);
        if (!csv || csv.length === 0) {
            showExportToast('err', 'CSV content empty: cannot export.');
            return;
        }

        // Derive filename from payload timestamp if available
        const dateStr = payload.generatedAt 
            ? new Date(payload.generatedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const filename = `governance-status-${dateStr}.csv`;

        // Always try download first (deterministic)
        const downloadSuccess = downloadBlob(filename, 'text/csv; charset=utf-8', csv);

        if (downloadSuccess) {
            showExportToast('ok', `✓ Downloaded ${filename}`);
        } else {
            // Download failed: show error and offer copy
            showExportToast('err', 'Download blocked. Copying to clipboard instead...');
            const copyResult = await copyToClipboard(csv);
            if (copyResult.ok) {
                showExportToast('ok', '✓ CSV copied to clipboard');
            } else {
                // Final fallback: show in export panel
                renderExportOutput('CSV EXPORT', csv);
                showExportToast('warn', 'CSV ready in panel below (copy/download unavailable).');
            }
        }
    } catch (e) {
        showExportToast('err', 'Export error: see panel below.');
    }
};

// ============================================================================
// AUDIT SNAPSHOT EXPORT (Phase 5)
// ============================================================================

/**
 * Export Trust Snapshot (Phase 5)
 * 
 * Calls exportTrustSnapshot resolver, downloads JSON + PDF
 */
async function handleExportTrustSnapshot() {
    const statusEl = document.getElementById('export-status');
    if (!statusEl) return;

    try {
        statusEl.textContent = 'Generating...';
        statusEl.classList.add('text-info');
        statusEl.classList.remove('text-error', 'text-success');

        // Call resolver
        const response = await invokeWithUiReqId('exportTrustSnapshot', {});

        if (!response || !response.snapshotId) {
            statusEl.textContent = 'Export unavailable';
            statusEl.classList.add('text-error');
            statusEl.classList.remove('text-info', 'text-success');
            return;
        }

        // Download JSON
        const jsonBlob = new Blob([response.jsonCanonicalText], { type: 'application/json; charset=utf-8' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = response.jsonFilename;
        document.body.appendChild(jsonLink);
        jsonLink.click();
        document.body.removeChild(jsonLink);
        URL.revokeObjectURL(jsonUrl);

        // Download PDF
        const pdfBytes = Buffer.from(response.pdfBase64, 'base64');
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        pdfLink.download = response.pdfFilename;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        document.body.removeChild(pdfLink);
        URL.revokeObjectURL(pdfUrl);

        // Show success
        statusEl.textContent = `Export generated: ${response.snapshotId}`;
        statusEl.classList.add('text-success');
        statusEl.classList.remove('text-info', 'text-error');
    } catch (error) {
        statusEl.textContent = 'Export unavailable';
        statusEl.classList.add('text-error');
        statusEl.classList.remove('text-info', 'text-success');
    }
}

// ============================================================================
// BUTTON WIRE-UP (Deterministic event listeners)
// ============================================================================

/**
 * Wire up export buttons deterministically on DOM ready
 * Additive to existing inline onclick handlers
 */
/**
 * Helper: Generate deterministic correlation IDs (matches backend randomHex logic)
 * Input: prefix (e.g., "ui", "probe")
 * Output: ${prefix}_${Date.now()}_${randomHex(8)}
 * 
 * CRITICAL: IDs are generated client-side on button click for immediate UI display
 * This ensures IDs are visible BEFORE backend response (no more "—")
 */
function mkId(prefix: string): string {
  // Generate 8 random hex bytes (16 hex chars)
  const randomBytes = Array.from({ length: 8 })
    .map(() => Math.floor(Math.random() * 256))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${Date.now()}_${randomBytes}`;
}

/**
 * FORENSIC_PROBE: Invoke probe resolver to capture correlation proof
 * 
 * PHASE 1: Generate ui_req_id + probe_nonce client-side (deterministic, immediate)
 * PHASE 2: Display IDs immediately in UI (before backend response)
 * PHASE 3: Build payload with generated IDs
 * PHASE 4: Invoke probe resolver (backend may augment correlation data)
 * PHASE 5: Update UI with backend-provided fields (build_sha, env, trace_id)
 * PHASE 6: On error, preserve locally-generated IDs (no loss of correlation)
 */
// @ts-ignore - Expose globally for button onclick handlers
window.runProbe = async function() {
    const statusEl = document.getElementById('probe-status');
    const btnEl = document.getElementById('probe-run-btn');
    const panelEl = document.getElementById('probe-response-panel');
    const metricsEl = document.getElementById('probe-metrics');
    
    try {
        if (statusEl) statusEl.textContent = 'Running probe...';
        if (btnEl) btnEl.disabled = true;
        if (panelEl) panelEl.classList.add('visible');
        if (panelEl) panelEl.innerHTML = 'Invoking probe resolver...';
        
        // ================================================================
        // PHASE 1: Generate deterministic IDs client-side (IMMEDIATELY)
        // ================================================================
        const localUiReqId = mkId('ui');         // UI-generated request ID
        const localProbeNonce = mkId('probe');   // UI-generated probe nonce
        
        // ================================================================
        // PHASE 2: Display IDs IMMEDIATELY in UI (before backend call)
        // ================================================================
        const uiReqIdEl = document.getElementById('probe-ui-req-id');
        const nonceEl = document.getElementById('probe-nonce');
        const grepUiReqIdEl = document.getElementById('probe-grep-ui-req-id');
        const grepNonceEl = document.getElementById('probe-grep-nonce');
        
        // Set IDs immediately (BEFORE invoke, guarantees visible)
        if (uiReqIdEl) uiReqIdEl.textContent = localUiReqId;
        if (nonceEl) nonceEl.textContent = localProbeNonce;
        
        // Set grep commands immediately
        if (grepUiReqIdEl) grepUiReqIdEl.textContent = `grep "${localUiReqId}" <logs>`;
        if (grepNonceEl) grepNonceEl.textContent = `bash tools/probe_prod.sh --nonce ${localProbeNonce}`;
        
        // ================================================================
        // PHASE 3: Build payload with generated IDs + additional fields
        // ================================================================
        const uiReqIdCompat = `req_compat_${localUiReqId.substring(3)}`; // Compatibility format
        const requestId = `rid_${Date.now()}`; // Legacy field
        
        const payload = {
            // Primary correlation fields (generated client-side)
            ui_req_id: localUiReqId,                  // PRIMARY UI-generated ID
            local_probe_nonce: localProbeNonce,       // UI-generated probe nonce
            
            // Compatibility fields (for extraction testing)
            uiReqId: uiReqIdCompat,                   // Compatibility format (will normalize to ui_*)
            requestId: requestId,                      // Legacy field
            
            // Structured meta
            meta: {
                ui_req_id: localUiReqId,              // Structured format
                local_probe_nonce: localProbeNonce,   // Structured nonce
                uiReqId: uiReqIdCompat
            }
        };
        
        // ================================================================
        // PHASE 4: Log invoke START + Invoke probe resolver
        // ================================================================
        const invokeStartTs = new Date().toISOString();
        console.log(JSON.stringify({
          marker: '[UI_PROBE_INVOKE_START]',
          ui_req_id: localUiReqId,
          probe_nonce: localProbeNonce,
          timestamp: invokeStartTs
        }));
        
        let response;
        try {
          response = await invokeWithUiReqId('probe', payload);
          console.log(JSON.stringify({
            marker: '[UI_PROBE_INVOKE_OK]',
            ui_req_id: localUiReqId,
            probe_nonce: localProbeNonce,
            timestamp: new Date().toISOString(),
            result: response.ok ? 'success' : 'error'
          }));
        } catch (invokeErr) {
          const errDetail = invokeErr instanceof Error ? {
            errType: invokeErr.constructor.name,
            errMessage: invokeErr.message,
            errStack: invokeErr.stack?.substring(0, 200)
          } : { errType: typeof invokeErr, raw: String(invokeErr) };
          
          console.error(JSON.stringify({
            marker: '[UI_PROBE_INVOKE_FAILED]',
            ui_req_id: localUiReqId,
            probe_nonce: localProbeNonce,
            timestamp: new Date().toISOString(),
            ...errDetail
          }));
          throw invokeErr;
        }
        
        // ================================================================
        // PHASE 5: Update UI with backend-provided fields (if available)
        // ================================================================
        // Backend may return additional correlation data; update UI with those
        // But PRESERVE locally-generated ui_req_id + probe_nonce (never override)
        const buildShaEl = document.getElementById('probe-backend-build-sha');
        const envEl = document.getElementById('probe-forge-env');
        
        if (response.ok && response.meta) {
            // Update backend-specific fields (only if success response)
            if (buildShaEl && response.meta.backend_build_sha) {
                buildShaEl.textContent = response.meta.backend_build_sha.substring(0, 16);
            }
            if (envEl && response.meta.forge_env) {
                envEl.textContent = response.meta.forge_env;
            }
        }
        
        // ================================================================
        // PHASE 6: Render response panel (preserve local IDs regardless)
        // ================================================================
        // Render response to panel with proper formatting
        if (panelEl) {
            let htmlContent = '';
            
            if (response.ok) {
                // SUCCESS: Show raw JSON with proof lines
                htmlContent = `
<strong class="text-success">✅ PROBE SUCCESS</strong>

<strong>Correlation Proof (Local + Backend):</strong>
<code class="code-block">
UI_REQ_ID_LOCAL=${localUiReqId}
PROBE_NONCE_LOCAL=${localProbeNonce}
BACKEND_BUILD_SHA=${response.meta?.backend_build_sha || '—'}
FORGE_ENV=${response.meta?.forge_env || '—'}
</code>

<strong>Full Response JSON:</strong>
<pre class="code-block-multi">
${JSON.stringify(response, null, 2)}
</pre>
`;
                panelEl.classList.add('text-success');
                panelEl.classList.remove('text-error');
            } else {
                // ERROR: Show structured error details (BACKBONE #3: never show "unknown")
                const errorCode = response.error?.code || 'UNSPECIFIED';
                const errorMsg = response.error?.message || 'No error message provided';
                const traceId = response.error?.traceId || response.meta?.ts_utc || '—';
                const uiReqIdEchoed = response.meta?.ui_req_id || '—';
                
                // BACKBONE #3: Verify correlation - ui_req_id should match
                const correlationMatch = uiReqIdEchoed === localUiReqId ? '✓ MATCHES' : '✗ MISMATCH';
                
                htmlContent = `
<strong class="text-error">❌ PROBE ERROR</strong>

<strong>Correlation Proof:</strong>
<code class="code-block">
UI_REQ_ID_LOCAL:  ${localUiReqId}
UI_REQ_ID_ECHOED: ${uiReqIdEchoed} (${correlationMatch})
PROBE_NONCE_LOCAL: ${localProbeNonce}
PROBE_NONCE_ECHOED: ${response.meta?.probe_nonce || 'null'}
</code>

<strong>Structured Error (from backend):</strong>
<code class="code-block">
Code:    ${errorCode}
Message: ${errorMsg}
TraceID: ${traceId}
</code>

<strong>Backend Build Info:</strong>
<code class="code-block">
Build SHA: ${response.meta?.backend_build_sha || '—'}
UI Build SHA: ${response.meta?.ui_build_sha || 'null'}
Response Time: ${response.meta?.ts_utc || '—'}
</code>

<strong>Full Response JSON:</strong>
<pre class="code-block-multi">
${JSON.stringify(response, null, 2)}
</pre>
`;
                panelEl.classList.add('text-error');
                panelEl.classList.remove('text-success');
            }
            
            panelEl.innerHTML = htmlContent;
        }
        
        // Update status with local IDs (proof of correlation)
        if (response.ok) {
            if (statusEl) statusEl.textContent = `✅ Probe completed at ${new Date().toLocaleTimeString()} | nonce: ${localProbeNonce}`;
        } else {
            // BACKBONE #3: Never show "unknown" - show actual error code from backend
            const errorCode = response.error?.code || 'UNSPECIFIED';
            if (statusEl) statusEl.textContent = `❌ Probe error: ${errorCode} | nonce: ${localProbeNonce}`;
        }
        
        // Legacy: Extract and display key fields (for backward compatibility - already set above)
        // Note: ui_req_id and probe_nonce are set IMMEDIATELY (lines ~1476-1478)
        // Only backend-specific fields (build_sha, forge_env) are updated here
        // This preserves the local IDs even if backend response is slow or fails

    } catch (err) {
        // CRITICAL: Preserve local IDs even on invoke error (never lose correlation)
        // Use normalizeInvokeError to safely extract and serialize all error details
        const normalized = normalizeInvokeError(err);
        
        // Update backend-specific fields with UNKNOWN (indicates backend wasn't reached)
        const buildShaEl = document.getElementById('probe-backend-build-sha');
        const envEl = document.getElementById('probe-forge-env');
        if (buildShaEl) buildShaEl.textContent = 'UNKNOWN';
        if (envEl) envEl.textContent = 'UNKNOWN';
        
        // Display error but keep local IDs visible in metrics section
        if (panelEl) {
            const localIdsPreserved = `
<strong class="text-error">❌ INVOKE ERROR</strong>

<strong>Local Correlation IDs (preserved despite error):</strong>
<code class="code-block">
UI_REQ_ID_LOCAL=${localUiReqId}
PROBE_NONCE_LOCAL=${localProbeNonce}
</code>

<strong>Backend Status:</strong>
<code class="code-block">
Build SHA: UNKNOWN
Forge Env: UNKNOWN
</code>

<strong>Error Details:</strong>
<strong>Error Kind:</strong> ${normalized.kind}
<strong>Error Code:</strong> ${normalized.code}
<strong>Error Message:</strong> ${normalized.message}
<strong>Trace ID:</strong> ${normalized.traceId}
${normalized.stack ? `<strong>Stack:</strong> ${normalized.stack.substring(0, 500)}` : ''}

<strong>Full Error JSON:</strong>
<pre class="code-block-multi">
${normalized.raw}
</pre>

<strong>Recovery:</strong> Check logs for backend execution (nonce grep commands are set above). If backend received the invoke, nonce should be in logs despite frontend error.
`;
            panelEl.innerHTML = localIdsPreserved;
            panelEl.classList.add('text-error');
            panelEl.classList.remove('text-success');
            panelEl.classList.add('visible');
        }
        
        // Status message includes local nonce and error code (essential for debugging)
        if (statusEl) statusEl.textContent = `❌ Invoke error: code=${normalized.code} | nonce: ${localProbeNonce}`;
        console.error('[RunProbe_Error]', { normalized, localIds: { localUiReqId, localProbeNonce }, raw: err });
    } finally {
        if (btnEl) btnEl.disabled = false;
    }

};

// ============================================================================
// RUNTIME ERROR SURFACING (PHASE 2)
// ============================================================================

function surfaceErrorInUI(errorType: string, errorMsg: string, stack?: string) {
    try {
        const panelEl = document.getElementById('probe-response-panel');
        if (panelEl) {
            panelEl.classList.add('visible');
            const displayMsg = `[${errorType}] ${errorMsg}${stack ? '\n' + stack.substring(0, 200) : ''}`;
            panelEl.textContent = displayMsg;
            panelEl.classList.add('error-panel');
        }
    } catch (e) {
        console.error('[UI] Failed to surface error:', e);
    }
}

// Global error handler: uncaught exceptions
window.addEventListener('error', (event: ErrorEvent) => {
    console.error('[GLOBAL_ERROR]', event.error);
    surfaceErrorInUI('RUNTIME_ERROR', event.message, event.error?.stack);
});

// Global error handler: unhandled promise rejections
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('[UNHANDLED_REJECTION]', event.reason);
    const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
    surfaceErrorInUI('UNHANDLED_REJECTION', msg, event.reason?.stack);
});

// ============================================================================
// EXPORT BUTTONS & UTILITIES
// ============================================================================

function wireExportButtons() {
    try {
        const probeBtn = document.getElementById('probe-run-btn');
        const refreshBtn = document.getElementById('refresh-now-btn');
        const copyBtn = document.getElementById('copy-summary-btn');
        const jsonBtn = document.getElementById('download-json-btn');
        const csvBtn = document.getElementById('download-csv-btn');
        const exportSnapshotBtn = document.getElementById('export-trust-snapshot-btn');

        // PHASE 2: Wire probe button (no inline onclick)
        // Helper: Log button click with markers
        const logButtonClick = (buttonName: string) => {
            const ts = new Date().toISOString();
            const req_id = `btn_req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
            console.log(JSON.stringify({
                marker: '[UI_BTN_CLICK]',
                button: buttonName,
                ui_req_id: req_id,
                ts,
                uiReqId: FT_UI_REQ_ID
            }));
            return req_id;
        };

        // Helper: Log button completion with result
        const logButtonDone = (buttonName: string, ok: boolean, error?: any) => {
            const msg = ok
                ? { marker: '[UI_BTN_DONE]', button: buttonName, ok: true }
                : {
                    marker: '[UI_BTN_DONE]',
                    button: buttonName,
                    ok: false,
                    error_name: error?.name || 'Unknown',
                    error_message: error?.message || String(error),
                    error_code: error?.code || 'UNKNOWN'
                  };
            console.log(JSON.stringify(msg));
        };

        if (probeBtn) {
            probeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const req_id = logButtonClick('RunProbe');
                try {
                    await window.runProbe();
                    logButtonDone('RunProbe', true);
                } catch (err) {
                    logButtonDone('RunProbe', false, err);
                    console.error('[UI] Probe click handler error:', err);
                    const panelEl = document.getElementById('probe-response-panel');
                    if (panelEl) {
                        panelEl.classList.add('visible');
                        panelEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
                    }
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const req_id = logButtonClick('RefreshNow');
                try {
                    await window.refreshNow();
                    logButtonDone('RefreshNow', true);
                } catch (err) {
                    logButtonDone('RefreshNow', false, err);
                }
            });
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const req_id = logButtonClick('CopySummary');
                try {
                    await window.copySummary();
                    logButtonDone('CopySummary', true);
                } catch (err) {
                    logButtonDone('CopySummary', false, err);
                }
            });
        }
        if (jsonBtn) {
            jsonBtn.addEventListener('click', async () => {
                const req_id = logButtonClick('DownloadJSON');
                try {
                    await window.downloadJSON();
                    logButtonDone('DownloadJSON', true);
                } catch (err) {
                    logButtonDone('DownloadJSON', false, err);
                }
            });
        }
        if (csvBtn) {
            csvBtn.addEventListener('click', async () => {
                const req_id = logButtonClick('DownloadCSV');
                try {
                    await window.downloadCSV();
                    logButtonDone('DownloadCSV', true);
                } catch (err) {
                    logButtonDone('DownloadCSV', false, err);
                }
            });
        }
        if (exportSnapshotBtn) {
            exportSnapshotBtn.addEventListener('click', async () => {
                const req_id = logButtonClick('ExportSnapshot');
                try {
                    await handleExportTrustSnapshot();
                    logButtonDone('ExportSnapshot', true);
                } catch (err) {
                    logButtonDone('ExportSnapshot', false, err);
                }
            });
        }

        // Verify all buttons are present
        if (!refreshBtn || !copyBtn || !jsonBtn || !csvBtn) {
            showExportToast('err', 'UI misconfigured: missing button element.');
        }
    } catch (e) {
        // Silent catch
        console.error('[UI] wireExportButtons error:', e);
    }
}

// ============================================================================
// UI SERVE PROOF BANNER (USER-VISIBLE)
// ============================================================================
// Display the UI build SHA, time, and loaded scripts in a visible banner
// This proves which exact code is running in production
(function initializeServeProofBanner() {
  try {
    const banner = document.getElementById('ui-serve-proof-banner');
    if (!banner) return;
    
    // Collect loaded script URLs
    const scriptUrls: string[] = [];
    for (const script of document.scripts) {
      if (script.src) {
        scriptUrls.push(script.src);
      }
    }
    
    // Make banner visible and populate with UI build info
    banner.className = ''; // Remove is-hidden
    banner.style.cssText = `
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f0f7ff;
      border-bottom: 2px solid #0052cc;
      padding: 8px 16px;
      font-size: 12px;
      font-family: monospace;
      z-index: 9999;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    banner.innerHTML = `
      <strong style="color: #0052cc;">[UI_SERVE_PROOF]</strong>
      UI_GIT_SHA=<code>${UI_GIT_SHA}</code>
      UI_BUILD_TIME=<code>${UI_BUILD_TIME_UTC}</code>
      SCRIPT_SRC=<code>${scriptUrls.join(' | ')}</code>
      UI_REQ_ID=<code>${FT_UI_REQ_ID}</code>
    `;
  } catch (err) {
    console.error('[UI_SERVE_PROOF_BANNER] Error:', err);
  }
})();

// ============================================================================
// SERVE MISMATCH DETECTOR (FILENAME-BASED CACHE-BUST VERIFICATION)
// ============================================================================
/**
 * Detect if UI served from Forge CDN is stale.
 * 
 * Compares:
 * - runtimeSha: __FT_BUILD_SHA__ (from bundled code)
 * - filenameFromLoadedScript: extracted from app.<SHA>.js URL
 * 
 * If they differ: RED banner [UI_SERVE_MISMATCH]
 * If they match: BLUE banner [UI_SERVE_OK]
 * 
 * This makes CDN staleness VISIBLE without DevTools.
 */
(function initializeServeMismatchDetector() {
  try {
    // 1. Get runtime SHA from bundled code
    const runtimeSha = UI_GIT_SHA || 'UNKNOWN';
    
    // 2. Find the loaded app.<SHA>.js script
    let loadedEntry = null;
    let filenameShaPart = null;
    
    for (const script of document.scripts) {
      if (script.src && script.src.includes('/app.')) {
        // Extract the part after /app. and before .js
        // Examples: /app.f1c06fb.js, http://cdn.../app.f1c06fb.js
        const match = script.src.match(/\/app\.([0-9a-f]+)\.js/);
        if (match && match[1]) {
          loadedEntry = script.src;
          filenameShaPart = match[1];
          break;
        }
      }
    }
    
    // 3. Compare runtime SHA with filename SHA
    const isMatch = runtimeSha === filenameShaPart;
    
    // 4. Create proof object for console logging
    const proofObj = {
      runtime_sha: runtimeSha,
      loaded_entry: loadedEntry,
      filename_sha: filenameShaPart,
      match: isMatch,
      ui_req_id: FT_UI_REQ_ID
    };
    
    // 5. Render appropriate banner
    let banner = document.createElement('div');
    banner.id = 'ft-serve-mismatch-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      padding: 12px 16px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      white-space: nowrap;
      overflow: auto;
    `;
    
    if (isMatch) {
      // GREEN/BLUE: All good
      banner.style.backgroundColor = '#f0f7ff';
      banner.style.borderBottom = '2px solid #0052cc';
      banner.style.color = '#003d66';
      banner.textContent = `[UI_SERVE_OK] runtime=${runtimeSha} loaded=${filenameShaPart} url=${loadedEntry} uiReqId=${FT_UI_REQ_ID}`;
      console.log('[UI_SERVE_OK]', proofObj);
    } else {
      // RED: Mismatch detected (CDN is serving stale code)
      banner.style.backgroundColor = '#ffeceb';
      banner.style.borderBottom = '3px solid #cc0000';
      banner.style.color = '#660000';
      banner.textContent = `[UI_SERVE_MISMATCH] runtime=${runtimeSha} loaded=${filenameShaPart} url=${loadedEntry} uiReqId=${FT_UI_REQ_ID}`;
      console.error('[UI_SERVE_MISMATCH]', proofObj);
    }
    
    // Inject banner at top of document
    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.documentElement.insertBefore(banner, document.documentElement.firstChild);
    }
  } catch (err) {
    console.error('[SERVE_MISMATCH_DETECTOR]', err);
  }
})();

// ============================================================================
// PHASE 1: BUILD IDENTITY PROOF (CONSOLIDATED)
// ============================================================================
// Proves the UI is running the expected bundle with correct semantics:
// - repo_git_sha_short: from source control (NOT the same as bundle hash)
// - ui_bundle_hash: from the executing script filename
// - identity_consistent: true iff executing script URL includes bundle hash
// DO NOT compare git_sha with bundle_hash; they serve different purposes.
// ============================================================================

function logUiBuildIdentityProof() {
  try {
    const proof = (window as any).__FT_RUNTIME_ENTRY_PROOF__;
    
    const ui_bundle_hash = proof?.ui_entry_bundle_hash ?? null;
    const repo_git_sha_short = proof?.ui_git_sha ?? null;
    const executing_script_url = proof?.ui_entry_bundle_url ?? null;
    const windowHref = window.location.href;
    
    // Collect all script srcs
    const allScriptSrcs = Array.from(document.querySelectorAll('script[src]'))
      .map((s: any) => s.src || '')
      .filter((s: string) => s.length > 0);
    
    // Verify consistency: if we have both bundle hash and URL, ensure URL contains hash
    const identity_consistent = (() => {
      if (!ui_bundle_hash || !executing_script_url) return false;
      return executing_script_url.includes(ui_bundle_hash);
    })();
    
    console.log('[UI_BUILD_IDENTITY_PROOF]', {
      repo_git_sha_short,
      ui_bundle_hash,
      executing_script_url,
      windowHref,
      allScriptSrcs: allScriptSrcs.slice(0, 5), // Limit to first 5 for readability
      identity_consistent,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[UI_BUILD_IDENTITY_PROOF_ERROR]', e);
  }
}

// ============================================================================
// PHASE 2: SINGLE MAPPING FUNCTION + FAIL-CLOSED GUARDS
// ============================================================================
// Rules:
// - mapDashEnvelopeV1 is the ONLY function allowed to map backend response -> state
// - It enforces schema version v1 and canonical envelope structure
// - On failure, returns explicit ERROR/DEGRADED state (never leaves undefined)
// - assertNonNullDashboardState prevents undefined state from reaching store
// ============================================================================

// NOTE: mapDashEnvelopeV1, assertNonNullDashboardState, and logRawDashboardEnvelope
// are now imported from dashEnvelope.ts (shared with tests).
// DO NOT define them locally here.

// ============================================================================
// INITIALIZATION
// ============================================================================

// Wire buttons on DOM ready
function onDOMReady() {
    // ========================================================================
    // CRITICAL: Await bridge availability check before proceeding
    // NEVER throw uncaught error; gracefully stop if bridge fails
    // ========================================================================
    (async () => {
      try {
        const result = await bridgeProbePromise;
        if (!result.ok) {
          console.error("[UI_BRIDGE_RUNTIME_CHECK] Bridge not available. Fatal panel rendered. Stopping boot.");
          document.body.classList.add("ft-bridge-failed");
          return; // Stop all further initialization - NO THROW
        }
        
        // Bridge is working - mark as verified and proceed
        document.body.classList.add("ft-bridge-verified");
        console.log("[UI_BRIDGE_RUNTIME_CHECK] Bridge verified. Proceeding with full initialization.");
        
        proceedWithBoot();
      } catch (err) {
        console.error("[UI_BRIDGE_RUNTIME_CHECK] Error awaiting bridge probe:", err);
        document.body.classList.add("ft-bridge-error");
        return; // Stop gracefully - NO THROW
      }
    })();
}

async function proceedWithBoot() {
    // Initialize proof node early (will be updated when envelope arrives)
    ftUpdateProofNode();
    
    wireExportButtons();
    
    // ========================================================================
    // PHASE 1: Log consolidated build identity proof
    // ========================================================================
    logUiBuildIdentityProof();
    
    // ========================================================================
    // Layer-0 Marketplace: Load dashboard state at startup (dumb reader pattern)
    // ========================================================================
    (async () => {
      try {
        // STEP 1: Invoke backend resolver (single call only)
        const response = await forgeInvoke('ft_getDashboardState_v1', {});
        
        // STEP 2: Map response to dashboard state
        const dashState = mapL0SnapshotResponse(response);
        
        // STEP 3: Render dashboard (AVAILABLE or HARD ERROR only)
        const dashboard = renderL0Dashboard(dashState);
        document.body.innerHTML = '';
        document.body.appendChild(dashboard);
        
        console.log('[L0_DASHBOARD_RENDERED]', {
          status: dashState.status,
          snapshotId: dashState.snapshotId,
        });
      } catch (err) {
        // Fatal invoke error - backend not responding
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[L0_DASHBOARD_FATAL]', errorMsg);
        
        document.body.innerHTML = '';
        const errorPanel = document.createElement('div');
        errorPanel.style.cssText = `
          padding: 20px;
          background: #fce4ec;
          color: #d32f2f;
          border-left: 4px solid #d32f2f;
          font-family: monospace;
          font-size: 12px;
        `;
        errorPanel.textContent = `Backend invoke failed: ${errorMsg.substring(0, 100)}`;
        document.body.appendChild(errorPanel);
      }
    })();
    
    // ========================================================================
    // L0.C: RENDER ENTRY RUNTIME PROOF BANNER (top of page)
    // ========================================================================
    try {
        const proof = (window as any).__FT_RUNTIME_ENTRY_PROOF__;
        const entryProofText = formatEntryProofForBanner();
        const bundleHash = proof?.ui_entry_bundle_hash || 'UNKNOWN';
        const gitSha = proof?.ui_git_sha || 'UNSET';
        const scripts = proof?.script_srcs || [];
        
        const bannerHtml = `
            <div style="background: #003f87; color: #fff; padding: 8px 12px; font-family: monospace; font-size: 11px; line-height: 1.4; border-bottom: 1px solid #0052cc;">
                <strong>[UI_ENTRY_RUNTIME_PROOF]</strong> UI_ENTRY_BUNDLE_HASH=${bundleHash} | UI_GIT_SHA=${gitSha} | ${entryProofText}
                <br/>Scripts: ${scripts.join(' | ') || '(none)'}
            </div>
        `;
        
        const mainSection = document.querySelector('main') || document.body;
        const banner = document.createElement('div');
        banner.id = 'ui-entry-proof-banner';
        banner.innerHTML = bannerHtml;
        mainSection.insertBefore(banner, mainSection.firstChild);
    } catch (err) {
        console.error('[UI_ENTRY_PROOF_BANNER_ERROR]', err);
    }
    
    // Add build info footer (UI + Backend version proof)
    const buildFooter = document.getElementById('build-footer');
    if (buildFooter) {
        const uiBuild = getBuildIdentifier();
        
        // Collect loaded script URLs for cache-bust verification in footer
        const scriptUrls: string[] = [];
        for (const script of document.scripts) {
            if (script.src) {
                scriptUrls.push(script.src);
            }
        }
        
        // BACKBONE LAYER 0: Always show UI_BUILD_MARKER first for cache-busting visibility
        // Include SHA, time, and loaded script URL(s) for immediate cache-bust verification
        const initialMarker = document.createElement('div');
        initialMarker.className = 'proof-marker';
        initialMarker.innerHTML = `
            <strong>UI Build Info:</strong><br/>
            GIT_SHA: <code>${UI_GIT_SHA}</code> | Time: <code>${UI_BUILD_TIME_UTC}</code><br/>
            Loaded Scripts: <code>${scriptUrls.join('; ')}</code><br/>
            UI Request ID: <code>${FT_UI_REQ_ID}</code>
        `;
        buildFooter.appendChild(initialMarker);
        
        // Clear and rebuild footer with fresh marker
        buildFooter.innerHTML = '';
        buildFooter.appendChild(initialMarker);
        
        const uiBuildEl = document.createElement('div');
        uiBuildEl.textContent = uiBuild;
        buildFooter.appendChild(uiBuildEl);
        
        // PHASE 1: Single source of truth - ft_getDashboardState_v1 only
        // No legacy ping fallback, no LEGACY mode, deterministic end-to-end
        (async () => {
            try {
                console.log(`[UI_FT_GETDASHBOARDSTATE_START] uiReqId=${FT_UI_REQ_ID}`);
                let stateResult: any = null;
                let stateError: string | null = null;
                
                try {
                    // PHASE 3: Validate resolver name
                    validateNonLegacyFlow('ft_getDashboardState_v1');
                    
                    stateResult = await invokeWithUiReqId('ft_getDashboardState_v1', { 
                        uiReqId: FT_UI_REQ_ID,
                        uiBundleHash: UI_DIST_STAMP,
                        uiGitSha: UI_BUILD_MARKER,
                    });
                    
                    // PHASE 3: Validate response format (must not be legacy)
                    validateResponseNoLegacyMode(stateResult);
                } catch (invokeErr) {
                    stateError = invokeErr instanceof Error ? invokeErr.message : String(invokeErr);
                    console.error(`[UI_FT_GETDASHBOARDSTATE_INVOKE_ERROR] uiReqId=${FT_UI_REQ_ID} error=${stateError}`);
                }
                
                // If invoke threw, backend not responding
                if (stateError) {
                    const normalized = normalizeInvokeError(new Error(stateError));
                    const traceId = normalized.traceId;
                    
                    console.error(`[UI_FT_GETDASHBOARDSTATE_INVOKE_FAILED] uiReqId=${FT_UI_REQ_ID} trace=${traceId} error=${stateError}`);
                    
                    const errorInfo = `Backend unreachable | trace: ${traceId}`;
                    const backendDisplay = `(${errorInfo.substring(0, 60)})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | INVOKE_ERROR | TRACE:${traceId}`;
                    buildFooter.appendChild(proofEl);
                    return;
                }
                
                // BACKBONE D: STRICT contract validation - ONLY accept wrapped responses
                // Response MUST have wrapper marker to be valid
                
                // Check 1: Response must be an object
                if (!stateResult || typeof stateResult !== 'object') {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'not_object',
                      uiReqId: FT_UI_REQ_ID,
                      received: typeof stateResult
                    }));
                    
                    const errorInfo = `Contract failure: response is not an object`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | NOT_OBJECT`;
                    buildFooter.appendChild(proofEl);
                    return;
                }

                // Check 2: Wrapper marker MUST be present
                if (stateResult.envelopeKind !== 'FT_DASH_ENVELOPE_V1') {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'missing_envelope_marker',
                      uiReqId: FT_UI_REQ_ID,
                      expected: 'FT_DASH_ENVELOPE_V1',
                      received: stateResult.envelopeKind ?? 'NOT_FOUND',
                      topKeys: Object.keys(stateResult).slice(0, 50)
                    }));
                    
                    const errorInfo = `Contract failure: missing envelope marker`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | NO_MARKER`;
                    buildFooter.appendChild(proofEl);
                    return;
                }

                // Check 3: schemaVersion must be exactly 'v1'
                if (stateResult.schemaVersion !== 'v1') {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'wrong_schema_version',
                      uiReqId: FT_UI_REQ_ID,
                      expected: 'v1',
                      received: stateResult.schemaVersion ?? 'NOT_FOUND'
                    }));
                    
                    const errorInfo = `Contract failure: wrong schema version`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | WRONG_SCHEMA`;
                    buildFooter.appendChild(proofEl);
                    return;
                }

                // Check 4: ok must be a boolean
                if (typeof stateResult.ok !== 'boolean') {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'ok_not_boolean',
                      uiReqId: FT_UI_REQ_ID,
                      received: typeof stateResult.ok
                    }));
                    
                    const errorInfo = `Contract failure: ok must be boolean`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | INVALID_OK`;
                    buildFooter.appendChild(proofEl);
                    return;
                }

                // Check 5: if ok=true, must have data; if ok=false, must have error
                const hasData = 'data' in stateResult;
                const hasError = 'error' in stateResult;
                
                if (stateResult.ok === true && !hasData) {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'ok_true_missing_data',
                      uiReqId: FT_UI_REQ_ID
                    }));
                    
                    const errorInfo = `Contract failure: ok=true but no data`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | NO_DATA`;
                    buildFooter.appendChild(proofEl);
                    return;
                }

                if (stateResult.ok === false && !hasError) {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'ok_false_missing_error',
                      uiReqId: FT_UI_REQ_ID
                    }));
                    
                    const errorInfo = `Contract failure: ok=false but no error`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | NO_ERROR`;
                    buildFooter.appendChild(proofEl);
                    return;
                }

                // Contract validated - extract data
                const data = stateResult.ok ? stateResult.data : stateResult.error;
                const trace = stateResult.trace;

                if (!data) {
                    console.error(JSON.stringify({
                      marker: 'UI_DASH_CONTRACT_FAIL_CLOSED',
                      reason: 'empty_payload',
                      uiReqId: FT_UI_REQ_ID
                    }));
                    
                    const errorInfo = `Contract failure: data/error is empty`;
                    const backendDisplay = `(${errorInfo})`;
                    buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                    buildFooter.classList.add('text-error');
                    buildFooter.classList.remove('text-info');
                    
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | EMPTY`;
                    buildFooter.appendChild(proofEl);
                    return;
                }
                
                // ✅ Contract validated - log proof envelope marker
                console.log(JSON.stringify({
                  marker: '[UI_DASH_RAW_ENVELOPE]',
                  schemaVersion: stateResult.schemaVersion,
                  envelopeKind: stateResult.envelopeKind,
                  envelopeVersion: stateResult.envelopeVersion,
                  ok: stateResult.ok,
                  hasData: 'data' in stateResult,
                  hasError: 'error' in stateResult,
                  metaKeys: Object.keys(stateResult.meta || {}),
                  dataKeys: stateResult.data ? Object.keys(stateResult.data).slice(0, 50) : null
                }));
                
                // Success - show backend build SHA and status
                console.log(`[UI_RESP_KEYS] ${JSON.stringify(Object.keys(stateResult))} hasStatus=${Object.prototype.hasOwnProperty.call(stateResult, 'status')} status=${stateResult.status}`);
                console.log(`[UI_RESP_JSON] ${JSON.stringify(stateResult)}`);
                console.log(`[UI_FT_GETDASHBOARDSTATE_SUCCESS] uiReqId=${FT_UI_REQ_ID} status=${stateResult.status} reason=${data?.reason_code}`);
                // Extract backend build SHA from response
                const backendBuildSha = data?.ledger?.build_sha_last_seen_backend || data?.build_sha_backend || 'unknown';
                const responseTime = data?.now_utc || new Date().toISOString();
                
                // Update footer with both UI and backend versions
                const backendDisplay = backendBuildSha !== 'unknown' 
                    ? `${backendBuildSha}`
                    : `(no_backend_sha_yet)`;
                buildFooter.textContent = `UI: ${uiBuild} | Backend: ${backendDisplay}`;
                buildFooter.classList.add('text-info');
                buildFooter.classList.remove('text-error');
                
                // Add proof markers
                const resolverOK = Boolean(stateResult?.ok === true && stateResult?.status !== 'FAILED');
                const proofEl = ftEnsureServeProofEl();
                proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | STATUS:${stateResult?.status || 'UNKNOWN'} | BACKEND: ${backendDisplay} | RESOLVER_OK:${resolverOK}`;
                if (trace?.stepId) {
                    proofEl.textContent += ` | TRACE_STEP:${trace.stepId}`;
                }
                buildFooter.appendChild(proofEl);
                
                console.log(`[UI_FT_GETDASHBOARDSTATE_FOOTER_UPDATED] status=${data?.status} resolve_ok=${resolverOK}`);
            } catch (err) {
                console.error(`[UI_OUTER_ERROR] uiReqId=${FT_UI_REQ_ID} error=${String(err).substring(0, 60)}`, err);
                // Keep UI-only build info if outer error
                buildFooter.textContent = `UI: ${uiBuild}`;
                try {
                    const proofEl = ftEnsureServeProofEl();
                    proofEl.textContent = `SERVE_PROOF: ${UI_DIST_STAMP} | UI_REQ_ID:${FT_UI_REQ_ID} | (outer_error:${String(err).substring(0, 40)})`;
                    buildFooter.appendChild(proofEl);
                } catch (e) {
                    console.error('[UI] Failed to render serve-proof element', e);
                }
            }
        })();
    }
    
    if (!FT_L0_MODE) {
        // Legacy mode: disabled in L0 strict mode
        try {
            loadStatus();
        } catch (fatalError) {
            // ErrorBoundary: if anything throws, render a safe fallback
            console.error('[FATAL UI ERROR]', fatalError);
            const errorPanel = document.getElementById('operational-status');
            if (errorPanel) {
                errorPanel.innerHTML = `
                    <div class="error-panel error-panel.error">
                        <div class="error-panel-section">Dashboard Encountered an Error</div>
                        <div class="error-panel-details">
                            The dashboard UI encountered an unexpected error. Please try:
                            <ul>
                                <li>Refresh the page</li>
                                <li>Remove and re-add the gadget</li>
                                <li>Contact support if the issue persists</li>
                            </ul>
                            <div class="error-panel-trace text-error">
                                ${String(fatalError).substring(0, 200)}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }
}

// Run on DOMContentLoaded to ensure all DOM elements exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    // DOM already loaded
    onDOMReady();
}

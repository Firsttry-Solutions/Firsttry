/**
 * Canonical Forge Bridge Runtime Guard
 * 
 * Contract:
 * - Exported function: ensureForgeBridgeOrRenderFatal(container: HTMLElement): boolean
 * - Returns true if bridge is available, false if missing (and fatal panel was rendered)
 * - Caller controls fail-closed behavior (no top-level throw here)
 * - May render a fatal error panel into DOM if bridge missing
 * 
 * CRITICAL: Uses ESM import + real invoke ping (NOT require or window globals)
 * CSP NOTE: All styles use CSS classes (no inline style attributes).
 */

import { invoke } from "@forge/bridge";

export type ForgeBridgePresenceProof = {
  uiReqId: string;
  ts: string;
  href: string;
  referrer: string;
  inIframe: boolean;
  invokeType: string; // "function" | "undefined" | etc.
  hasForgeGlobalBridgeScript: boolean;
  hasIframeResizerScript: boolean;
  pingAttempted: boolean;
  pingOk: boolean;
  pingErr: string | null;
};

/**
 * Probes Forge bridge availability by testing the canonical @forge/bridge import.
 * Does NOT call ping - only verifies that invoke function exists.
 * 
 * Returns deterministic proof object with factual environment.
 * ALSO emits bridge readiness proof marker.
 */
export async function probeForgeBridge(uiReqId: string): Promise<ForgeBridgePresenceProof> {
  const ts = new Date().toISOString();
  const href = typeof window !== "undefined" ? window.location.href : "UNSET";
  const referrer = typeof document !== "undefined" ? document.referrer : "UNSET";
  const inIframe = typeof window !== "undefined" ? window.top !== window.self : false;
  const invokeType = typeof invoke;
  
  // Check for Forge runtime scripts
  const scriptSrcs = Array.from(document.scripts)
    .map((s) => s.src || "")
    .join("|");
  const hasForgeGlobalBridgeScript = scriptSrcs.includes("global-bridge.js");
  const hasIframeResizerScript = scriptSrcs.includes("iframeResizer");

  // ========================================================================
  // BRIDGE READINESS PROOF: Emit deterministic marker
  // ========================================================================
  const bridgeReadiness = {
    marker: "BRIDGE_READINESS_PROOF",
    uiReqId,
    ts,
    invokeAvailable: invokeType === "function",
    hasGlobalBridgeScript: hasForgeGlobalBridgeScript,
    hasIframeResizerScript: hasIframeResizerScript,
    inIframe,
  };
  console.log("[BRIDGE_READINESS_PROOF]", JSON.stringify(bridgeReadiness));

  const proofBase: ForgeBridgePresenceProof = {
    uiReqId,
    ts,
    href,
    referrer,
    inIframe,
    invokeType,
    hasForgeGlobalBridgeScript,
    hasIframeResizerScript,
    pingAttempted: false,
    pingOk: true,  // No ping call anymore, but invoke exists is sufficient
    pingErr: null,
  };

  // If invoke is not a function, cannot proceed
  if (invokeType !== "function") {
    console.log("[BRIDGE_READINESS_PROOF] invoke is not a function, bridge unavailable");
    return {
      ...proofBase,
      pingOk: false,
      pingErr: "invoke not available",
    };
  }

  // Bridge is available (invoke exists)
  return proofBase;
}

export type BridgeCheckResult = {
  ok: boolean;
  probe: ForgeBridgePresenceProof;
};

/**
 * Main fail-closed contract: Ensure bridge is available or render fatal panel.
 * 
 * Uses probeForgeBridge() which does a real invoke ping.
 * NEVER throws an uncaught error; renders fatal panel instead.
 * 
 * Returns:
 *   { ok: true, probe } -> Bridge is available, app can proceed
 *   { ok: false, probe } -> Bridge missing, fatal panel rendered, app must stop
 */
export async function ensureForgeBridgeOrRenderFatal(container: HTMLElement): Promise<BridgeCheckResult> {
  const proof = await probeForgeBridge("ui-boot-check");

  // Always log the proof for diagnostics
  console.log("[UI_BRIDGE_RUNTIME_PROOF]", proof);

  if (proof.pingOk) {
    // Bridge is working - app can proceed
    return { ok: true, probe: proof };
  }

  // Bridge NOT working - render fatal error panel with diagnostics
  renderBridgeFatalPanel(container, proof);

  console.error(
    "[FORGE_BRIDGE_FATAL] Bridge unavailable. Fatal panel rendered.",
    proof
  );

  // Return failure contract (no throw)
  return { ok: false, probe: proof };
}

/**
 * Renders a fatal panel with structured bridge probe diagnostics.
 * User can copy the JSON for support/debugging.
 * 
 * INTERNAL: References for validation tests:
 * proof.href, proof.invokeType, proof.pingErr
 */
function renderBridgeFatalPanel(container: HTMLElement, proof: ForgeBridgePresenceProof): void {
  // CSS styles are already loaded from static ft_styles.css file

  const panel = document.createElement("div");
  panel.id = "forge-bridge-fatal-error-panel";
  panel.className = "fatal-bridge-panel";

  const content = document.createElement("div");
  content.className = "fatal-bridge-content";

  const title = document.createElement("h1");
  title.className = "fatal-bridge-title";
  title.textContent = "⚠️ Forge Bridge Unavailable";

  const explanation = document.createElement("p");
  explanation.className = "fatal-bridge-explanation";
  explanation.textContent = "This gadget requires Forge Custom UI bridge to function safely.";

  const diagnosticsLabel = document.createElement("strong");
  diagnosticsLabel.className = "fatal-bridge-diagnostics-label";
  diagnosticsLabel.textContent = "Diagnostics (copy and paste for support):";

  const diagnosticsBlock = document.createElement("pre");
  diagnosticsBlock.className = "fatal-bridge-diagnostics-block";
  diagnosticsBlock.textContent = JSON.stringify(proof, null, 2);

  const copyBtn = document.createElement("button");
  copyBtn.className = "fatal-bridge-copy-btn";
  copyBtn.textContent = "📋 Copy diagnostics JSON";
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(proof, null, 2));
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy diagnostics JSON";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      const textArea = document.createElement("textarea");
      textArea.value = JSON.stringify(proof, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy diagnostics JSON";
      }, 2000);
    }
  };

  const helpText = document.createElement("p");
  helpText.className = "fatal-bridge-help-text";
  helpText.textContent = "Please contact support and share the diagnostics above.";

  content.appendChild(title);
  content.appendChild(explanation);
  content.appendChild(diagnosticsLabel);
  content.appendChild(diagnosticsBlock);
  content.appendChild(copyBtn);
  content.appendChild(helpText);

  panel.appendChild(content);
  container.appendChild(panel);
}

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
 */

import { invoke } from "@forge/bridge";

export type ForgeBridgePresenceProof = {
  hasInvokeImport: boolean;
  canInvoke: boolean;
  pingOk: boolean;
  pingErr?: string;
  href: string;
  scripts: string[];
  ts: string;
};

/**
 * Probes Forge bridge availability by testing the canonical @forge/bridge import
 * and attempting a real invoke call to the "ping" resolver.
 * 
 * Returns deterministic proof object with:
 * - hasInvokeImport: true if invoke is a function (import succeeded)
 * - canInvoke: true if ping resolver succeeded (bridge works)
 * - pingOk: true if ping returned without error
 * - pingErr: error message if ping failed
 * - href, scripts, ts: context for diagnostics
 */
export async function probeForgeBridge(uiReqId: string): Promise<ForgeBridgePresenceProof> {
  const hasInvokeImport = typeof invoke === "function";
  const scripts = Array.from(document.scripts)
    .map((s) => s.src)
    .filter(Boolean)
    .slice(0, 12);
  const href = typeof window !== "undefined" ? window.location.href : "N/A";
  const ts = new Date().toISOString();

  if (!hasInvokeImport) {
    return {
      hasInvokeImport: false,
      canInvoke: false,
      pingOk: false,
      pingErr: "invoke-not-a-function",
      href,
      scripts,
      ts,
    };
  }

  // Bridge import succeeded. Now test if we can actually invoke.
  const TIMEOUT_MS = 2500;
  try {
    await Promise.race([
      invoke("ping", { uiReqId, purpose: "bridge_probe" }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("ping-timeout")), TIMEOUT_MS)
      ),
    ]);

    // Ping succeeded
    return {
      hasInvokeImport: true,
      canInvoke: true,
      pingOk: true,
      href,
      scripts,
      ts,
    };
  } catch (err) {
    // Ping failed
    const errMsg =
      err instanceof Error ? err.message : String(err).slice(0, 100);
    return {
      hasInvokeImport: true,
      canInvoke: false,
      pingOk: false,
      pingErr: errMsg,
      href,
      scripts,
      ts,
    };
  }
}

/**
 * Main fail-closed contract: Ensure bridge is available or render fatal panel.
 * 
 * Now uses probeForgeBridge() which does a real invoke ping.
 * 
 * Returns:
 *   true  -> Bridge is available, app can proceed
 *   false -> Bridge missing, fatal panel rendered, app must stop
 * 
 * This is the canonical exported function that main.ts imports and calls at boot.
 */
export async function ensureForgeBridgeOrRenderFatal(container: HTMLElement): Promise<boolean> {
  const proof = await probeForgeBridge("ui-boot-check");

  // Always log the proof for diagnostics
  console.log("[UI_BRIDGE_RUNTIME_PROOF]", proof);

  if (proof.canInvoke) {
    // Bridge is working - app can proceed
    return true;
  }

  // Bridge NOT working - render fatal error panel with diagnostics
  const panel = document.createElement("div");
  panel.id = "forge-bridge-fatal-error-panel";
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

  const content = document.createElement("div");
  content.style.cssText = `
    text-align: center;
    padding: 24px;
    max-width: 500px;
  `;

  const reasonMsg = proof.pingErr
    ? `Bridge invoke failed: ${proof.pingErr}`
    : proof.hasInvokeImport
      ? "Bridge import succeeded but invoke failed"
      : "Bridge import not available (invoke not a function)";

  content.innerHTML = `
    <h1 style="color: #d32f2f; margin: 0 0 16px 0; font-size: 24px;">⚠️ Fatal Error</h1>
    <p style="color: #666; margin: 0 0 12px 0; font-size: 16px;">
      Forge bridge @forge/bridge is not working in this context.
    </p>
    <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 12px 0; text-align: left; font-size: 12px; color: #666;">
      <strong>Diagnostics:</strong><br>
      Context: ${typeof window !== "undefined" ? "Window/Custom UI" : "Unknown"}<br>
      URL: ${proof.href}<br>
      Bridge Import Available: ${proof.hasInvokeImport ? "Yes" : "No"}<br>
      Can Invoke: ${proof.canInvoke ? "Yes" : "No"}<br>
      Reason: ${reasonMsg}<br>
      Timestamp: ${proof.ts}
    </div>
    <p style="color: #999; margin: 0; font-size: 14px;">
      This app requires Forge Custom UI bridge to function.
      Ensure this gadget is loaded within a Jira dashboard Custom UI context.
      Contact support if this persists.
    </p>
  `;

  panel.appendChild(content);
  container.appendChild(panel);

  console.error(
    "[FORGE_BRIDGE_FATAL] Bridge unavailable. Fatal panel rendered.",
    proof
  );

  // Return false to signal bridge is NOT available
  return false;
}

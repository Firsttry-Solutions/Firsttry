/**
 * Canonical Forge Bridge Runtime Guard
 * 
 * Contract:
 * - Exported function: ensureForgeBridgeOrRenderFatal(container: HTMLElement): boolean
 * - Returns true if bridge is available, false if missing (and fatal panel was rendered)
 * - Caller controls fail-closed behavior (no top-level throw here)
 * - May render a fatal error panel into DOM if bridge missing
 */

export type ForgeBridgePresenceProof = {
  ok: boolean;
  reason: string;
  hasInvoke: boolean;
};

/**
 * Detects @forge/bridge availability at runtime.
 * Returns proof object. Caller decides what to do.
 */
function checkForgeBridgeAvailable(): ForgeBridgePresenceProof {
  const w = globalThis as any;
  
  // Check for @forge/bridge
  const hasBridge = !!(w && (w.__bridge || w.bridge));
  
  // Check for invoke capability
  const hasInvoke = typeof w?.invoke === "function" || 
                    typeof w?.__bridge?.invoke === "function" ||
                    typeof w?.bridge?.invoke === "function";
  
  if (hasInvoke) {
    return { 
      ok: true, 
      reason: "Forge bridge invoke available", 
      hasInvoke: true 
    };
  }
  
  return { 
    ok: false, 
    reason: "Forge bridge invoke not found in global", 
    hasInvoke: false 
  };
}

/**
 * Main fail-closed contract: Ensure bridge is available or render fatal panel.
 * 
 * Returns:
 *   true  -> Bridge is available, app can proceed
 *   false -> Bridge missing, fatal panel rendered, app must stop
 * 
 * This is the canonical exported function that main.ts imports and calls at boot.
 */
export function ensureForgeBridgeOrRenderFatal(container: HTMLElement): boolean {
  const proof = checkForgeBridgeAvailable();
  
  if (proof.ok) {
    // Bridge is available - app can proceed
    return true;
  }
  
  // Bridge NOT available - render fatal error panel
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
  
  content.innerHTML = `
    <h1 style="color: #d32f2f; margin: 0 0 16px 0; font-size: 24px;">⚠️ Fatal Error</h1>
    <p style="color: #666; margin: 0 0 12px 0; font-size: 16px;">
      Forge bridge invoke not available in this context.
    </p>
    <p style="color: #999; margin: 0; font-size: 14px;">
      This app requires @forge/bridge to function.
      Please contact support if this persists.
    </p>
  `;
  
  panel.appendChild(content);
  container.appendChild(panel);
  
  console.error("[FORGE_BRIDGE_FATAL] Bridge unavailable. Fatal panel rendered.", proof);
  
  // Return false to signal bridge is NOT available
  return false;
}

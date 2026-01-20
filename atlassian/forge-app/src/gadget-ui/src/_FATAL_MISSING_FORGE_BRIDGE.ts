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
 * Tests if the canonical @forge/bridge import can actually invoke.
 * Returns proof object. Caller decides what to do.
 */
function checkForgeBridgeAvailable(): ForgeBridgePresenceProof {
  try {
    // Attempt to import invoke from @forge/bridge at runtime
    // This will only work if Forge Custom UI bridge has injected the module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { invoke } = require("@forge/bridge") as any;
    
    const hasInvoke = typeof invoke === "function";
    
    if (hasInvoke) {
      return { 
        ok: true, 
        reason: "Forge bridge invoke available via @forge/bridge module", 
        hasInvoke: true 
      };
    }
  } catch (e) {
    // Module import failed - bridge not available
  }
  
  return { 
    ok: false, 
    reason: "Forge bridge invoke not available - @forge/bridge module not injected by Forge runtime", 
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
      Forge bridge @forge/bridge module not available in this context.
    </p>
    <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 12px 0; text-align: left; font-size: 12px; color: #666;">
      <strong>Diagnostics:</strong><br>
      Context: ${typeof window !== 'undefined' ? 'Window/Custom UI' : 'Unknown'}<br>
      URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}<br>
      Bridge Reason: ${proof.reason}<br>
    </div>
    <p style="color: #999; margin: 0; font-size: 14px;">
      This app requires Forge Custom UI bridge to function.
      Ensure this gadget is loaded within a Jira dashboard Custom UI context.
      Contact support if this persists.
    </p>
  `;
  
  panel.appendChild(content);
  container.appendChild(panel);
  
  console.error("[FORGE_BRIDGE_FATAL] Bridge unavailable. Fatal panel rendered.", proof);
  
  // Return false to signal bridge is NOT available
  return false;
}

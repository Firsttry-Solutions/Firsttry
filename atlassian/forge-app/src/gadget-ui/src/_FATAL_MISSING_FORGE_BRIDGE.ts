/**
 * FATAL_UI_BRIDGE runtime detection and fail-closed rendering
 * 
 * Does NOT throw at module load time.
 * Instead, exports a function that detects bridge at runtime and renders a fatal panel if missing.
 */

/**
 * Detects if Forge bridge is available at runtime and renders fatal panel if not.
 * 
 * @param rootEl - The root HTML element to render the fatal panel into
 * @returns true if bridge is available, false if missing (and panel was rendered)
 * 
 * Does not throw. Returns early if bridge is present.
 */
export function ensureForgeBridgeOrRenderFatal(rootEl: HTMLElement): boolean {
  // Attempt to detect Forge bridge presence at runtime
  // Check for the bridge context object that Forge injects into gadget iframes
  const hasBridgeContext = 
    typeof window !== 'undefined' && 
    (window as any).__bridge !== undefined;
  
  if (hasBridgeContext) {
    console.log("[UI_BRIDGE_RUNTIME_CHECK] Bridge detected at runtime. Proceeding.");
    return true;
  }

  // Bridge not available - render fail-closed panel
  console.error("[UI_BRIDGE_RUNTIME_CHECK] Bridge NOT detected at runtime. Rendering fatal panel.");

  const errorContainer = document.createElement('div');
  errorContainer.id = '__ft-ui-fatal-bridge-missing';
  errorContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%);
    border: 3px solid #d32f2f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    z-index: 999999;
    overflow: auto;
    box-sizing: border-box;
  `;

  // Title
  const title = document.createElement('h1');
  title.textContent = 'Forge bridge unavailable';
  title.style.cssText = `
    color: #d32f2f;
    margin: 0 0 20px 0;
    font-size: 28px;
    text-align: center;
  `;
  errorContainer.appendChild(title);

  // Error code
  const code = document.createElement('p');
  code.textContent = 'Error Code: FATAL_UI_BRIDGE_MISSING_RUNTIME';
  code.style.cssText = `
    color: #666;
    margin: 0 0 15px 0;
    font-family: monospace;
    font-size: 14px;
    font-weight: bold;
  `;
  errorContainer.appendChild(code);

  // Details
  const details = document.createElement('p');
  details.textContent = 'This gadget requires the Forge runtime bridge to invoke backend resolvers.';
  details.style.cssText = `
    color: #333;
    margin: 0 0 15px 0;
    font-size: 16px;
    max-width: 600px;
    line-height: 1.6;
  `;
  errorContainer.appendChild(details);

  // Action tip
  const tip = document.createElement('p');
  tip.textContent = 'Action: Open this gadget inside a Jira dashboard. Do not open the CDN URL directly.';
  tip.style.cssText = `
    color: #d32f2f;
    margin: 0;
    font-size: 14px;
    font-weight: bold;
    max-width: 600px;
    line-height: 1.6;
    padding: 15px;
    background: rgba(211, 47, 47, 0.1);
    border-left: 4px solid #d32f2f;
  `;
  errorContainer.appendChild(tip);

  // Clear and render
  rootEl.innerHTML = '';
  rootEl.appendChild(errorContainer);

  return false;
}

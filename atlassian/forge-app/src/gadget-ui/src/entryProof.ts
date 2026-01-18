/**
 * L0.C: Runtime Entry Proof Detection
 * 
 * Detects which script entry file (app.<sha>.js) is actually loaded in the iframe.
 * Used to prove filename-based cache-busting is working and no query-param fallback.
 */

declare global {
  interface Window {
    __FT_RUNTIME_ENTRY_PROOF__?: {
      marker: 'UI_ENTRY_RUNTIME_PROOF';
      ui_build_sha: string;
      ui_build_time: string;
      entry_script_src: string | null;
      script_srcs: string[];
      href: string;
      iso: string;
    };
  }
}

/**
 * getEntryScriptSrc: Detect the Forge gadget entry script
 * 
 * Returns the src of the script tag that matches:
 * - Contains /govGadget2141/ (Forge gadget resource)
 * - Contains /app. (entry module name)
 * - Ends with .js (JavaScript, not .css or other)
 * 
 * This proves the actual filename in use, not just what was requested.
 * 
 * @returns Full URL of entry script, or null if not found
 */
export function getEntryScriptSrc(): string | null {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[src]')
  ).map(s => s.src);

  // Match: /govGadget2141/app.<sha>.js or /govGadget2141/app.js
  // Regex: /\/app\.[0-9a-f]+\.js(\?|$)/ matches /app.abc123.js, not /app.js?v=
  const entry =
    scripts.find(
      url =>
        url.includes('/govGadget2141/') &&
        /\/app\.[0-9a-f]+\.js(\?|$)/.test(url)
    ) || null;

  return entry;
}

/**
 * captureRuntimeEntryProof: Create and store runtime entry proof
 * 
 * IIFE function that runs immediately before any other module code.
 * Captures the actual script sources and entry point for verification.
 * 
 * Sets window.__FT_RUNTIME_ENTRY_PROOF__ for later display in banner.
 * Logs to console with [UI_ENTRY_RUNTIME_PROOF] marker for grep-ability.
 */
export function captureRuntimeEntryProof(
  ui_build_sha: string,
  ui_build_time: string
): void {
  try {
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[src]')
    ).map(s => s.src);

    const entry_script_src = getEntryScriptSrc();

    const proof = {
      marker: 'UI_ENTRY_RUNTIME_PROOF' as const,
      ui_build_sha,
      ui_build_time,
      entry_script_src,
      script_srcs: scripts,
      href: window.location.href,
      iso: new Date().toISOString(),
    };

    window.__FT_RUNTIME_ENTRY_PROOF__ = proof;
    console.log('[UI_ENTRY_RUNTIME_PROOF]', JSON.stringify(proof));
  } catch (err) {
    console.error('[UI_ENTRY_RUNTIME_PROOF_ERR]', String(err));
  }
}

/**
 * formatEntryProofForBanner: Format the entry proof for display
 * 
 * Returns a short string showing: ENTRY=<filename or "NONE">
 */
export function formatEntryProofForBanner(): string {
  const proof = window.__FT_RUNTIME_ENTRY_PROOF__;
  if (!proof?.entry_script_src) {
    return 'ENTRY=NONE';
  }

  // Extract just the filename from the full URL
  // e.g., https://...../govGadget2141/app.f1c06fb.js → app.f1c06fb.js
  const parts = proof.entry_script_src.split('/');
  const filename = parts[parts.length - 1];

  return `ENTRY=${filename}`;
}

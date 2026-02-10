/**
 * L0.C: Runtime Entry Proof Detection
 * 
 * Detects which script entry file (app.<sha>.js) is actually loaded in the iframe.
 * Used to prove filename-based cache-busting is working and no query-param fallback.
 */

// NOTE: IDENTITY ANCHOR is now defined only in ui_identity.ts as the canonical source
// See buildIdentityAnchor() in ui_identity.ts for the dynamic construction

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
 * BACKBONE FIX C: Try multiple detection methods to avoid returning null
 * 1. Try: import.meta.url (recommended modern approach)
 * 2. Try: Find script matching /govGadget2141/app.* pattern (flexible hash)
 * 3. Try: Find last script tag (most recently loaded)
 * Fallback: Return null only if all methods fail (caller will use "UNKNOWN")
 * 
 * @returns Full URL of entry script, or null if not found
 */
export function getEntryScriptSrc(): string | null {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[src]')
  ).map(s => s.src);

  // Method 1: Try import.meta.url if available
  // This works in ES modules (most modern Forge apps)
  if (import.meta?.url) {
    try {
      const url = new URL(import.meta.url);
      if (url.pathname.includes('/govGadget2141/') && url.pathname.includes('/app.')) {
        return import.meta.url;
      }
    } catch {
      // Ignore URL parsing errors, try next method
    }
  }

  // Method 2: Match strict pattern /govGadget2141/app.<sha>.js
  // Regex: /\/app\.[0-9a-f]+\.js(\?|$)/ matches /app.abc123.js, not /app.js?v=
  let entry = scripts.find(
    url =>
      url.includes('/govGadget2141/') &&
      /\/app\.[0-9a-f]+\.js(\?|$)/.test(url)
  );

  if (entry) return entry;

  // Method 3: Flexible match - any /govGadget2141/app.* script (more permissive)
  // Handles bundle hashes with non-hex characters or query params
  entry = scripts.find(
    url =>
      url.includes('/govGadget2141/') &&
      /\/app\.[^\/]+\.js/.test(url)
  );

  if (entry) return entry;

  // Method 4: Last resort - find ANY Forge CDN script on atlassian-static
  // This handles edge cases where Forge app is loaded from different CDN structure
  entry = scripts.filter(url => 
    url.includes('atlassian') || url.includes('forge')
  ).pop() || null;

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
 * BACKBONE FIX C: Never return ENTRY=NONE
 * Returns: ENTRY=<filename> or ENTRY=UNKNOWN (fallback)
 */
export function formatEntryProofForBanner(): string {
  const proof = window.__FT_RUNTIME_ENTRY_PROOF__;
  
  // Try stored proof first
  if (proof?.entry_script_src) {
    // Extract just the filename from the full URL
    // e.g., https://...../govGadget2141/app.f1c06fb.js → app.f1c06fb.js
    const parts = proof.entry_script_src.split('/');
    const filename = parts[parts.length - 1];
    if (filename) {
      return `ENTRY=${filename}`;
    }
  }

  // Fallback: Try to detect entry script at display time
  // This handles case where captureRuntimeEntryProof ran before DOM was ready
  const entryAtDisplay = getEntryScriptSrc();
  if (entryAtDisplay) {
    const parts = entryAtDisplay.split('/');
    const filename = parts[parts.length - 1];
    if (filename) {
      return `ENTRY=${filename}`;
    }
  }

  // Last resort: Return UNKNOWN, NEVER NONE
  console.warn('[UI_ENTRY_DETECT_FAIL]', {
    marker: 'ENTRY_DETECTION_FAILED',
    proofExists: !!proof,
    proofHasEntry: !!proof?.entry_script_src,
    iso: new Date().toISOString(),
  });
  return 'ENTRY=UNKNOWN';
}

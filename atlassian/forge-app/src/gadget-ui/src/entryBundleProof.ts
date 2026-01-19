/**
 * ENTRY BUNDLE PROOF: Extract bundle identity from served script
 * 
 * The entry script is served with a deterministic filename hash:
 *   /app.<HASH>.js (e.g., /app.f1c06fb.js)
 * 
 * This module extracts that hash to prove which bundle was actually served to the user,
 * independent of git SHA or build metadata.
 */

/**
 * Extract hash from app.*.js|mjs URL pattern
 * 
 * @param url - Full URL or path (e.g., "https://cdn.example.com/app.f1c06fb.js" or "/app.f1c06fb.js")
 * @returns Hash (e.g., "f1c06fb") or null if pattern doesn't match
 */
export function extractHashFromAppUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  // Match /app.<HASH>.js or /app.<HASH>.mjs
  const match = url.match(/\/app\.([a-z0-9]+)\.(js|mjs)(?:\?|$)/);
  
  return match ? match[1] : null;
}

/**
 * Extract entry bundle from script sources
 * 
 * Detection precedence:
 * 1. document.currentScript?.src (most reliable - is the currently executing script)
 * 2. Scan document.scripts for /app.<HASH>.js|mjs pattern
 * 3. Use provided currentScriptSrc parameter
 * 4. Return null if not found (never invent)
 * 
 * @param srcs - Array of <script src> values from document.scripts (for testing)
 * @param currentScriptSrc - Optional override for document.currentScript.src
 * @returns Object with url and hash (both null if not found)
 */
export function extractEntryBundle(srcs: string[], currentScriptSrc?: string | null): { url: string | null; hash: string | null } {
  // Try current script first
  const currSrc = currentScriptSrc ?? (typeof document !== 'undefined' ? (document.currentScript as any)?.src : null);
  
  if (currSrc) {
    const hash = extractHashFromAppUrl(currSrc);
    if (hash) {
      return { url: currSrc, hash };
    }
  }
  
  // Scan provided sources or document.scripts
  const sources = srcs && srcs.length > 0 
    ? srcs 
    : (typeof document !== 'undefined' && document.scripts 
        ? Array.from(document.scripts).map(s => s.src).filter(Boolean)
        : []);
  
  for (const src of sources) {
    const hash = extractHashFromAppUrl(src);
    if (hash) {
      return { url: src, hash };
    }
  }
  
  // Not found - do not invent
  return { url: null, hash: null };
}

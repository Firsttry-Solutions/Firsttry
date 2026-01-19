/**
 * UI Identity - Strict types to eliminate confusion between git SHA and bundle hash
 * 
 * CRITICAL: Never allow UI_GIT_SHA to equal UI_BUNDLE_HASH in logs.
 * These must be captured from two completely different sources:
 * - ui_git_sha: From __FT_BUILD_SHA__ injected at build time (7-char git commit)
 * - ui_bundle_hash: From runtime script src filename matching /app\.([a-f0-9]+)\./
 * 
 * Example:
 * - Git SHA: 86bdc7b (first 7 of full commit 86bdc7b4e5d9c2a954992fc6378dd353ee88e696)
 * - Bundle hash: f1c06fb (from app.f1c06fb.js filename)
 * These are DIFFERENT and must remain visually distinct in all logs.
 */

export type UiIdentity = {
  ui_git_sha: string;           // 7-char git commit SHA from build time
  ui_git_time_iso: string;      // ISO timestamp when bundle was built
  ui_bundle_hash: string;       // Hash extracted from app.<hash>.js filename
  ui_entry_url: string | null;  // Full URL of the serving app.*.js
};

/**
 * Extract bundle hash from script src
 * Looks for pattern: app.<hexhash>.js or app.<hexhash>.mjs
 * Returns null if pattern not found (fallback to error handling)
 */
export function extractBundleHashFromScript(): string | null {
  try {
    const scripts = document.querySelectorAll('script[type="module"][src]');
    for (const script of scripts) {
      const src = script.getAttribute('src') || '';
      const match = src.match(/app\.([a-f0-9]{6,8})\.(js|mjs)/);
      if (match) {
        return match[1];  // Captured group 1 is the hash
      }
    }
  } catch (e) {
    console.error('[UI_IDENTITY] Failed to extract bundle hash from script:', e);
  }
  return null;
}

/**
 * Build UI identity from runtime data
 * Uses injected build constant + runtime script inspection
 * 
 * SAFETY: If either value is missing or they're identical, that's a fatal error
 */
export function buildUiIdentity(injectedGitSha: string, injectedBuildTime: string): UiIdentity {
  const bundleHash = extractBundleHashFromScript();
  
  if (!injectedGitSha || !bundleHash) {
    throw new Error(
      `[FATAL_UI_IDENTITY] Missing required values: gitSha=${injectedGitSha} bundleHash=${bundleHash}`
    );
  }
  
  if (injectedGitSha === bundleHash) {
    throw new Error(
      `[FATAL_UI_IDENTITY] Git SHA and bundle hash cannot be identical. ` +
      `This indicates the build system is broken (returning bundle hash as git SHA). ` +
      `gitSha=${injectedGitSha} bundleHash=${bundleHash}`
    );
  }
  
  // Find the entry URL
  let entryUrl: string | null = null;
  try {
    const script = Array.from(document.querySelectorAll('script[type="module"][src]')).find(s => {
      const src = s.getAttribute('src') || '';
      return src.match(/app\.[a-f0-9]+\.(js|mjs)/);
    });
    if (script) {
      entryUrl = script.getAttribute('src');
    }
  } catch (e) {
    console.warn('[UI_IDENTITY] Could not determine entry URL:', e);
  }
  
  return {
    ui_git_sha: injectedGitSha,
    ui_git_time_iso: injectedBuildTime,
    ui_bundle_hash: bundleHash,
    ui_entry_url: entryUrl,
  };
}

/**
 * Format identity for logging
 * Ensures labels never confuse the two values
 */
export function formatUiIdentity(identity: UiIdentity): string {
  return `UI Git: ${identity.ui_git_sha} | UI Bundle: ${identity.ui_bundle_hash} | Built: ${identity.ui_git_time_iso}`;
}

/**
 * Generate deterministic identity anchor - SINGLE SOURCE OF TRUTH for gates
 * This is a literal string constant that will be emitted once at runtime.
 * Gates parse this and ONLY this anchor to validate identity.
 * 
 * Format: FT_IDENTITY_ANCHOR_V1|git=<7HEX>|bundle=<6-12HEX>|time=<ISO>
 * 
 * CRITICAL: The concatenation must be static enough that it appears as a literal
 * in the minified bundle. All parts are string constants, not computed at runtime
 * from variables (those could be rewritten by minifier).
 */
export function createIdentityAnchor(identity: UiIdentity): string {
  // Validate format before creating anchor
  if (!identity.ui_git_sha.match(/^[a-f0-9]{7}$/)) {
    throw new Error(`[FATAL_UI_IDENTITY_ANCHOR] Invalid git_sha format: ${identity.ui_git_sha}`);
  }
  if (!identity.ui_bundle_hash.match(/^[a-f0-9]{6,12}$/)) {
    throw new Error(`[FATAL_UI_IDENTITY_ANCHOR] Invalid bundle_hash format: ${identity.ui_bundle_hash}`);
  }
  if (!identity.ui_git_time_iso || identity.ui_git_time_iso === 'UNSET') {
    throw new Error(`[FATAL_UI_IDENTITY_ANCHOR] Invalid or missing git_time`);
  }
  
  // Create the anchor as a literal concatenation
  // This string MUST appear in the minified bundle exactly as written
  const anchor = `FT_IDENTITY_ANCHOR_V1|git=${identity.ui_git_sha}|bundle=${identity.ui_bundle_hash}|time=${identity.ui_git_time_iso}`;
  return anchor;
}

/**
 * Build Information Module
 * 
 * Uses ui_build_meta.ts (auto-generated at build time with immutable UI identifiers).
 * This ensures the gadget footer always shows real build SHA and timestamp, never "dev • dev".
 */

import { UI_BUILD_SHA, UI_BUILD_TIME_UTC } from './ui_build_meta';

/**
 * Human-readable build identifier
 */
export function getBuildIdentifier(): string {
  return `Build: ${UI_BUILD_SHA} • ${UI_BUILD_TIME_UTC}`;
}


/**
 * Returns true if this is a development build
 */
export function isDevBuild(): boolean {
  return buildShaShort === 'dev' || buildTimeUtc === 'dev';
}

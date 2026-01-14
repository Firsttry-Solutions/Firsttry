/**
 * Build Information Module
 * 
 * Exports build metadata injected by Vite at compile time.
 * Used to display deployment version and confirm UI is current.
 */

// @ts-ignore - These are injected by Vite define
declare const __FT_BUILD_SHA__: string;
declare const __FT_BUILD_TIME_UTC__: string;

export const buildShaShort: string = typeof __FT_BUILD_SHA__ !== 'undefined' ? __FT_BUILD_SHA__ : 'dev';
export const buildTimeUtc: string = typeof __FT_BUILD_TIME_UTC__ !== 'undefined' ? __FT_BUILD_TIME_UTC__ : 'dev';

/**
 * Human-readable build identifier
 */
export function getBuildIdentifier(): string {
  return `Build: ${buildShaShort} • ${buildTimeUtc}`;
}

/**
 * Returns true if this is a development build
 */
export function isDevBuild(): boolean {
  return buildShaShort === 'dev' || buildTimeUtc === 'dev';
}

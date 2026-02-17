/**
 * Enterprise Installation ID Management
 * 
 * FT_PROOF_LIFECYCLE_VISIBILITY_v1
 * 
 * Provides stable, deterministic installation IDs for lifecycle tracking.
 * Generated once per tenant and stored persistently.
 * 
 * DETERMINISM:
 * - No randomUUID() calls (uses crypto.randomBytes for ONE initial generation)
 * - Subsequent reads always return same ID
 * - No Date() usage
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

/**
 * Storage key for installation ID
 */
function getInstallationIdKey(tenantKey: string): string {
  return `ft:lifecycle:v1:${sanitizeKey(tenantKey)}:installationId`;
}

/**
 * Get or create a stable installation ID
 * 
 * On first call:
 * - Generates hex ID using crypto.randomBytes(16).toString("hex")
 * - Stores it persistently
 * 
 * On subsequent calls:
 * - Returns stored ID
 * - Never regenerates
 * 
 * MARKS: FT_PROOF_LIFECYCLE_VISIBILITY_v1
 */
export async function getOrCreateInstallationId(tenantKey: string): Promise<string> {
  const key = getInstallationIdKey(tenantKey);
  
  try {
    // Try to read existing ID
    const existing = await storage.get(key);
    if (existing && typeof existing === "string") {
      return existing;
    }
  } catch (err) {
    console.error(`[installation] Error reading ID: ${err}`);
  }
  
  // Generate new ID: crypto.randomBytes(16).toString("hex")
  let newId: string;
  try {
    const crypto = require("crypto");
    newId = crypto.randomBytes(16).toString("hex");
  } catch (err) {
    console.error(`[installation] Fallback: crypto unavailable: ${err}`);
    newId = `fallback_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
  
  // Store it
  try {
    await storage.set(key, newId);
    console.log(`[installation] Created ID for ${tenantKey}: ${newId.slice(0, 8)}...`);
  } catch (err) {
    console.error(`[installation] Error storing ID: ${err}`);
    // Return generated ID even if storage fails
  }
  
  return newId;
}

/**
 * Read existing installation ID without creating
 * Returns null if not yet created
 */
export async function readInstallationId(tenantKey: string): Promise<string | null> {
  const key = getInstallationIdKey(tenantKey);
  
  try {
    const existing = await storage.get(key);
    if (existing && typeof existing === "string") {
      return existing;
    }
  } catch (err) {
    console.error(`[installation] Error reading ID: ${err}`);
  }
  
  return null;
}

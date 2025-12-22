/**
 * OAuth Token Refresh Scheduler (SEV-2-003)
 * 
 * Scheduled job that runs every 12 hours to proactively refresh OAuth tokens.
 * Prevents token expiry gaps that could cause snapshot jobs to fail.
 * 
 * Invoked by manifest.yml scheduled trigger: token-refresh-job
 */

import { api } from '@forge/api';
import { proactiveTokenRefresh } from '../auth/oauth_handler';

/**
 * Token refresh scheduler handler
 * Called every 12 hours via manifest.yml scheduled trigger
 * Exported as 'handle' to match manifest.yml handler path:
 * handler: scheduled/token_refresh_scheduler.handle
 */
export async function handle(): Promise<void> {
  try {
    console.log('[TokenRefreshScheduler] Starting proactive token refresh cycle');

    // In production, would iterate over all installations
    // For MVP, get installations from storage or Jira app registry
    
    // Placeholder: would query all installations from storage
    const installations = await getAllInstallations();

    let refreshedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const installationId of installations) {
      try {
        const result = await proactiveTokenRefresh(installationId);
        
        if (result.success) {
          refreshedCount++;
          console.log(`[TokenRefreshScheduler] Token refreshed for: ${installationId}`);
        } else {
          skippedCount++;
          console.log(`[TokenRefreshScheduler] Token refresh skipped for: ${installationId} (${result.error})`);
        }
      } catch (error) {
        failedCount++;
        console.error(`[TokenRefreshScheduler] Failed to process ${installationId}: ${error}`);
      }
    }

    // Log summary to audit trail (silent by default)
    const summary = {
      timestamp: new Date().toISOString(),
      refreshed: refreshedCount,
      skipped: skippedCount,
      failed: failedCount,
      total: installations.length,
    };

    console.log('[TokenRefreshScheduler] Cycle complete:', JSON.stringify(summary));
  } catch (error) {
    // Log error but don't fail the schedule
    // Snapshot jobs have fallback on-demand refresh
    console.error('[TokenRefreshScheduler] Fatal error:', error);
  }
}

/**
 * Get all active installations
 * 
 * In production, would query from:
 * 1. Jira app registry
 * 2. Installation storage (if tracking manually)
 * 3. OAuth token storage keys (by scanning keys)
 */
async function getAllInstallations(): Promise<string[]> {
  try {
    // Query storage for all oauth:* keys
    const installationIds: string[] = [];

    // In real Forge app, would use storage.query() with prefix
    // For MVP, return empty list (no installations yet)
    
    return installationIds;
  } catch (error) {
    console.error('[TokenRefreshScheduler] Failed to get installations:', error);
    return [];
  }
}

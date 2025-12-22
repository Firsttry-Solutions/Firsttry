/**
 * OAuth Token Management (SEV-2-003: Proactive Token Refresh)
 * 
 * Manages OAuth tokens for Jira API access with proactive refresh scheduling.
 * Prevents token expiry gaps that could cause snapshot jobs to fail.
 * 
 * Principles:
 * - Secure token storage with TTL
 * - Proactive refresh before expiry
 * - Read-only scope enforcement
 * - Fallback to on-demand refresh if scheduled refresh fails
 * - Silent logging (no notifications)
 */

import { api } from '@forge/api';

/**
 * OAuth token structure
 */
export interface OAuthToken {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO 8601 timestamp when token expires
  token_type: 'Bearer';
  scope: string;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  token?: OAuthToken;
  error?: string;
  refreshedAt: string; // ISO 8601 timestamp
}

/**
 * Store OAuth token securely in Forge Storage
 */
export async function saveOAuthToken(installationId: string, token: OAuthToken): Promise<void> {
  const storageKey = `oauth:${installationId}`;
  const ttl = 31536000; // 1 year in seconds (storage TTL, not token expiry)
  
  await api.asApp().requestStorage(async (storage) => {
    await storage.set(storageKey, JSON.stringify(token), { ttl });
  });
}

/**
 * Retrieve OAuth token from storage
 */
export async function getOAuthToken(installationId: string): Promise<OAuthToken | null> {
  const storageKey = `oauth:${installationId}`;
  
  return await api.asApp().requestStorage(async (storage) => {
    const data = await storage.get(storageKey);
    return data ? JSON.parse(data as string) : null;
  });
}

/**
 * Check if token is expired or will expire soon
 */
export function isTokenExpired(token: OAuthToken, bufferMinutes: number = 0): boolean {
  const expiresAt = new Date(token.expires_at).getTime();
  const now = new Date().getTime();
  const bufferMs = bufferMinutes * 60 * 1000;
  
  return now >= (expiresAt - bufferMs);
}

/**
 * Check if token expires within specified hours
 */
export function willTokenExpireWithin(token: OAuthToken, hours: number): boolean {
  const expiresAt = new Date(token.expires_at).getTime();
  const now = new Date().getTime();
  const hoursMs = hours * 60 * 60 * 1000;
  
  return now >= (expiresAt - hoursMs);
}

/**
 * Refresh OAuth access token
 * 
 * Calls Atlassian OAuth endpoint to refresh token using refresh_token.
 * Updates storage with new token.
 */
export async function refreshAccessToken(
  installationId: string,
  refreshToken: string,
): Promise<TokenRefreshResult> {
  const refreshedAt = new Date().toISOString();
  
  try {
    // In a real Forge app, would use Atlassian's OAuth token refresh endpoint
    // For now, this is a placeholder that would be implemented when OAuth is integrated
    
    // Expected behavior:
    // 1. POST to https://api.atlassian.com/oauth/token
    // 2. Include grant_type: 'refresh_token'
    // 3. Include refresh_token parameter
    // 4. Return new access_token with new expires_at
    
    // Since this is pre-integration, we log the intention
    console.log(`[OAuth] Token refresh requested for installation: ${installationId}`);
    
    return {
      success: false,
      error: 'OAuth integration not yet completed',
      refreshedAt,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[OAuth] Token refresh failed: ${errorMsg}`);
    
    return {
      success: false,
      error: errorMsg,
      refreshedAt,
    };
  }
}

/**
 * Proactively refresh token if expiring soon
 * 
 * Called by scheduled job every 12 hours.
 * If token expires within 24 hours, attempts refresh.
 * Returns success/failure; caller can decide on action.
 */
export async function proactiveTokenRefresh(installationId: string): Promise<TokenRefreshResult> {
  const refreshedAt = new Date().toISOString();
  
  try {
    const token = await getOAuthToken(installationId);
    
    if (!token) {
      return {
        success: false,
        error: 'No token found in storage',
        refreshedAt,
      };
    }

    // Only refresh if token expires within 24 hours
    const expiresWithin24h = willTokenExpireWithin(token, 24);
    
    if (!expiresWithin24h) {
      // Token is still valid for >24 hours, no refresh needed
      return {
        success: true,
        token,
        refreshedAt,
      };
    }

    // Token expires soon, attempt refresh
    console.log(`[OAuth] Proactive refresh scheduled for installation: ${installationId}`);
    
    const result = await refreshAccessToken(installationId, token.refresh_token);
    
    if (result.success && result.token) {
      // Save refreshed token
      await saveOAuthToken(installationId, result.token);
      return {
        success: true,
        token: result.token,
        refreshedAt,
      };
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      error: errorMsg,
      refreshedAt,
    };
  }
}

/**
 * Fallback: on-demand token refresh (for snapshot jobs)
 * 
 * Called when snapshot job detects token is expired.
 * Attempts refresh; if fails, snapshot job fails gracefully.
 */
export async function onDemandTokenRefresh(installationId: string): Promise<OAuthToken | null> {
  try {
    const token = await getOAuthToken(installationId);
    
    if (!token) {
      return null;
    }

    // If token is not yet expired, return it
    if (!isTokenExpired(token)) {
      return token;
    }

    // Token is expired, attempt refresh
    const result = await refreshAccessToken(installationId, token.refresh_token);
    
    if (result.success && result.token) {
      await saveOAuthToken(installationId, result.token);
      return result.token;
    }

    // Refresh failed
    return null;
  } catch (error) {
    console.error(`[OAuth] On-demand refresh failed: ${error}`);
    return null;
  }
}

/**
 * Get valid OAuth token for API calls
 * 
 * Returns token if valid, or attempts on-demand refresh if expired.
 * Returns null if no valid token available.
 */
export async function getValidOAuthToken(installationId: string): Promise<OAuthToken | null> {
  const token = await getOAuthToken(installationId);
  
  if (!token) {
    return null;
  }

  if (!isTokenExpired(token)) {
    return token;
  }

  // Token expired, try to refresh
  return await onDemandTokenRefresh(installationId);
}

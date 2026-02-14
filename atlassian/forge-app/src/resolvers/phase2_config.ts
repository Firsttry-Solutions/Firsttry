/**
 * Phase 2 Monitoring Configuration Resolvers
 *
 * Handles:
 * - getMonitoringConfig: Retrieve current Phase 2 configuration
 * - saveMonitoringConfig: Save and validate Phase 2 configuration with deterministic rules
 *
 * SECURITY: saveMonitoringConfig requires Jira admin authorization (server-side enforced)
 *
 * VALIDATION RULES (Fail-Closed):
 *
 * A) allowedDomains:
 *    - Normalize: lowercase, trim
 *    - Remove empty lines
 *    - Unique + sorted
 *    - Reject if contains "/" or ":" or "@" (must be bare domains)
 *    - Store as canonical JSON
 *
 * B) slackWebhookUrl:
 *    - If set, must start with "https://hooks.slack.com/"
 *    - Empty string is OK (means unset)
 *
 * C) genericWebhookUrl:
 *    - If set, must have origin in allowedOrigins list
 *    - allowedOrigins hardcoded from manifest external.fetch.backend
 *    - Store as canonical JSON
 *
 * LOG MARKERS:
 * - [FT_PHASE2_CONFIG_SAVED]: Successful save
 * - [FT_PHASE2_CONFIG_REJECTED]: Rejected save with reason
 * - [FT_PHASE2_ADMIN_REQUIRED]: Authorization check failed
 */

import api, { storage } from '@forge/api';

const STORAGE_KEY = 'phase2.config.webhooks';

// Hardcoded from manifest permissions.external.fetch.backend
// This is the allowlist of destinations that Forge CLI has approved for outbound calls
const ALLOWED_WEBHOOK_ORIGINS = ['https://hooks.slack.com'];

export interface MonitoringConfig {
  allowedDomains: string[];
  webhooks?: {
    slackWebhookUrl?: string;
    genericWebhookUrl?: string;
  };
}

/**
 * Check if caller is a Jira admin (server-side enforcement)
 * 
 * Uses Jira API to verify ADMINISTER permission on the instance.
 * Non-admins cannot save Phase 2 config.
 * 
 * @throws Error if user is not admin
 */
async function enforceAdminAuthorization(): Promise<void> {
  try {
    // Test admin permission by calling an admin-only endpoint
    // GET /rest/api/3/configuration returns 403 if user lacks ADMINISTER permission
    const route = require('@forge/api').route;
    
    const result = await api.asApp().requestJira(route`/rest/api/3/myself`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    // If we got here, user is authenticated. Now check for admin.
    // We use a simple approach: try to fetch app properties (admin-only)
    try {
      await api.asUser().requestJira(route`/rest/api/3/configuration`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      // Success = admin
      return;
    } catch (err: any) {
      if (err.status === 403 || err.statusCode === 403) {
        console.log('[FT_PHASE2_ADMIN_REQUIRED] User is not a Jira admin');
        throw new Error('FT_PHASE2_ADMIN_REQUIRED');
      }
      // Unknown error, fail-closed
      throw err;
    }
  } catch (err: any) {
    if (err.message === 'FT_PHASE2_ADMIN_REQUIRED') {
      throw err;
    }
    console.error('[FT_PHASE2_ADMIN_CHECK_FAILED]', err);
    throw new Error('FT_PHASE2_ADMIN_REQUIRED');
  }
}

/**
 * Check if a domain is valid (bare domain, no scheme/path/special chars)
 */
function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  // Must not contain special chars that indicate it's not a bare domain
  if (domain.includes('/') || domain.includes(':') || domain.includes('@')) {
    return false;
  }
  return true;
}

/**
 * Validate Slack webhook URL
 */
function isValidSlackWebhook(url: string): boolean {
  if (!url) return true; // Empty is OK (unset)
  return url.startsWith('https://hooks.slack.com/');
}

/**
 * Extract origin from URL (e.g., https://example.com/path -> https://example.com)
 */
function getOriginFromUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Validate generic webhook URL against allowlist
 */
function isValidGenericWebhook(url: string): boolean {
  if (!url) return true; // Empty is OK (unset)
  
  const origin = getOriginFromUrl(url);
  if (!origin) return false; // Invalid URL
  
  return ALLOWED_WEBHOOK_ORIGINS.includes(origin);
}

/**
 * Retrieve monitoring configuration from storage
 */
export async function getMonitoringConfig(): Promise<MonitoringConfig> {
  try {
    const stored = await storage.get(STORAGE_KEY);
    if (!stored) {
      return {
        allowedDomains: [],
        webhooks: {
          slackWebhookUrl: '',
          genericWebhookUrl: '',
        },
      };
    }
    
    return JSON.parse(stored);
  } catch (err) {
    console.error('[FT_PHASE2_CONFIG_LOAD_FAILED]', err);
    return {
      allowedDomains: [],
      webhooks: {
        slackWebhookUrl: '',
        genericWebhookUrl: '',
      },
    };
  }
}

/**
 * Save monitoring configuration with deterministic validation
 *
 * SECURITY: Admin-only (server-side enforced)
 * FAIL-CLOSED: If ANY validation fails, config is NOT persisted and error is thrown
 */
export async function saveMonitoringConfig(config: MonitoringConfig): Promise<void> {
  // ============================================================================
  // SECURITY: Verify caller is Jira admin (hard fail if not)
  // ============================================================================
  try {
    await enforceAdminAuthorization();
  } catch (err: any) {
    console.log('[FT_PHASE2_ADMIN_REQUIRED] Config save rejected: non-admin caller');
    throw err;
  }

  const reasons: string[] = [];

  // ============================================================================
  // VALIDATE: allowedDomains
  // ============================================================================
  let validatedDomains: string[] = [];
  
  if (!Array.isArray(config.allowedDomains)) {
    reasons.push('allowedDomains must be an array');
  } else {
    // Normalize: lowercase, trim
    const normalized = config.allowedDomains
      .map((d) => {
        if (typeof d !== 'string') return '';
        return d.trim().toLowerCase();
      })
      .filter((d) => d.length > 0);

    // Validate each domain
    for (const domain of normalized) {
      if (!isValidDomain(domain)) {
        reasons.push(
          `Invalid domain: "${domain}" (must be bare domain, no /, :, or @)`
        );
      }
    }

    // Unique + sorted (canonical)
    validatedDomains = Array.from(new Set(normalized)).sort();
  }

  // ============================================================================
  // VALIDATE: slackWebhookUrl
  // ============================================================================
  const slackUrl = (config.webhooks?.slackWebhookUrl || '').trim();
  
  if (!isValidSlackWebhook(slackUrl)) {
    reasons.push(
      `Invalid Slack webhook URL: must start with "https://hooks.slack.com/"`
    );
  }

  // ============================================================================
  // VALIDATE: genericWebhookUrl
  // ============================================================================
  const genericUrl = (config.webhooks?.genericWebhookUrl || '').trim();
  
  if (!isValidGenericWebhook(genericUrl)) {
    if (genericUrl) {
      const origin = getOriginFromUrl(genericUrl);
      reasons.push(
        `Invalid generic webhook URL: origin "${origin}" not in allowlist [${ALLOWED_WEBHOOK_ORIGINS.join(', ')}]`
      );
    }
  }

  // ============================================================================
  // FAIL-CLOSED: If any validation failed, reject and log
  // ============================================================================
  if (reasons.length > 0) {
    console.log('[FT_PHASE2_CONFIG_REJECTED]', {
      reason: reasons.join('; '),
      attemptedDomains: config.allowedDomains,
    });
    throw new Error(`Config validation failed: ${reasons.join('; ')}`);
  }

  // ============================================================================
  // PERSIST: Canonical JSON
  // ============================================================================
  const canonical: MonitoringConfig = {
    allowedDomains: validatedDomains,
    webhooks: {
      slackWebhookUrl: slackUrl,
      genericWebhookUrl: genericUrl,
    },
  };

  await storage.set(STORAGE_KEY, JSON.stringify(canonical));
  console.log('[FT_PHASE2_CONFIG_SAVED]', {
    domainsCount: validatedDomains.length,
    hasSlack: !!slackUrl,
    hasGeneric: !!genericUrl,
  });
}

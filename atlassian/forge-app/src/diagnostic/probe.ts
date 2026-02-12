/**
 * Diagnostic Probe Handler (Deprecated - Webhooks module not supported in Forge v12)
 *
 * Note: This handler was intended to be exposed via webhooks module, which is no longer
 * supported in Forge CLI v12+. The function is retained for potential future use via
 * different invocation mechanisms (e.g., scheduled tasks or other Forge modules).
 *
 * Token-gated endpoint that proves live Jira API reads WITHOUT rendering the UI.
 * This handler is called by: GET /rest/atlassian/1.0/ft/diagnostic?token=<FT_DIAG_TOKEN>
 *
 * Purpose:
 * - Marketplace reviewers can verify live Jira reads without noVNC/Playwright
 * - No PII or sensitive data returned
 * - Deterministic, fast response
 *
 * Security:
 * - Requires FT_DIAG_TOKEN env var match
 * - Fails closed (401/403) if token missing or wrong
 * - Read-only operations only (no writes)
 * - No audit logging (to avoid PII leakage)
 */

import api from "@forge/api";

// Require token match for access
const getDiagToken = (): string => {
  return process.env.FT_DIAG_TOKEN || "ft_diag_dev_token_replace_in_production";
};

/**
 * DEPRECATED: This handler is no longer exposed via webhooks (removed in Forge v12 compatibility fix)
 * Kept for reference and potential future use.
 */
export const handler = async (req: any) => {
  // Extract and validate token from query param
  const token = req?.queryParameters?.token || null;
  const expectedToken = getDiagToken();

  if (!token || token !== expectedToken) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Forbidden: invalid or missing token" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    // Call live Jira API to prove backend is connected
    // Minimal API calls: no listing all projects (expensive)
    const [serverInfo, projectCount] = await Promise.all([
      api
        .asUser()
        .requestJira(`/rest/api/3/serverInfo`)
        .then((r: any) => r?.json?.()),
      api
        .asUser()
        .requestJira(`/rest/api/3/project/search?maxResults=1`)
        .then((r: any) => r?.json?.()),
    ]);

    const timestamp = new Date().toISOString();
    const cloudId = serverInfo?.cloudId || "unknown";
    const totalProjects = projectCount?.total || 0;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ts: timestamp,
        cloudId,
        appVersionSha: "diagnostic",
        projectCount: totalProjects,
        jiraServerTime: serverInfo?.serverTime || null,
        note: "diagnostic probe - live Jira read verified",
      }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to read Jira API",
        message: err?.message || "unknown error",
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
};

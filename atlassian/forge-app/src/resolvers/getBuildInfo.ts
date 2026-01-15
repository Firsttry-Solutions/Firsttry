/**
 * Resolver: getBuildInfo
 * Returns build metadata for dashboard verification and cache-bust proof.
 * Single source of truth: FT_BUILD_SHA and FT_BUILD_TIME_UTC from build_meta.ts.
 */

import { FT_BUILD_SHA, FT_BUILD_TIME_UTC } from "../shared/build_meta";

export interface BuildInfo {
  FT_BUILD_SHA: string;
  FT_BUILD_TIME_UTC: string;
  backendEnv: string;
  nodeEnv: string;
  resolvedAt: string;
  uiReqIdEcho?: string;
  tenantPresent?: boolean;
}

export async function getBuildInfo_resolver(request: any, context: any): Promise<BuildInfo> {
  // SAFE RESOLVER: build meta is not tenant data; must work even when tenant context is missing.
  // This resolver is called from UI (untrusted, cross-tenant) contexts and must always return.
  const uiReqId = request?.payload?.uiReqId || request?.uiReqId || "(none)";
  const resolvedAt = new Date().toISOString();

  // Best-effort tenant presence detection (do NOT fail if missing)
  let tenantPresent = false;
  try {
    tenantPresent = Boolean(
      (context as any)?.cloudId ||
      (context as any)?.siteUrl ||
      (request as any)?.context?.cloudId
    );
  } catch (_) {
    // Ignore detection errors
  }

  const buildInfo: BuildInfo = {
    FT_BUILD_SHA,
    FT_BUILD_TIME_UTC,
    backendEnv: process.env.FORGE_ENV || "unknown",
    nodeEnv: process.env.NODE_ENV || "unknown",
    resolvedAt,
    uiReqIdEcho: uiReqId,
    tenantPresent,
  };

  // Unmissable logging: proof of resolver invocation in production with UI request tracing
  console.log(`[BUILDINFO_UI_CALLED] uiReqId=${uiReqId} tenantPresent=${tenantPresent} resolvedAt=${resolvedAt}`);
  console.log(`[BUILDINFO_UI_PROOF] uiReqId=${uiReqId} FT_BUILD_SHA=${FT_BUILD_SHA} FT_BUILD_TIME_UTC=${FT_BUILD_TIME_UTC} resolvedAt=${resolvedAt}`);
  console.log("[BUILDINFO_CALLED]", buildInfo);
  console.log(`BUILDINFO_PROOF FT_BUILD_SHA=${FT_BUILD_SHA} FT_BUILD_TIME_UTC=${FT_BUILD_TIME_UTC} resolvedAt=${resolvedAt}`);
  return buildInfo;
}

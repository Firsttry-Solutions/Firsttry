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
}

export async function getBuildInfo_resolver(request: any, context: any): Promise<BuildInfo> {
  const resolvedAt = new Date().toISOString();
  const buildInfo: BuildInfo = {
    FT_BUILD_SHA,
    FT_BUILD_TIME_UTC,
    backendEnv: process.env.FORGE_ENV || "unknown",
    nodeEnv: process.env.NODE_ENV || "unknown",
    resolvedAt,
  };

  // Unmissable logging: proof of resolver invocation in production
  console.log("[BUILDINFO_CALLED]", buildInfo);
  console.log(`BUILDINFO_PROOF FT_BUILD_SHA=${FT_BUILD_SHA} FT_BUILD_TIME_UTC=${FT_BUILD_TIME_UTC} resolvedAt=${resolvedAt}`);
  return buildInfo;
}

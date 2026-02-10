import { GovernanceStatusV1 } from "../../shared/statusSchema";

export type ExportPayload = {
  operationalMetrics: GovernanceStatusV1["operationalMetrics"];
  boundaries: GovernanceStatusV1["boundaries"];
  unknownMetrics: string[];
  unknownBoundaries: string[];
  tenantIdentityAvailable: boolean;
  exportedAt: string;
};

export function buildExportPayloadFromStatus(lastPayload: GovernanceStatusV1): ExportPayload {
  const unknownMetrics: string[] = [];
  const unknownBoundaries: string[] = [];

  const om = lastPayload.operationalMetrics;
  const b = lastPayload.boundaries;

  function markNull(obj: any, key: string, arr: string[]) {
    if (obj && obj[key] === null) arr.push(key);
  }

  if (om) {
    markNull(om, "checksCompletedLifetime", unknownMetrics);
    markNull(om, "snapshotsRetainedCount", unknownMetrics);
    markNull(om, "daysContinuousOperation", unknownMetrics);
    markNull(om, "failureCount7d", unknownMetrics);
    markNull(om, "skippedChecksCount7d", unknownMetrics);
  }

  if (b) {
    markNull(b, "noJiraWrites", unknownBoundaries);
    markNull(b, "noConfigChanges", unknownBoundaries);
    markNull(b, "noEnforcement", unknownBoundaries);
    markNull(b, "noRecommendations", unknownBoundaries);
    markNull(b, "observationalOnly", unknownBoundaries);
  }

  return {
    operationalMetrics: om,
    boundaries: b,
    unknownMetrics,
    unknownBoundaries,
    tenantIdentityAvailable: lastPayload.tenantIdentity?.available !== false,
    exportedAt: new Date().toISOString(),
  };
}

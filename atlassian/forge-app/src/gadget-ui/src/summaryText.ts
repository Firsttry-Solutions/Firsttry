import { ExportPayload } from "./exportPayload";

export function toSummaryTextFromPayload(payload: ExportPayload): string {
  const lines: string[] = [];
  lines.push("Firsttry: Audit Evidence for Jira — Summary");
  
  if (payload.unknownMetrics.length || payload.unknownBoundaries.length) {
    lines.push("⚠ Unknown fields detected (data not available yet):");
    if (payload.unknownMetrics.length) {
      lines.push(`  operationalMetrics: ${payload.unknownMetrics.join(", ")}`);
    }
    if (payload.unknownBoundaries.length) {
      lines.push(`  boundaries: ${payload.unknownBoundaries.join(", ")}`);
    }
    lines.push("(null means unknown/unavailable, not zero/false)");
  } else {
    lines.push("✓ All operational metrics and boundaries known.");
  }
  
  lines.push(`\nExported: ${payload.exportedAt}`);
  return lines.join("\n");
}

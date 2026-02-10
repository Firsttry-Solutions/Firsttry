import "./_FATAL_MISSING_FILES";
import { nowUtcIso } from "./time";
import { runScheduledCycle } from "./scheduler";
import { loadOrInitLedger } from "./ledger";

function getRequestId(context: any): string | null {
  return context?.requestId ?? context?.invocationId ?? null;
}

function getInvocationId(context: any): string {
  return context?.invocationId ?? ("inv_" + nowUtcIso());
}

function getBuildShaBackend(): string | null {
  return null;
}

export async function scheduled(event: any, context: any): Promise<void> {
  const invocationId = getInvocationId(context);
  const requestId = getRequestId(context);
  const buildShaBackend = getBuildShaBackend();
  await runScheduledCycle({ invocationId, requestId, buildShaBackend });
}

export async function runNow(event: any, context: any): Promise<any> {
  const invocationId = getInvocationId(context);
  const requestId = getRequestId(context);
  const buildShaBackend = getBuildShaBackend();
  await runScheduledCycle({ invocationId, requestId, buildShaBackend });
  const loaded = await loadOrInitLedger(buildShaBackend);
  return { ok: true, ledger: loaded.ledger };
}

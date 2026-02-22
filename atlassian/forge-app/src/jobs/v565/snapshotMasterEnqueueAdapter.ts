/**
 * v5.6.5 Snapshot Master Enqueue Adapter
 *
 * Wired to the existing Phase 6 SnapshotCapturer — the canonical snapshot
 * creation mechanism in this repo (used by createGovernanceSnapshotNow resolver).
 *
 * This adapter:
 * - Persists executionContext, trigger, schemaVersion into the job record
 * - Delegates snapshot capture to SnapshotCapturer (phase6/snapshot_capture)
 * - Saves results via SnapshotStorage / SnapshotRunStorage (phase6/snapshot_storage)
 * - dryRun: verifies wiring is reachable without side-effects
 */
import { storage } from "@forge/api";
import { V565_SCHEMA_VERSION, capReason, nowUtcIso } from "../../v565/constants";
import { setJobStatus, setJobMeta } from "./jobStatus";
import { abortIfMasterFailed } from "./workerAbort";
import { SnapshotCapturer } from "../../phase6/snapshot_capture";
import { SnapshotStorage, SnapshotRunStorage } from "../../phase6/snapshot_storage";
import { resolveTenantIdentity } from "../../core/tenant_identity";

type EnqueueArgs = {
  jobId: string;
  executionContext: "APP" | "USER";
  trigger: "SCHEDULED" | "CATCH_UP_APP" | "MANUAL_UI";
  dryRun: boolean;
  /** Optional Forge invocation context for tenant resolution */
  context?: any;
};

const PROBE_KEY = "ft:v565:adapter:probe";

async function probeStorageRoundTrip(): Promise<void> {
  const v = { schemaVersion: V565_SCHEMA_VERSION, t: nowUtcIso() };
  await storage.set(PROBE_KEY, v);
  const reread = (await storage.get(PROBE_KEY)) as any;
  if (!reread || reread.schemaVersion !== V565_SCHEMA_VERSION) throw new Error("FT_FAIL_ADAPTER_STORAGE_PROBE");
  await storage.delete(PROBE_KEY);
}

export async function enqueueSnapshotMaster(args: EnqueueArgs): Promise<void> {
  if (args.dryRun) {
    await probeStorageRoundTrip();
    // Verify SnapshotCapturer is importable (the import at top-of-file already proves this)
    if (typeof SnapshotCapturer !== "function") throw new Error("FT_FAIL_ADAPTER_ENQUEUE_FN_MISSING");
    console.log("FT_PROOF_ADAPTER_DRYRUN_OK_v1 ok=true");
    return;
  }

  try {
    const jobId = args.jobId;

    // Worker abort: bail if master job already marked FAILED
    if (await abortIfMasterFailed(jobId)) return;

    // Persist job meta under separate key (never overwritten by status updates)
    await setJobMeta({
      schemaVersion: V565_SCHEMA_VERSION,
      jobId,
      executionContext: args.executionContext,
      trigger: args.trigger,
      createdAtUtc: nowUtcIso(),
    });

    // Status transitions: NEW → RUNNING (meta is preserved in its own key)
    await setJobStatus(jobId, "NEW");
    await setJobStatus(jobId, "RUNNING");

    // Resolve tenant identity from provided context (scheduled triggers provide installContext)
    const tenantIdentity = args.context ? resolveTenantIdentity(args.context) : null;
    const tenantId = tenantIdentity?.tenantKey || "app-context";
    const cloudId = tenantIdentity?.cloudId || "app-context";

    // Delegate to the existing Phase 6 SnapshotCapturer — the canonical snapshot mechanism
    const now = nowUtcIso();
    const capturer = new SnapshotCapturer(tenantId, cloudId, "daily");
    const { run, snapshot } = await capturer.capture(now, now, now, now);

    // Persist results via existing storage layer
    const runStorage = new SnapshotRunStorage(tenantId, cloudId);
    await runStorage.createRun(run);

    if (snapshot) {
      const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
      await snapshotStorage.createSnapshot(snapshot);
    }

    // Mark job as DONE
    await setJobStatus(jobId, "DONE");

    console.log("FT_PROOF_ADAPTER_WIRED_v1 ok=true jobId=" + jobId + " snapshotId=" + (snapshot?.snapshot_id || "none"));
  } catch (e: any) {
    // Mark job as FAILED before re-throwing
    try { await setJobStatus(args.jobId, "FAILED"); } catch { /* best-effort */ }
    throw new Error("FT_FAIL_ADAPTER_ENQUEUE_FAILED msg=" + capReason(String(e?.message || e)));
  }
}

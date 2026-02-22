import { getJobStatus } from "./jobStatus";

export async function abortIfMasterFailed(jobId: string): Promise<boolean> {
  const st = await getJobStatus(jobId);
  if (st === "FAILED") {
    console.log("FT_PROOF_WORKER_ABORT_ON_MASTER_FAIL_v1 jobId=" + jobId);
    return true;
  }
  return false;
}

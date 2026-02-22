import { storage } from "@forge/api";
import { JOB_FAILURE_EXPORT_PREFIX, JOB_STATUS_PREFIX, JobStatus, V565_SCHEMA_VERSION, nowUtcIso } from "../../v565/constants";

export async function setJobStatus(jobId: string, status: JobStatus) {
  await storage.set(JOB_STATUS_PREFIX + jobId, { schemaVersion: V565_SCHEMA_VERSION, status, updatedAtUtc: nowUtcIso() });
}
export async function getJobStatus(jobId: string): Promise<JobStatus | "MISSING"> {
  const v = (await storage.get(JOB_STATUS_PREFIX + jobId)) as any;
  if (!v || typeof v.status !== "string") return "MISSING";
  return v.status as JobStatus;
}
export async function setJobFailureExport(jobId: string, failureExport: any) {
  await storage.set(JOB_FAILURE_EXPORT_PREFIX + jobId, failureExport);
}
export async function getJobFailureExport(jobId: string): Promise<any | null> {
  return ((await storage.get(JOB_FAILURE_EXPORT_PREFIX + jobId)) as any) || null;
}

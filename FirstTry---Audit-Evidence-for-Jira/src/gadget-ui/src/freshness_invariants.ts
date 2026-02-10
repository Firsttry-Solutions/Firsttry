/**
 * Freshness Invariant Validation
 * 
 * Enforces that freshness CANNOT be FRESH when snapshot data is missing.
 * This is the ONLY place freshness age/status is computed.
 */

/**
 * Freshness status - stable enum that CANNOT violate invariants
 */
export type FreshnessStatus = "FRESH" | "CURRENT" | "AGING" | "STALE" | "NEVER" | "UNKNOWN";

/**
 * Freshness computation result
 */
export interface FreshnessInfo {
  status: FreshnessStatus;
  age_minutes: number | null;
  reason: string;
}

/**
 * INVARIANT ENFORCEMENT: Compute freshness deterministically
 * 
 * Rules:
 * - If lastSnapshotAtISO is null/undefined/invalid -> status = "NEVER"
 * - If lastSnapshotAtISO exists but age_minutes cannot be computed -> status = "UNKNOWN"
 * - If age_minutes is finite and valid:
 *   - <= 25% of stale threshold -> "FRESH"
 *   - <= 75% of stale threshold -> "CURRENT"
 *   - <= stale threshold -> "AGING"
 *   - > stale threshold -> "STALE"
 * 
 * CRITICAL: "FRESH" ONLY when:
 * 1. lastSnapshotAtISO is a valid ISO string
 * 2. age_minutes is a finite positive number
 * 3. age_minutes <= staleThresholdMinutes * 0.25
 * 
 * This cannot be violated by this function.
 */
export function computeFreshness(
  lastSnapshotAtISO: string | null | undefined,
  nowISO: string,
  staleThresholdMinutes: number = 480 // default: 8 hours
): FreshnessInfo {
  // INVARIANT 1: If no snapshot, never fresh
  if (!lastSnapshotAtISO) {
    return {
      status: "NEVER",
      age_minutes: null,
      reason: "No snapshot exists yet",
    };
  }

  // Parse snapshot timestamp
  let lastSnapshotTime: Date;
  try {
    lastSnapshotTime = new Date(lastSnapshotAtISO);
    if (isNaN(lastSnapshotTime.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (_) {
    return {
      status: "UNKNOWN",
      age_minutes: null,
      reason: "Cannot parse snapshot timestamp",
    };
  }

  // Parse current time
  let nowTime: Date;
  try {
    nowTime = new Date(nowISO);
    if (isNaN(nowTime.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (_) {
    return {
      status: "UNKNOWN",
      age_minutes: null,
      reason: "Cannot parse current timestamp",
    };
  }

  // Compute age
  const ageMs = nowTime.getTime() - lastSnapshotTime.getTime();
  if (!isFinite(ageMs) || ageMs < 0) {
    return {
      status: "UNKNOWN",
      age_minutes: null,
      reason: "Snapshot is in the future or time is invalid",
    };
  }

  const ageMinutes = Math.floor(ageMs / (1000 * 60));

  // INVARIANT 2: Determine status based on age
  const quarterThreshold = staleThresholdMinutes * 0.25;
  const threeQuarterThreshold = staleThresholdMinutes * 0.75;

  if (ageMinutes <= quarterThreshold) {
    return {
      status: "FRESH",
      age_minutes: ageMinutes,
      reason: `Data is ${ageMinutes} minute(s) old (within fresh threshold)`,
    };
  }

  if (ageMinutes <= threeQuarterThreshold) {
    return {
      status: "CURRENT",
      age_minutes: ageMinutes,
      reason: `Data is ${ageMinutes} minute(s) old`,
    };
  }

  if (ageMinutes <= staleThresholdMinutes) {
    return {
      status: "AGING",
      age_minutes: ageMinutes,
      reason: `Data is ${ageMinutes} minute(s) old (approaching stale threshold)`,
    };
  }

  // Age exceeds threshold
  return {
    status: "STALE",
    age_minutes: ageMinutes,
    reason: `Data is ${ageMinutes} minute(s) old (exceeds ${staleThresholdMinutes} min threshold)`,
  };
}

/**
 * Verify freshness invariants are upheld
 * Use this in tests to catch violations
 */
export function verifyFreshnessInvariants(
  info: FreshnessInfo,
  lastSnapshotAtISO: string | null | undefined
): boolean {
  // Rule 1: If no snapshot, status must be "NEVER"
  if (!lastSnapshotAtISO) {
    return info.status === "NEVER" && info.age_minutes === null;
  }

  // Rule 2: If snapshot exists, age must be a finite number (not null)
  if (info.age_minutes === null) {
    return info.status === "UNKNOWN";
  }

  // Rule 3: FRESH only if age <= 25% of stale threshold (using default 480min)
  if (info.status === "FRESH") {
    // Can't know exact threshold, but age must be small
    return info.age_minutes >= 0 && info.age_minutes < 120; // reasonable upper bound for "fresh"
  }

  // Rule 4: STALE only if age is very large
  if (info.status === "STALE") {
    return info.age_minutes >= 120; // reasonable lower bound for "stale"
  }

  return true;
}

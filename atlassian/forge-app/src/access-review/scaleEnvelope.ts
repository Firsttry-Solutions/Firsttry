/**
 * PHASE 3 v1.2 - Scale Envelope Enforcement
 * Resource and workload capacity guardrails
 *
 * Requirements:
 * - Entity count limits (>10k reject)
 * - Time budget enforcement (>240s reject)
 * - Memory estimation and validation
 * - Deterministic envelope calculation
 * - Workload classification & rejection
 * - Marker: [FT_SCALE_ENVELOPE_COMPLETE]
 */

import { ReviewError, ReviewErrorCode } from "./types";

// ============================================================================
// Error Handling
// ============================================================================

export class ScaleEnvelopeError extends ReviewError {
  constructor(
    message: string,
    public dimension: "ENTITY_COUNT" | "TIME_BUDGET" | "MEMORY",
    public current: number,
    public limit: number
  ) {
    super(message);
    this.name = "ScaleEnvelopeError";
    this.code = "SCALE_ENVELOPE_EXCEEDED" as ReviewErrorCode;
  }
}

// ============================================================================
// Configuration
// ============================================================================

export interface ScaleEnvelopeConfig {
  maxEntityCount: number;
  maxTimeBudgetMs: number;
  maxMemoryMB: number;
  entityEstimateBytesPerItem: number;
  timeWarningThresholdMs: number; // Alert if approaching limit
  memoryWarningThresholdMB: number;
}

export const DEFAULT_SCALE_ENVELOPE_CONFIG: ScaleEnvelopeConfig = {
  maxEntityCount: 10000,
  maxTimeBudgetMs: 240000, // 4 minutes
  maxMemoryMB: 1024, // 1 GB
  entityEstimateBytesPerItem: 2048, // 2KB per entity average
  timeWarningThresholdMs: 180000, // 3 minutes = 75% of budget
  memoryWarningThresholdMB: 768, // 75% of limit
};

// ============================================================================
// Workload Classification
// ============================================================================

export type WorkloadSize = "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "OVERSIZED";
export type WorkloadType = "REVIEW_OPEN" | "DECISION_RECORD" | "EXPORT_PACK" | "AUDIT_SCAN";

export interface WorkloadEnvelope {
  type: WorkloadType;
  entityCount: number;
  estimatedDurationMs: number;
  estimatedMemoryMB: number;
  classification: WorkloadSize;
  isWithinEnvelope: boolean;
  violations: ScaleViolation[];
}

export interface ScaleViolation {
  dimension: "ENTITY_COUNT" | "TIME_BUDGET" | "MEMORY";
  current: number;
  limit: number;
  severity: "WARNING" | "CRITICAL";
}

// ============================================================================
// Workload Calculation
// ============================================================================

export function calculateEntityCount(items: any[]): number {
  return items.length;
}

export function estimateExecutionTime(
  entityCount: number,
  operationsPerEntity: number,
  msPerOperation: number
): number {
  return entityCount * operationsPerEntity * msPerOperation;
}

export function estimateMemoryUsage(
  entityCount: number,
  bytesPerEntity: number
): number {
  const totalBytes = entityCount * bytesPerEntity;
  const jsOverhead = 1.5; // Account for JS object overhead
  const mB = (totalBytes * jsOverhead) / (1024 * 1024);
  return Math.ceil(mB);
}

export function classifyWorkloadSize(
  entityCount: number,
  maxCount: number
): WorkloadSize {
  const threshold25 = maxCount * 0.25;
  const threshold50 = maxCount * 0.5;
  const threshold75 = maxCount * 0.75;

  if (entityCount <= threshold25) return "TINY";
  if (entityCount <= threshold50) return "SMALL";
  if (entityCount <= threshold75) return "MEDIUM";
  if (entityCount < maxCount) return "LARGE";
  return "OVERSIZED";
}

// ============================================================================
// Envelope Validation
// ============================================================================

export function validateScaleEnvelope(
  envelope: WorkloadEnvelope,
  config: ScaleEnvelopeConfig
): void {
  envelope.violations = [];

  // Check entity count
  if (envelope.entityCount > config.maxEntityCount) {
    envelope.violations.push({
      dimension: "ENTITY_COUNT",
      current: envelope.entityCount,
      limit: config.maxEntityCount,
      severity: "CRITICAL",
    });
  }

  // Check time budget
  if (envelope.estimatedDurationMs > config.maxTimeBudgetMs) {
    envelope.violations.push({
      dimension: "TIME_BUDGET",
      current: envelope.estimatedDurationMs,
      limit: config.maxTimeBudgetMs,
      severity: "CRITICAL",
    });
  }

  // Check memory
  if (envelope.estimatedMemoryMB > config.maxMemoryMB) {
    envelope.violations.push({
      dimension: "MEMORY",
      current: envelope.estimatedMemoryMB,
      limit: config.maxMemoryMB,
      severity: "CRITICAL",
    });
  }

  // Check warnings
  if (
    envelope.estimatedDurationMs > config.timeWarningThresholdMs &&
    envelope.estimatedDurationMs <= config.maxTimeBudgetMs
  ) {
    envelope.violations.push({
      dimension: "TIME_BUDGET",
      current: envelope.estimatedDurationMs,
      limit: config.maxTimeBudgetMs,
      severity: "WARNING",
    });
  }

  if (
    envelope.estimatedMemoryMB > config.memoryWarningThresholdMB &&
    envelope.estimatedMemoryMB <= config.maxMemoryMB
  ) {
    envelope.violations.push({
      dimension: "MEMORY",
      current: envelope.estimatedMemoryMB,
      limit: config.maxMemoryMB,
      severity: "WARNING",
    });
  }

  envelope.isWithinEnvelope = !envelope.violations.some(
    (v) => v.severity === "CRITICAL"
  );

  if (!envelope.isWithinEnvelope) {
    const criticalViolations = envelope.violations.filter(
      (v) => v.severity === "CRITICAL"
    );
    const details = criticalViolations
      .map((v) => `${v.dimension}: ${v.current} > ${v.limit}`)
      .join("; ");
    throw new ScaleEnvelopeError(
      `Workload exceeds scale envelope: ${details}`,
      criticalViolations[0].dimension,
      criticalViolations[0].current,
      criticalViolations[0].limit
    );
  }
}

// ============================================================================
// Workload Planning
// ============================================================================

export function buildWorkloadEnvelope(
  type: WorkloadType,
  items: any[],
  config: ScaleEnvelopeConfig
): WorkloadEnvelope {
  const entityCount = calculateEntityCount(items);

  // Estimate operations based on workload type
  const operationsPerEntity =
    type === "REVIEW_OPEN" ? 2 : type === "EXPORT_PACK" ? 5 : 1;
  const msPerOperation = 10; // Empirical average

  const estimatedDurationMs = estimateExecutionTime(
    entityCount,
    operationsPerEntity,
    msPerOperation
  );

  const estimatedMemoryMB = estimateMemoryUsage(
    entityCount,
    config.entityEstimateBytesPerItem
  );

  const classification = classifyWorkloadSize(entityCount, config.maxEntityCount);

  const envelope: WorkloadEnvelope = {
    type,
    entityCount,
    estimatedDurationMs,
    estimatedMemoryMB,
    classification,
    isWithinEnvelope: true,
    violations: [],
  };

  validateScaleEnvelope(envelope, config);

  return envelope;
}

// ============================================================================
// Runtime Monitoring
// ============================================================================

export class ScaleMonitor {
  private startTime: number = 0;
  private startMemory: NodeJS.MemoryUsage | null = null;
  private measurements: {
    timestamp: number;
    duration: number;
    memory: number;
    entityCount: number;
  }[] = [];

  constructor(private config: ScaleEnvelopeConfig) {}

  start(): void {
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage?.();
  }

  recordMeasurement(entityCount: number): void {
    const now = Date.now();
    const duration = now - this.startTime;
    const currentMemory = process.memoryUsage?.();
    const memoryMB = currentMemory
      ? (currentMemory.heapUsed - (this.startMemory?.heapUsed || 0)) /
        (1024 * 1024)
      : 0;

    this.measurements.push({
      timestamp: now,
      duration,
      memory: Math.max(0, memoryMB),
      entityCount,
    });

    // Check against limits
    if (duration > this.config.maxTimeBudgetMs) {
      throw new ScaleEnvelopeError(
        `Time budget exceeded: ${duration}ms > ${this.config.maxTimeBudgetMs}ms`,
        "TIME_BUDGET",
        duration,
        this.config.maxTimeBudgetMs
      );
    }

    // Warn if approaching limits
    if (duration > this.config.timeWarningThresholdMs) {
      console.warn(
        `[FT_SCALE_WARNING_TIME] Approaching time budget: ${duration}ms / ${this.config.maxTimeBudgetMs}ms`
      );
    }

    if (memoryMB > this.config.memoryWarningThresholdMB) {
      console.warn(
        `[FT_SCALE_WARNING_MEMORY] Approaching memory limit: ${memoryMB.toFixed(2)}MB / ${this.config.maxMemoryMB}MB`
      );
    }
  }

  stop(): ScaleMonitoringReport {
    const duration = Date.now() - this.startTime;

    const finalMemory = process.memoryUsage?.();
    const totalMemory = finalMemory
      ? (finalMemory.heapUsed - (this.startMemory?.heapUsed || 0)) /
        (1024 * 1024)
      : 0;

    const lastMeasurement = this.measurements[this.measurements.length - 1] || {
      entityCount: 0,
    };

    return {
      totalDurationMs: duration,
      totalMemoryMB: Math.max(0, totalMemory),
      entityCount: lastMeasurement.entityCount,
      measurements: this.measurements,
      efficiency: {
        msPerEntity:
          lastMeasurement.entityCount > 0
            ? duration / lastMeasurement.entityCount
            : 0,
        memoryPerEntity:
          lastMeasurement.entityCount > 0
            ? totalMemory / lastMeasurement.entityCount
            : 0,
      },
      violations: this.measurementViolations(),
    };
  }

  private measurementViolations(): ScaleViolation[] {
    const violations: ScaleViolation[] = [];
    const lastMeasurement =
      this.measurements[this.measurements.length - 1];

    if (!lastMeasurement) return violations;

    if (lastMeasurement.duration > this.config.maxTimeBudgetMs) {
      violations.push({
        dimension: "TIME_BUDGET",
        current: lastMeasurement.duration,
        limit: this.config.maxTimeBudgetMs,
        severity: "CRITICAL",
      });
    }

    if (lastMeasurement.memory > this.config.maxMemoryMB) {
      violations.push({
        dimension: "MEMORY",
        current: Math.ceil(lastMeasurement.memory),
        limit: this.config.maxMemoryMB,
        severity: "CRITICAL",
      });
    }

    return violations;
  }
}

export interface ScaleMonitoringReport {
  totalDurationMs: number;
  totalMemoryMB: number;
  entityCount: number;
  measurements: any[];
  efficiency: {
    msPerEntity: number;
    memoryPerEntity: number;
  };
  violations: ScaleViolation[];
}

// ============================================================================
// Capacity Planning
// ============================================================================

export interface CapacityPlan {
  maxItemsPerQuarter: number;
  recommendedBatchSize: number;
  estimatedProcessingTime: string;
  recommendedSchedule: string;
}

export function recommendCapacityPlan(
  historicalEntityCount: number,
  config: ScaleEnvelopeConfig
): CapacityPlan {
  const growthFactor = 1.5; // Assume 50% growth
  const projectedCount = Math.ceil(historicalEntityCount * growthFactor);

  const safeLimit = Math.floor(config.maxEntityCount * 0.8); // 80% of max
  const batchSize = Math.min(1000, Math.floor(config.maxEntityCount / 10));

  const timePerEntity = config.maxTimeBudgetMs / config.maxEntityCount;
  const projectedTime = projectedCount * timePerEntity;
  const hours = Math.ceil(projectedTime / (60 * 60 * 1000));

  return {
    maxItemsPerQuarter: safeLimit,
    recommendedBatchSize: batchSize,
    estimatedProcessingTime: `${hours} hours`,
    recommendedSchedule:
      projectedCount < config.maxEntityCount * 0.5
        ? "Single batch"
        : "Multiple batches with 1+ hour gaps",
  };
}

// ============================================================================
// MARKER
// ============================================================================

console.log("[FT_SCALE_ENVELOPE_COMPLETE] Scale envelope enforcement loaded");

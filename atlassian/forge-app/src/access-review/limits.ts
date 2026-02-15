/**
 * PHASE 3 v1.2 - Abuse Control & Rate Limiting Engine
 * Prevents resource exhaustion and enforces operational guardrails
 *
 * Requirements:
 * - Rate limiting (operations per time window)
 * - Export size guards (max payload)
 * - Entity count limits (reject if >10k)
 * - Configurable thresholds
 * - Deterministic token bucket algorithm
 * - Marker: [FT_LIMITS_ABUSE_CONTROLS_COMPLETE]
 */

import { ReviewError, ReviewErrorCode } from "./types";
import * as crypto from "crypto";

// ============================================================================
// Error Handling
// ============================================================================

export class LimitExceededError extends ReviewError {
  constructor(
    message: string,
    public limitType: string,
    public current: number,
    public limit: number
  ) {
    super(message);
    this.name = "LimitExceededError";
    this.code = "LIMIT_EXCEEDED" as ReviewErrorCode;
  }
}

// ============================================================================
// Configuration
// ============================================================================

export interface RateLimitConfig {
  window: "1m" | "5m" | "1h" | "1d";
  maxTokens: number;
  refillRate: number; // tokens per second
}

export interface AbuseControlConfig {
  rateLimits: {
    openReview: RateLimitConfig;
    recordDecision: RateLimitConfig;
    addException: RateLimitConfig;
    exportPack: RateLimitConfig;
  };
  exportMaxSizeBytes: number;
  entityCountLimit: number;
  decisionCountPerReview: number;
  exceptionCountPerReview: number;
  timeBudgetMs: number; // Max execution time per operation
  memoryEstimateMB: number; // Max memory for operation
}

export const DEFAULT_ABUSE_CONTROL_CONFIG: AbuseControlConfig = {
  rateLimits: {
    openReview: {
      window: "1h",
      maxTokens: 100,
      refillRate: 0.016, // 100 per hour
    },
    recordDecision: {
      window: "1h",
      maxTokens: 1000,
      refillRate: 0.277, // 1000 per hour
    },
    addException: {
      window: "1h",
      maxTokens: 500,
      refillRate: 0.138, // 500 per hour
    },
    exportPack: {
      window: "1d",
      maxTokens: 50,
      refillRate: 0.0005, // 50 per day
    },
  },
  exportMaxSizeBytes: 50 * 1024 * 1024, // 50 MB
  entityCountLimit: 10000,
  decisionCountPerReview: 5000,
  exceptionCountPerReview: 1000,
  timeBudgetMs: 240000, // 4 minutes
  memoryEstimateMB: 1024, // 1 GB
};

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

export interface TokenBucketState {
  tokens: number;
  lastRefillTime: number;
  totalRequests: number;
  blockedRequests: number;
}

export class TokenBucket {
  private bucketId: string;
  private state: TokenBucketState;

  constructor(
    private config: RateLimitConfig,
    private contextId: string // e.g., siteId:accountId
  ) {
    this.bucketId = `limit:${contextId}`;
    this.state = {
      tokens: config.maxTokens,
      lastRefillTime: Date.now(),
      totalRequests: 0,
      blockedRequests: 0,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.state.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.config.refillRate;

    this.state.tokens = Math.min(
      this.config.maxTokens,
      this.state.tokens + tokensToAdd
    );
    this.state.lastRefillTime = now;
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();
    this.state.totalRequests++;

    if (this.state.tokens >= tokens) {
      this.state.tokens -= tokens;
      return true;
    } else {
      this.state.blockedRequests++;
      return false;
    }
  }

  getState(): {
    tokensAvailable: number;
    totalRequests: number;
    blockedRequests: number;
    blockRate: number;
  } {
    this.refill();
    const blockRate =
      this.state.totalRequests > 0
        ? this.state.blockedRequests / this.state.totalRequests
        : 0;

    return {
      tokensAvailable: this.state.tokens,
      totalRequests: this.state.totalRequests,
      blockedRequests: this.state.blockedRequests,
      blockRate,
    };
  }

  getMetadata(): string {
    return JSON.stringify({
      bucketId: this.bucketId,
      window: this.config.window,
      maxTokens: this.config.maxTokens,
      state: this.getState(),
    });
  }
}

// ============================================================================
// Rate Limiter Manager
// ============================================================================

export class RateLimiterManager {
  private buckets: Map<string, TokenBucket> = new Map();

  constructor(private config: AbuseControlConfig) {}

  private getBucketKey(
    operation: keyof AbuseControlConfig["rateLimits"],
    contextId: string
  ): string {
    return `${operation}:${contextId}`;
  }

  checkRateLimit(
    operation: keyof AbuseControlConfig["rateLimits"],
    contextId: string,
    tokens: number = 1
  ): void {
    const key = this.getBucketKey(operation, contextId);
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = new TokenBucket(this.config.rateLimits[operation], contextId);
      this.buckets.set(key, bucket);
    }

    if (!bucket.tryConsume(tokens)) {
      throw new LimitExceededError(
        `Rate limit exceeded for ${operation}`,
        operation,
        1,
        0
      );
    }
  }

  getMetrics(
    operation: keyof AbuseControlConfig["rateLimits"],
    contextId: string
  ): any {
    const key = this.getBucketKey(operation, contextId);
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return {
        operation,
        contextId,
        status: "NO_REQUESTS",
        tokensAvailable: this.config.rateLimits[operation].maxTokens,
      };
    }

    return {
      operation,
      contextId,
      status: "ACTIVE",
      ...bucket.getState(),
    };
  }
}

// ============================================================================
// Entity Count & Size Validation
// ============================================================================

export function validateEntityCount(
  count: number,
  limit: number,
  entityType: string
): void {
  if (count > limit) {
    throw new LimitExceededError(
      `Too many ${entityType} entities: ${count} > ${limit}`,
      "ENTITY_COUNT",
      count,
      limit
    );
  }
}

export function validateExportSize(
  sizeBytes: number,
  maxBytes: number
): void {
  if (sizeBytes > maxBytes) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(2);
    throw new LimitExceededError(
      `Export too large: ${mb}MB > ${maxMb}MB`,
      "EXPORT_SIZE",
      sizeBytes,
      maxBytes
    );
  }
}

export function validateTimeBudget(
  elapsedMs: number,
  budgetMs: number
): void {
  if (elapsedMs > budgetMs) {
    throw new LimitExceededError(
      `Operation exceeded time budget: ${elapsedMs}ms > ${budgetMs}ms`,
      "TIME_BUDGET",
      elapsedMs,
      budgetMs
    );
  }
}

export function validateMemoryEstimate(
  estimatedMB: number,
  limitMB: number
): void {
  if (estimatedMB > limitMB) {
    throw new LimitExceededError(
      `Memory estimate exceeded: ${estimatedMB}MB > ${limitMB}MB`,
      "MEMORY_LIMIT",
      estimatedMB,
      limitMB
    );
  }
}

// ============================================================================
// Size Calculation Utilities
// ============================================================================

export function estimateSizeBytes(obj: any): number {
  const json = JSON.stringify(obj);
  return Buffer.byteLength(json, "utf-8");
}

export function estimateMemoryMB(records: number, avgBytesPerRecord: number): number {
  const totalBytes = records * avgBytesPerRecord;
  const overheadFactor = 1.5; // Account for JS object overhead
  return (totalBytes * overheadFactor) / (1024 * 1024);
}

// ============================================================================
// Monitoring & Alerts
// ============================================================================

export interface AbuseAlert {
  id: string;
  timestamp: number;
  severity: "WARNING" | "CRITICAL";
  type: "RATE_LIMIT" | "EXPORT_SIZE" | "ENTITY_COUNT" | "TIME_BUDGET" | "MEMORY";
  message: string;
  contextId: string;
}

export interface AbuseTelemetry {
  rateLimitViolations: number;
  exportSizeViolations: number;
  entityCountViolations: number;
  timeBudgetViolations: number;
  memoryViolations: number;
  alerts: AbuseAlert[];
}

export class AbuseTelemetry implements AbuseTelemetry {
  rateLimitViolations = 0;
  exportSizeViolations = 0;
  entityCountViolations = 0;
  timeBudgetViolations = 0;
  memoryViolations = 0;
  alerts: AbuseAlert[] = [];

  recordViolation(
    type: "RATE_LIMIT" | "EXPORT_SIZE" | "ENTITY_COUNT" | "TIME_BUDGET" | "MEMORY",
    message: string,
    contextId: string,
    severity: "WARNING" | "CRITICAL"
  ): void {
    const alert: AbuseAlert = {
      id: `ALERT_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      severity,
      type,
      message,
      contextId,
    };

    this.alerts.push(alert);

    switch (type) {
      case "RATE_LIMIT":
        this.rateLimitViolations++;
        break;
      case "EXPORT_SIZE":
        this.exportSizeViolations++;
        break;
      case "ENTITY_COUNT":
        this.entityCountViolations++;
        break;
      case "TIME_BUDGET":
        this.timeBudgetViolations++;
        break;
      case "MEMORY":
        this.memoryViolations++;
        break;
    }

    if (severity === "CRITICAL") {
      console.error(`[FT_ABUSE_ALERT_CRITICAL] ${alert.id}: ${message}`);
    } else {
      console.warn(`[FT_ABUSE_ALERT_WARNING] ${alert.id}: ${message}`);
    }
  }

  getReport(): AbuseAlert[] {
    return [...this.alerts];
  }

  getMetrics(): {
    totalViolations: number;
    criticalAlerts: number;
    violations: Record<string, number>;
  } {
    const totalViolations =
      this.rateLimitViolations +
      this.exportSizeViolations +
      this.entityCountViolations +
      this.timeBudgetViolations +
      this.memoryViolations;

    const criticalAlerts = this.alerts.filter(
      (a) => a.severity === "CRITICAL"
    ).length;

    return {
      totalViolations,
      criticalAlerts,
      violations: {
        rateLimitViolations: this.rateLimitViolations,
        exportSizeViolations: this.exportSizeViolations,
        entityCountViolations: this.entityCountViolations,
        timeBudgetViolations: this.timeBudgetViolations,
        memoryViolations: this.memoryViolations,
      },
    };
  }
}

// ============================================================================
// MARKER
// ============================================================================

console.log("[FT_LIMITS_ABUSE_CONTROLS_COMPLETE] Abuse controls engine loaded");

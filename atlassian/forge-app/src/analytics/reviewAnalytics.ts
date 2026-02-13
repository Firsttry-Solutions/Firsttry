/**
 * FirstTry Phase 3 — Analytics & Risk Trends
 * 
 * 90-entry ring buffer for trend analysis:
 * - Review completion time
 * - Compliance scores
 * - High-risk item count
 * - Exception count
 *
 * Used for:
 * - Historical trend charts
 * - Median completion time
 * - Risk reduction delta
 *
 * Deterministic: Same input always produces same chart data
 */

import { ReviewWorkflow } from "../access-review/types";

/**
 * Single review analytics entry
 */
export interface ReviewAnalyticsEntry {
  reviewId: string;
  completionTimeMs: number; // milliseconds from open to close
  complianceScore: number; // 0-100
  highRiskCount: number;
  exceptionCount: number;
  totalItems: number;
  decidedItems: number;
  progress: number; // 0-100
  timestamp: string; // ISO 8601 UTC
}

/**
 * ReviewAnalyticsBuffer: 90-entry ring buffer with trend computation
 */
export class ReviewAnalyticsBuffer {
  private entries: ReviewAnalyticsEntry[] = [];
  private readonly MAX_ENTRIES = 90;

  /**
   * Add a review analytics entry (from closed workflow)
   * If buffer full, rotates out oldest entry
   */
  addEntry(workflow: ReviewWorkflow): void {
    if (workflow.status !== "closed" || !workflow.closedAt) {
      throw new Error("Cannot analyze open review");
    }

    const createdTime = new Date(workflow.createdAt);
    const closedTime = new Date(workflow.closedAt);
    const completionMs = closedTime.getTime() - createdTime.getTime();

    const highRiskCount = Object.values(workflow.items).filter(
      (item) => item.riskLevel === "high"
    ).length;

    const entry: ReviewAnalyticsEntry = {
      reviewId: workflow.reviewId,
      completionTimeMs: completionMs,
      complianceScore: workflow.complianceScore,
      highRiskCount,
      exceptionCount: workflow.exceptions.length,
      totalItems: Object.keys(workflow.items).length,
      decidedItems: Object.values(workflow.decisions).filter((d) => d.length > 0)
        .length,
      progress: workflow.progress,
      timestamp: workflow.closedAt,
    };

    // If full, rotate out oldest
    if (this.entries.length >= this.MAX_ENTRIES) {
      this.entries.shift();
    }

    this.entries.push(entry);
    console.log(
      `[FT_ANALYTICS] Added entry: reviewId=${workflow.reviewId} completionTime=${Math.round(completionMs / 3600000)}h score=${workflow.complianceScore}`
    );
  }

  /**
   * Get all entries (for export/analysis)
   */
  getEntries(): ReviewAnalyticsEntry[] {
    return [...this.entries]; // Return copy for immutability
  }

  /**
   * Compute median completion time (in hours)
   */
  getMedianCompletionHours(): number {
    if (this.entries.length === 0) return 0;

    const times = this.entries
      .map((e) => e.completionTimeMs / (1000 * 60 * 60))
      .sort((a, b) => a - b);

    const mid = Math.floor(times.length / 2);
    if (times.length % 2 === 0) {
      return (times[mid - 1] + times[mid]) / 2;
    }
    return times[mid];
  }

  /**
   * Compute trend: risk reduction delta (of last 2 reviews)
   * Negative = improvement, Positive = deterioration
   */
  getRiskReductionDelta(): number | null {
    if (this.entries.length < 2) return null;

    const latest = this.entries[this.entries.length - 1];
    const previous = this.entries[this.entries.length - 2];

    // Delta in high-risk unreviewed items
    const riskMetric = (entry: ReviewAnalyticsEntry) =>
      entry.highRiskCount * (1 - entry.progress / 100);

    const delta = riskMetric(latest) - riskMetric(previous);
    return delta;
  }

  /**
   * Get chart data (deterministic)
   * For use in UI/reports
   */
  getChartData(): {
    complianceTrend: Array<{ reviewId: string; score: number }>;
    completionTrend: Array<{ reviewId: string; hours: number }>;
    riskTrend: Array<{ reviewId: string; highRiskCount: number }>;
  } {
    return {
      complianceTrend: this.entries.map((e) => ({
        reviewId: e.reviewId,
        score: e.complianceScore,
      })),
      completionTrend: this.entries.map((e) => ({
        reviewId: e.reviewId,
        hours: Math.round(e.completionTimeMs / (1000 * 60 * 60)),
      })),
      riskTrend: this.entries.map((e) => ({
        reviewId: e.reviewId,
        highRiskCount: e.highRiskCount,
      })),
    };
  }

  /**
   * Compute summary statistics
   */
  getSummaryStats(): {
    totalReviews: number;
    averageComplianceScore: number;
    medianCompletionHours: number;
    lowestScore: number;
    highestScore: number;
    riskDelta: number | null;
  } {
    if (this.entries.length === 0) {
      return {
        totalReviews: 0,
        averageComplianceScore: 0,
        medianCompletionHours: 0,
        lowestScore: 100,
        highestScore: 0,
        riskDelta: null,
      };
    }

    const scores = this.entries.map((e) => e.complianceScore);

    return {
      totalReviews: this.entries.length,
      averageComplianceScore:
        this.entries.reduce((sum, e) => sum + e.complianceScore, 0) / this.entries.length,
      medianCompletionHours: this.getMedianCompletionHours(),
      lowestScore: Math.min(...scores),
      highestScore: Math.max(...scores),
      riskDelta: this.getRiskReductionDelta(),
    };
  }

  /**
   * Persist buffer (JSON format)
   */
  serialize(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Restore buffer from persisted JSON
   */
  static deserialize(json: string): ReviewAnalyticsBuffer {
    const buffer = new ReviewAnalyticsBuffer();
    buffer.entries = JSON.parse(json);
    return buffer;
  }
}

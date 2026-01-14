/**
 * Progress Tracker Renderer
 * 
 * Renders a timeline of phases showing progress through the governance pipeline.
 * Replaces the old phase table with an accessible, semantic timeline.
 */

import { createStatusBadge, StatusColor } from "./status";

export interface ProgressTrackerOptions {
    containerId?: string;
    legacyData?: any;
}

/**
 * Determine phase status from legacy data
 */
function getPhaseStatus(
    legacyData: any,
    phaseIndex: number
): { color: StatusColor; label: string; complete: boolean } {
    if (!legacyData) {
        return { color: "gray", label: "Pending", complete: false };
    }

    // Phase indices: 0=Phase1, 1=Phase2, 2=Phase3, 3=Phase4, 4=Phase5, 5=Phase6
    const phasesCompleted = legacyData.phasesCompleted || [];
    const isComplete = phasesCompleted.includes(phaseIndex);

    if (isComplete) {
        return { color: "green", label: "Complete", complete: true };
    }

    // If system is degraded/error, phases may be blocked
    if (legacyData.systemStatus === "DEGRADED" || legacyData.systemStatus === "ERROR") {
        return { color: "yellow", label: "Pending", complete: false };
    }

    // Check if this is the current phase (from unifiedStatus or fallback logic)
    const currentPhase = legacyData.currentPhaseIndex ?? 0;
    if (phaseIndex === currentPhase) {
        return { color: "yellow", label: "In Progress", complete: false };
    }

    return { color: "gray", label: "Pending", complete: false };
}

/**
 * Get phase description
 */
function getPhaseDescription(phaseIndex: number): string {
    const descriptions = [
        "Phase 1: Event ingestion endpoint with token auth, validation, idempotency, storage",
        "Phase 2: Scheduled daily/weekly pipelines, run ledgers, readiness gating",
        "Phase 3: Compliance snapshot capture and evidence ledger",
        "Phase 4: Dashboard gadget integration and real-time visibility",
        "Phase 5: Automated scheduler and threshold-based alerting",
        "Phase 6: Trust snapshot export with PDF audit trail"
    ];
    return descriptions[phaseIndex] || `Phase ${phaseIndex + 1}`;
}

/**
 * Create a single phase step in the timeline
 */
function createPhaseStep(
    phaseIndex: number,
    status: { color: StatusColor; label: string; complete: boolean },
    lastRunAt?: string
): HTMLElement {
    const step = document.createElement("li");
    step.className = `progress-step status-${status.color}`;
    if (status.complete) step.classList.add("complete");

    step.setAttribute("role", "listitem");
    step.setAttribute("aria-label", `Phase ${phaseIndex + 1}: ${status.label}`);

    // Step marker
    const marker = document.createElement("div");
    marker.className = "progress-step-marker";

    const badge = document.createElement("span");
    badge.className = "progress-badge";
    badge.setAttribute("aria-current", status.color === "yellow" ? "step" : "false");
    badge.textContent = String(phaseIndex + 1);

    marker.appendChild(badge);
    step.appendChild(marker);

    // Step content
    const content = document.createElement("div");
    content.className = "progress-content";

    const titleEl = document.createElement("div");
    titleEl.className = "progress-title";
    titleEl.textContent = getPhaseDescription(phaseIndex);

    const statusEl = document.createElement("div");
    statusEl.className = "progress-status";
    statusEl.appendChild(
        createStatusBadge({
            color: status.color,
            label: status.label
        })
    );

    content.appendChild(titleEl);
    content.appendChild(statusEl);

    if (lastRunAt) {
        const timestampEl = document.createElement("div");
        timestampEl.className = "progress-timestamp";
        const date = new Date(lastRunAt);
        timestampEl.textContent = `Last run: ${date.toLocaleString()}`;
        content.appendChild(timestampEl);
    }

    step.appendChild(content);

    return step;
}

/**
 * Render progress tracker timeline
 */
export function renderProgressTracker(options: ProgressTrackerOptions = {}): HTMLElement | null {
    const containerId = options.containerId || "progress-tracker-section";
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn(`[renderProgressTracker] Container #${containerId} not found`);
        return null;
    }

    container.innerHTML = "";
    container.className = "progress-tracker";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Governance Pipeline Progress");

    const legacyData = options.legacyData || {};

    // Create timeline list
    const timeline = document.createElement("ol");
    timeline.className = "progress-timeline";
    timeline.setAttribute("role", "list");

    // Add 6 phases
    for (let i = 0; i < 6; i++) {
        const status = getPhaseStatus(legacyData, i);
        const lastRunAt = legacyData.phaseLastRunAt?.[i];
        const step = createPhaseStep(i, status, lastRunAt);
        timeline.appendChild(step);
    }

    container.appendChild(timeline);

    // Add summary text below timeline
    const phasesCompleted = legacyData.phasesCompleted?.length || 0;
    const summary = document.createElement("div");
    summary.className = "progress-summary";
    summary.setAttribute("role", "status");
    summary.textContent = `${phasesCompleted} of 6 phases complete`;

    container.appendChild(summary);

    return container;
}

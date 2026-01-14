/**
 * Progress Tracker Renderer (Enterprise v2 - Roadmap View)
 * 
 * Renders a collapsed roadmap timeline showing planned capabilities.
 * Emphasizes that these are planned items, not active phases.
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
        return { color: "gray", label: "Planned", complete: false };
    }

    // Phase indices: 0=Phase1, 1=Phase2, 2=Phase3, 3=Phase4, 4=Phase5, 5=Phase6
    const phasesCompleted = legacyData.phasesCompleted || [];
    const isComplete = phasesCompleted.includes(phaseIndex);

    if (isComplete) {
        return { color: "green", label: "Complete", complete: true };
    }

    // If system is degraded/error, phases are not active
    if (legacyData.systemStatus === "DEGRADED" || legacyData.systemStatus === "ERROR") {
        return { color: "gray", label: "Not active", complete: false };
    }

    // Check if this is the current phase (from unifiedStatus or fallback logic)
    const currentPhase = legacyData.currentPhaseIndex ?? 0;
    if (phaseIndex === currentPhase) {
        return { color: "yellow", label: "In Progress", complete: false };
    }

    return { color: "gray", label: "Not active", complete: false };
}

/**
 * Get phase description
 */
function getPhaseDescription(phaseIndex: number): string {
    const descriptions = [
        "Event ingestion with authentication & validation",
        "Scheduled pipelines & run ledgers",
        "Compliance snapshots & audit trail",
        "Dashboard integration & visibility",
        "Automated scheduling & alerting",
        "Trust export with PDF audit"
    ];
    return descriptions[phaseIndex] || `Capability ${phaseIndex + 1}`;
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
    step.setAttribute("aria-label", `Capability ${phaseIndex + 1}: ${status.label}`);

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

    const legacyData = options.legacyData || {};

    // Wrap in details/summary for collapsed state
    const details = document.createElement("details");
    details.style.marginBottom = "16px";
    details.style.background = "#ffffff";
    details.style.border = "1px solid #dfe1e6";
    details.style.borderRadius = "8px";
    details.style.padding = "16px";
    details.style.boxShadow = "0 1px 1px rgba(9, 30, 66, 0.13)";
    
    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.style.fontSize = "16px";
    summary.style.fontWeight = "600";
    summary.style.color = "#0052cc";
    summary.style.marginBottom = "12px";
    summary.style.listStyle = "none";
    summary.innerHTML = "📋 Planned Capabilities (Roadmap)";
    
    // Add disclosure triangle manually
    const triangle = document.createElement("span");
    triangle.style.marginRight = "8px";
    triangle.style.display = "inline-block";
    summary.insertBefore(triangle, summary.firstChild);
    
    details.appendChild(summary);
    
    // Add roadmap disclaimer
    const disclaimer = document.createElement("p");
    disclaimer.style.fontSize = "13px";
    disclaimer.style.color = "#8590a2";
    disclaimer.style.marginBottom = "16px";
    disclaimer.style.marginTop = "12px";
    disclaimer.style.lineHeight = "1.5";
    disclaimer.textContent = "These capabilities are planned for future releases and are not active in the current edition.";
    details.appendChild(disclaimer);

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

    details.appendChild(timeline);

    // Add summary text below timeline
    const phasesCompleted = legacyData.phasesCompleted?.length || 0;
    const progressSummary = document.createElement("div");
    progressSummary.className = "progress-summary";
    progressSummary.setAttribute("role", "status");
    progressSummary.style.marginTop = "12px";
    progressSummary.style.fontSize = "13px";
    progressSummary.style.color = "#8590a2";
    progressSummary.textContent = `${phasesCompleted} of 6 capabilities active`;

    details.appendChild(progressSummary);

    container.appendChild(details);
    return container;
}

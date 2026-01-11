/**
 * Status Banner Renderer
 * 
 * Renders a prominent alert banner only when system is degraded/failing.
 * Shows message, impact, recommended action, and reasonCode.
 */

import { createStatusLozenge, StatusColor } from "./status";

export interface StatusBannerOptions {
    containerId?: string;
    legacyData?: any;
}

/**
 * Determine if banner should be shown and what color
 */
function shouldShowBanner(legacyData: any): { show: boolean; color: StatusColor; message: string } {
    if (!legacyData) {
        return {
            show: false,
            color: "gray",
            message: ""
        };
    }

    if (legacyData.systemStatus === "DEGRADED") {
        return {
            show: true,
            color: "yellow",
            message: legacyData.degradedReason || "System is operating in degraded mode"
        };
    }

    if (legacyData.systemStatus === "ERROR") {
        return {
            show: true,
            color: "red",
            message: "System is failing. Immediate action required."
        };
    }

    return {
        show: false,
        color: "gray",
        message: ""
    };
}

/**
 * Get impact description
 */
function getImpactDescription(color: StatusColor, legacyData: any): string {
    if (color === "red") {
        return "No data is being collected. Governance processes may not be enforced.";
    }
    if (color === "yellow") {
        return "Data collection is delayed or incomplete. Some processes may be delayed.";
    }
    return "";
}

/**
 * Get recommended action
 */
function getRecommendedAction(color: StatusColor, legacyData: any): string {
    if (color === "red") {
        return "Check the server logs, verify the Jira instance is accessible, and restart if needed.";
    }
    if (color === "yellow") {
        return "Monitor the system and check for any infrastructure or permission issues.";
    }
    return "";
}

/**
 * Render status banner
 */
export function renderStatusBanner(options: StatusBannerOptions = {}): HTMLElement | null {
    const containerId = options.containerId || "status-banner-section";
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn(`[renderStatusBanner] Container #${containerId} not found`);
        return null;
    }

    container.innerHTML = "";

    const legacyData = options.legacyData || {};
    const { show, color, message } = shouldShowBanner(legacyData);

    if (!show) {
        container.style.display = "none";
        return container;
    }

    container.style.display = "block";
    container.className = `status-banner status-${color}`;
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", color === "red" ? "assertive" : "polite");
    container.setAttribute("aria-label", `System Status: ${message}`);

    // Main banner content
    const bannerContent = document.createElement("div");
    bannerContent.className = "status-banner-content";

    // Status badge
    const badgeEl = document.createElement("div");
    badgeEl.className = "status-banner-badge";
    badgeEl.appendChild(
        createStatusLozenge({
            color,
            message,
            reasonCode: color === "red" ? "ERROR" : "DEGRADED"
        })
    );

    // Message and details
    const detailsEl = document.createElement("div");
    detailsEl.className = "status-banner-details";

    const messageEl = document.createElement("div");
    messageEl.className = "status-banner-message";
    messageEl.textContent = message;

    const impactEl = document.createElement("div");
    impactEl.className = "status-banner-impact";
    impactEl.innerHTML = `<strong>Impact:</strong> ${getImpactDescription(color, legacyData)}`;

    const actionEl = document.createElement("div");
    actionEl.className = "status-banner-action";
    actionEl.innerHTML = `<strong>Recommended:</strong> ${getRecommendedAction(color, legacyData)}`;

    detailsEl.appendChild(messageEl);
    detailsEl.appendChild(impactEl);
    detailsEl.appendChild(actionEl);

    bannerContent.appendChild(badgeEl);
    bannerContent.appendChild(detailsEl);

    container.appendChild(bannerContent);

    return container;
}

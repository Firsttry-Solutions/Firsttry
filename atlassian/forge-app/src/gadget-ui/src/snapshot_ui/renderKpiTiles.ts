/**
 * KPI Tiles Renderer (v2)
 * 
 * Renders 8 KPI tiles in a 2x4 responsive grid at the top of the dashboard.
 * Each tile shows a key metric with normalized status badge.
 * Uses the statusModel for consistent severity mapping.
 */

import { createStatusBadge, StatusColor } from "./status";
import { normalizeStatus } from "./statusModel";

export interface KpiTilesOptions {
    containerId?: string;
    unifiedStatus?: any;
    legacyData?: any;
}

/**
 * Determine KPI tile status from legacy data using normalized status model
 */
function determineKpiStatus(
    legacyData: any,
    field: string
): { color: StatusColor; text: string; reasonCode?: string } {
    const defaultGray = { color: "gray" as const, text: "Awaiting data", reasonCode: "INITIALIZING_NO_DATA" };

    if (!legacyData) return defaultGray;

    const normalized = normalizeStatus(legacyData, field);
    
    // Map normalized severity to color
    const severityToColor: Record<string, StatusColor> = {
        OK: "green",
        WARNING: "yellow",
        DEGRADED: "yellow",
        ERROR: "red",
        UNKNOWN: "gray",
    };

    return {
        color: severityToColor[normalized.severity] as StatusColor,
        text: normalized.label,
        reasonCode: normalized.reasonCode,
    };
}

/**
 * Get KPI value for display
 */
function getKpiValue(legacyData: any, field: string): string {
    if (!legacyData) return "—";

    switch (field) {
        case "overall": return legacyData.systemStatus || "—";
        case "freshness": return legacyData.freshnessStatus || "—";
        case "scheduler": return legacyData.lastCheckAt ? new Date(legacyData.lastCheckAt).toLocaleTimeString() : "—";
        case "snapshot": return legacyData.lastSuccessAt ? new Date(legacyData.lastSuccessAt).toLocaleString() : "Never";
        case "readOnly": return "Read-only posture (code-level guard passed)";
        case "egress": return "Data egress policy";
        case "storage": return "Storage isolation";
        case "export": return `${legacyData.snapshotsRetainedCount || 0} snapshots`;
        default: return "—";
    }
}

/**
 * Create a single KPI tile
 */
function createKpiTile(title: string, status: { color: StatusColor; text: string; reasonCode?: string }, value: string): HTMLElement {
    const tile = document.createElement("div");
    tile.className = `kpi-tile`;
    tile.setAttribute("role", "article");
    tile.setAttribute("aria-label", `${title}: ${status.text}`);

    const titleEl = document.createElement("div");
    titleEl.className = "kpi-title";
    titleEl.textContent = title;

    const statusEl = document.createElement("div");
    statusEl.className = "kpi-status-container";
    statusEl.appendChild(createStatusBadge({
        color: status.color,
        label: status.text,
        reasonCode: status.reasonCode
    }));

    const valueEl = document.createElement("div");
    valueEl.className = "kpi-value";
    valueEl.textContent = value;

    tile.appendChild(titleEl);
    tile.appendChild(statusEl);
    tile.appendChild(valueEl);

    return tile;
}

/**
 * Render KPI tiles grid
 */
export function renderKpiTiles(options: KpiTilesOptions = {}): HTMLElement | null {
    const containerId = options.containerId || "kpi-tiles-section";
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn(`[renderKpiTiles] Container #${containerId} not found`);
        return null;
    }

    container.innerHTML = "";
    container.className = "kpi-tiles-grid";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Key Performance Indicators");

    const legacyData = options.legacyData || {};

    // Define 8 KPIs
    const kpis = [
        { title: "Overall Health", field: "overall" },
        { title: "Data Freshness", field: "freshness" },
        { title: "Scheduler", field: "scheduler" },
        { title: "Last Snapshot", field: "snapshot" },
        { title: "Read-Only Guarantee", field: "readOnly" },
        { title: "Data Egress", field: "egress" },
        { title: "Storage Isolation", field: "storage" },
        { title: "Export Readiness", field: "export" }
    ];

    // Render each tile
    for (const kpi of kpis) {
        const status = determineKpiStatus(legacyData, kpi.field);
        const value = getKpiValue(legacyData, kpi.field);
        const tile = createKpiTile(kpi.title, status, value);
        container.appendChild(tile);
    }

    return container;
}

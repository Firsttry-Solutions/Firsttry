/**
 * Export Policy Enforcer
 * 
 * Single source of truth for export availability.
 * Gates download/action buttons based on unifiedStatus.export or legacy fallback.
 * 
 * Rules:
 * - isReady = true => enable all download buttons + snapshot export
 * - isReady = false => disable buttons, show message + reasonCode
 * - manual copy panel ALWAYS enabled (textarea + copy button)
 */

export interface ExportPolicyOptions {
    rootElement?: HTMLElement;
    legacyData?: any;
    unifiedStatus?: any;
}

/**
 * Determine if export is ready
 */
function isExportReady(legacyData: any, unifiedStatus?: any): {
    ready: boolean;
    message: string;
    reasonCode?: string;
} {
    // Prefer unifiedStatus if available
    if (unifiedStatus?.export) {
        const { isReady, message, reasonCode } = unifiedStatus.export;
        return {
            ready: isReady ?? false,
            message: message || "Export not available",
            reasonCode
        };
    }

    // Fallback to legacy logic
    if (!legacyData) {
        return {
            ready: false,
            message: "Data not yet available",
            reasonCode: "INITIALIZING_NO_DATA"
        };
    }

    if (legacyData.systemStatus !== "RUNNING") {
        return {
            ready: false,
            message: "System is not operational",
            reasonCode: "SYSTEM_NOT_RUNNING"
        };
    }

    if (legacyData.freshnessStatus === "STALE") {
        return {
            ready: false,
            message: "Data is stale. Snapshot may not be current.",
            reasonCode: "DATA_STALE"
        };
    }

    return {
        ready: true,
        message: "Export ready",
        reasonCode: "OK"
    };
}

/**
 * Apply export policy to the DOM
 * 
 * 1. Find all export control buttons (copy, json, csv, snapshot)
 * 2. Enable/disable based on isReady
 * 3. Update export-status message
 * 4. Ensure manual copy panel always has working copy button
 */
export function applyExportPolicy(options: ExportPolicyOptions = {}): void {
    const root = options.rootElement || document.body;
    const legacyData = options.legacyData || {};
    const unifiedStatus = options.unifiedStatus;

    const { ready, message, reasonCode } = isExportReady(legacyData, unifiedStatus);

    // Find export button elements
    const copyBtn = root.querySelector("#copy-summary-btn") as HTMLButtonElement | null;
    const jsonBtn = root.querySelector("#download-json-btn") as HTMLButtonElement | null;
    const csvBtn = root.querySelector("#download-csv-btn") as HTMLButtonElement | null;
    const snapshotBtn = root.querySelector("#export-trust-snapshot-btn") as HTMLButtonElement | null;
    const statusEl = root.querySelector("#export-status") as HTMLElement | null;

    // Update status message
    if (statusEl) {
        statusEl.textContent = message;
        if (!ready) {
            statusEl.style.color = "#ae2a19"; // Error red
            if (reasonCode) {
                statusEl.title = `Reason: ${reasonCode}`;
            }
        } else {
            statusEl.style.color = "#216e4e"; // Success green
            statusEl.title = "";
        }
    }

    // Gate download buttons
    const downloadButtons = [copyBtn, jsonBtn, csvBtn, snapshotBtn].filter(Boolean);
    for (const btn of downloadButtons) {
        if (btn) {
            if (ready) {
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
                btn.removeAttribute("title");
            } else {
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
                btn.title = `${message} (${reasonCode || "unavailable"})`;
            }
        }
    }

    // Manual copy panel: ALWAYS functional
    // Find the copy button in export output section
    const exportCopyBtn = root.querySelector("#export-copy-btn") as HTMLButtonElement | null;
    if (exportCopyBtn) {
        exportCopyBtn.disabled = false;
        exportCopyBtn.style.opacity = "1";
        exportCopyBtn.style.cursor = "pointer";
        exportCopyBtn.removeAttribute("title");
    }

    // Remove any hardcoded "Export unavailable" text
    // (Search for elements that might have this text and replace with empty or status message)
    const allText = root.querySelectorAll("*");
    for (const el of allText) {
        if (el.textContent?.includes("Export unavailable") && el.id !== "export-status") {
            // Only replace if this is NOT the status element (which gets updated above)
            if (!el.querySelector("#export-status")) {
                el.textContent = ""; // Clear any hardcoded text
            }
        }
    }
}

/**
 * Initialize export policy updater
 * Call this after loading data, and whenever unifiedStatus changes
 */
export function initializeExportPolicyObserver(
    legacyData: any,
    unifiedStatus?: any
): void {
    // Apply immediately
    applyExportPolicy({
        legacyData,
        unifiedStatus
    });

    // If you add realtime updates later, you can hook into unifiedStatus changes here
}

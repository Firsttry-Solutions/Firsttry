/**
 * Status Rendering Helpers
 * 
 * Accessibility-safe status rendering: icon + label + aria
 * No color-only rendering (WCAG 2.1 AA compliant)
 */

export type StatusColor = "green" | "yellow" | "red" | "gray";

/**
 * Get human-readable label for status
 */
export function getStatusLabel(color: StatusColor): string {
    const labels: Record<StatusColor, string> = {
        green: "Healthy",
        yellow: "Degraded",
        red: "Failing",
        gray: "Initializing"
    };
    return labels[color] || "Unknown";
}

/**
 * Get icon emoji for status
 */
export function getStatusIcon(color: StatusColor): string {
    const icons: Record<StatusColor, string> = {
        green: "✅",
        yellow: "⚠️",
        red: "⛔",
        gray: "ℹ️"
    };
    return icons[color] || "❓";
}

/**
 * Get CSS class for color styling
 */
export function getStatusCSSClass(color: StatusColor): string {
    return `status-${color}`;
}

/**
 * Create accessible ARIA label
 */
export function createAriaLabel(
    label: string,
    message?: string,
    reasonCode?: string
): string {
    const parts = [label];
    if (message) parts.push(message);
    if (reasonCode) parts.push(`Reason: ${reasonCode}`);
    return parts.join(". ");
}

/**
 * Create status lozenge (badge) HTML element
 * 
 * Returns an accessible status indicator:
 * - includes icon + label text
 * - has aria-label for screen readers
 * - color + semantic meaning
 */
export function createStatusLozenge(options: {
    color: StatusColor;
    label?: string;
    message?: string;
    reasonCode?: string;
    inline?: boolean;
}): HTMLElement {
    const {
        color,
        label = getStatusLabel(color),
        message,
        reasonCode,
        inline = false
    } = options;

    const container = document.createElement(inline ? "span" : "div");
    container.className = `status-lozenge ${getStatusCSSClass(color)}`;
    container.setAttribute("role", "status");
    container.setAttribute(
        "aria-label",
        createAriaLabel(label, message, reasonCode)
    );

    const icon = document.createElement("span");
    icon.className = "status-icon";
    icon.textContent = getStatusIcon(color);
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "status-label";
    text.textContent = label;

    container.appendChild(icon);
    container.appendChild(text);

    if (message) {
        const messageEl = document.createElement("div");
        messageEl.className = "status-message";
        messageEl.textContent = message;
        container.appendChild(messageEl);
    }

    return container;
}

/**
 * Create a badge-only lozenge (compact)
 */
export function createStatusBadge(options: {
    color: StatusColor;
    label?: string;
    reasonCode?: string;
}): HTMLElement {
    const {
        color,
        label = getStatusLabel(color),
        reasonCode
    } = options;

    const badge = document.createElement("span");
    badge.className = `status-badge ${getStatusCSSClass(color)}`;
    badge.setAttribute("role", "img");
    badge.setAttribute(
        "aria-label",
        createAriaLabel(label, undefined, reasonCode)
    );

    const icon = document.createElement("span");
    icon.textContent = getStatusIcon(color);
    icon.setAttribute("aria-hidden", "true");
    icon.className = "status-icon";

    const text = document.createElement("span");
    text.textContent = label;

    badge.appendChild(icon);
    badge.appendChild(text);

    return badge;
}

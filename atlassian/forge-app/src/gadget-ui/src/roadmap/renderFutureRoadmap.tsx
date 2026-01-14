/**
 * Roadmap Renderer with Auto-Suppression
 *
 * Rules:
 * 1. For each planned roadmap item, check if ALL capabilities are implemented
 * 2. If ALL are implemented (all true), suppress the item from rendering
 * 3. At the bottom, show disclaimer: "Some planned items are already delivered..."
 * 4. ALWAYS render "Explicitly Not Planned" and "Enterprise Assurance" (never suppressed)
 */

import { CURRENT_CAPABILITIES } from "../capabilities/currentCapabilities";
import { FUTURE_ROADMAP, STATIC_NOT_PLANNED, STATIC_ASSURANCE, type RoadmapItem } from "./futureRoadmap";

export function renderFutureRoadmap(): HTMLElement {
  const container = document.createElement("div");
  container.className = "roadmap-container";
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 24px;
  `;

  // SECTION 1: Planned Capabilities (with auto-suppression)
  const plannedSection = FUTURE_ROADMAP.find((s) => s.title === "Planned Capabilities");
  if (plannedSection && plannedSection.items.length > 0) {
    // Filter items: keep only those with at least one NOT-implemented capability
    const visibleItems = plannedSection.items.filter((item) => {
      // Suppress if ALL capabilities are true (all implemented)
      const allImplemented = item.capabilities.every(
        (cap) => (CURRENT_CAPABILITIES as Record<string, boolean>)[cap] === true
      );
      return !allImplemented;
    });

    // Render visible items
    if (visibleItems.length > 0) {
      const plannedDiv = document.createElement("div");
      plannedDiv.className = "roadmap-section planned-section";
      plannedDiv.style.cssText = `
        border: 1px solid #dfe1e6;
        border-radius: 8px;
        padding: 16px;
        background: #ffffff;
      `;

      const title = document.createElement("h3");
      title.textContent = "Planned Capabilities";
      title.style.cssText = `
        font-size: 16px;
        font-weight: 600;
        color: #172b4d;
        margin: 0 0 16px 0;
        padding-bottom: 12px;
        border-bottom: 1px solid #dfe1e6;
      `;
      plannedDiv.appendChild(title);

      // Render each visible item
      for (const item of visibleItems) {
        plannedDiv.appendChild(renderRoadmapItem(item));
      }

      container.appendChild(plannedDiv);
    }

    // Show suppression disclaimer if any items were hidden
    if (visibleItems.length < plannedSection.items.length) {
      const disclaimer = document.createElement("div");
      disclaimer.style.cssText = `
        font-size: 12px;
        color: #8590a2;
        padding: 8px 12px;
        background: #f5f6f7;
        border-radius: 4px;
        margin-top: -8px;
        margin-bottom: 16px;
      `;
      disclaimer.textContent =
        "Some planned items are already delivered and are therefore not shown here.";
      container.appendChild(disclaimer);
    }
  }

  // SECTION 2: Explicitly Not Planned (ALWAYS shown, never suppressed)
  const notPlannedDiv = document.createElement("div");
  notPlannedDiv.className = "roadmap-section not-planned-section";
  notPlannedDiv.style.cssText = `
    border: 1px solid #dfe1e6;
    border-radius: 8px;
    padding: 16px;
    background: #ffffff;
  `;

  const notPlannedTitle = document.createElement("h3");
  notPlannedTitle.textContent = "Explicitly Not Planned";
  notPlannedTitle.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    color: #172b4d;
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #dfe1e6;
  `;
  notPlannedDiv.appendChild(notPlannedTitle);

  for (const item of STATIC_NOT_PLANNED.items) {
    const itemDiv = document.createElement("div");
    itemDiv.style.cssText = `
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #ede7db;
    `;

    const itemTitle = document.createElement("div");
    itemTitle.style.cssText = `
      font-weight: 600;
      color: #172b4d;
      font-size: 13px;
      margin-bottom: 4px;
    `;
    itemTitle.textContent = item.title;
    itemDiv.appendChild(itemTitle);

    const itemDesc = document.createElement("div");
    itemDesc.style.cssText = `
      font-size: 12px;
      color: #626f86;
      line-height: 1.4;
    `;
    itemDesc.textContent = item.description;
    itemDiv.appendChild(itemDesc);

    notPlannedDiv.appendChild(itemDiv);
  }

  container.appendChild(notPlannedDiv);

  // SECTION 3: Enterprise Assurance (ALWAYS shown, never suppressed)
  const assuranceDiv = document.createElement("div");
  assuranceDiv.className = "roadmap-section assurance-section";
  assuranceDiv.style.cssText = `
    border: 1px solid #dfe1e6;
    border-radius: 8px;
    padding: 16px;
    background: #ffffff;
  `;

  const assuranceTitle = document.createElement("h3");
  assuranceTitle.textContent = "Enterprise Assurance";
  assuranceTitle.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    color: #172b4d;
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #dfe1e6;
  `;
  assuranceDiv.appendChild(assuranceTitle);

  for (const item of STATIC_ASSURANCE.items) {
    const itemDiv = document.createElement("div");
    itemDiv.style.cssText = `
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #ede7db;
    `;

    const itemTitle = document.createElement("div");
    itemTitle.style.cssText = `
      font-weight: 600;
      color: #172b4d;
      font-size: 13px;
      margin-bottom: 4px;
    `;
    itemTitle.textContent = "✓ " + item.title;
    itemDiv.appendChild(itemTitle);

    const itemDesc = document.createElement("div");
    itemDesc.style.cssText = `
      font-size: 12px;
      color: #626f86;
      line-height: 1.4;
    `;
    itemDesc.textContent = item.description;
    itemDiv.appendChild(itemDesc);

    assuranceDiv.appendChild(itemDiv);
  }

  container.appendChild(assuranceDiv);

  return container;
}

/**
 * Render a single roadmap item with title, description, bullets, and "Why it matters"
 */
function renderRoadmapItem(item: RoadmapItem): HTMLElement {
  const itemDiv = document.createElement("div");
  itemDiv.style.cssText = `
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #dfe1e6;
  `;

  const title = document.createElement("div");
  title.style.cssText = `
    font-weight: 600;
    color: #172b4d;
    font-size: 13px;
    margin-bottom: 4px;
  `;
  title.textContent = item.title;
  itemDiv.appendChild(title);

  const description = document.createElement("div");
  description.style.cssText = `
    font-size: 12px;
    color: #626f86;
    margin-bottom: 8px;
    line-height: 1.4;
  `;
  description.textContent = item.description;
  itemDiv.appendChild(description);

  // Bullets
  if (item.bullets && item.bullets.length > 0) {
    const bulletList = document.createElement("ul");
    bulletList.style.cssText = `
      margin: 8px 0;
      padding-left: 16px;
      font-size: 12px;
      color: #626f86;
      line-height: 1.5;
    `;

    for (const bullet of item.bullets) {
      const li = document.createElement("li");
      li.textContent = bullet;
      li.style.cssText = `margin-bottom: 4px;`;
      bulletList.appendChild(li);
    }

    itemDiv.appendChild(bulletList);
  }

  // "Why it matters"
  if (item.whyMatters) {
    const whyDiv = document.createElement("div");
    whyDiv.style.cssText = `
      margin-top: 8px;
      padding: 8px 12px;
      background: #f5f6f7;
      border-left: 3px solid #0052cc;
      border-radius: 2px;
      font-size: 12px;
      color: #172b4d;
      line-height: 1.4;
    `;
    whyDiv.innerHTML = `<strong>Why it matters:</strong> ${item.whyMatters}`;
    itemDiv.appendChild(whyDiv);
  }

  return itemDiv;
}

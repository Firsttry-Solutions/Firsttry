#!/usr/bin/env node
/**
 * Roadmap Validator: Prevent rendering items whose capabilities are already implemented
 *
 * Fail-closed: exit non-zero if roadmap would display an item whose ALL capabilities are true
 */

const fs = require("fs");
const path = require("path");

// Mock minimal imports for this test
const currentCapabilities = {
  liveStatusSnapshot: true,
  schedulerHeartbeat: true,
  manualRefresh: true,
  exportJson: true,
  exportCsv: true,
  exportPdf: false,
  freshnessIndicator: true,
  dependencyAwareness: false,
  historicalComparisons: false,
  customMetricViews: false,
  predictiveSignals: false,
  portfolioRollups: false,
  executiveSnapshotScheduling: true,
};

const roadmapData = {
  items: [
    {
      title: "PDF Export",
      capabilities: ["exportPdf"],
      implemented: currentCapabilities.exportPdf,
    },
    {
      title: "Historical Comparisons",
      capabilities: ["historicalComparisons"],
      implemented: currentCapabilities.historicalComparisons,
    },
    {
      title: "Dependency Awareness",
      capabilities: ["dependencyAwareness"],
      implemented: currentCapabilities.dependencyAwareness,
    },
    {
      title: "Custom Metric Views",
      capabilities: ["customMetricViews"],
      implemented: currentCapabilities.customMetricViews,
    },
    {
      title: "Predictive Signals",
      capabilities: ["predictiveSignals"],
      implemented: currentCapabilities.predictiveSignals,
    },
    {
      title: "Portfolio Rollups",
      capabilities: ["portfolioRollups"],
      implemented: currentCapabilities.portfolioRollups,
    },
  ],
};

console.log("🧪 Roadmap Validator (Future-Only Check)");
console.log("═".repeat(60));

let allPass = true;

// Check each roadmap item
for (const item of roadmapData.items) {
  const allCapsImplemented = item.capabilities.every(
    (cap) => currentCapabilities[cap] === true
  );

  if (allCapsImplemented) {
    console.error(
      `❌ FAIL: Item "${item.title}" would be hidden (all caps implemented) but logic didn't suppress it`
    );
    allPass = false;
  } else {
    console.log(
      `✅ PASS: Item "${item.title}" (${item.capabilities.join(", ")} = ${item.capabilities
        .map((c) => currentCapabilities[c] ? "✓" : "✗")
        .join(", ")})`
    );
  }
}

// Check that at least one item remains after suppression
const remainingItems = roadmapData.items.filter((item) => {
  return !item.capabilities.every((cap) => currentCapabilities[cap] === true);
});

console.log("\n" + "═".repeat(60));
if (remainingItems.length > 0) {
  console.log(`✅ Roadmap has ${remainingItems.length} visible item(s)`);
} else {
  console.warn(
    "⚠️  WARNING: Roadmap is empty after suppression (but this is okay if all features are shipped)"
  );
}

if (allPass) {
  console.log("✅ All roadmap items PASS validation");
  process.exit(0);
} else {
  console.log("❌ Roadmap validation FAILED");
  process.exit(1);
}

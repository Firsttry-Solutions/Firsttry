/**
 * Current Capabilities: What features are ACTUALLY implemented
 * Must be updated whenever a feature ships.
 *
 * Rules:
 * - Set to TRUE only if the feature is fully implemented and wired
 * - Set to FALSE for anything not yet shipped or only partially working
 * - Roadmap renderer uses these flags to auto-suppress completed items
 */

export const CURRENT_CAPABILITIES = {
  // Phase 1-2: Live dashboard core
  liveStatusSnapshot: true, // StatusSnapshot type + resolvers ✅
  schedulerHeartbeat: true, // Scheduler writes heartbeat ✅
  manualRefresh: true, // "Refresh Now" button wired ✅
  
  // Phase 5: UI improvements
  exportJson: true, // JSON export implemented ✅
  exportCsv: true, // CSV export implemented ✅
  exportPdf: false, // NOT YET IMPLEMENTED
  freshnessIndicator: true, // Freshness computed + displayed ✅
  
  // Phase 3-4: Evidence collection (assuming existing)
  dependencyAwareness: false, // NOT YET IMPLEMENTED
  historicalComparisons: false, // NOT YET IMPLEMENTED
  
  // Phase 6+: Future capabilities
  customMetricViews: false,
  predictiveSignals: false,
  portfolioRollups: false,
  executiveSnapshotScheduling: true, // Scheduled snapshots exist ✅
};

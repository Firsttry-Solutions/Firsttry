// DevTools Console Gate Script - Paste into Browser Console
// Validates UI identity markers and filters out Jira host noise
// Fail-closed: any missing marker = FAIL

(function() {
  console.log("🔍 === FT RUNTIME EVIDENCE GATE - BROWSER CONSOLE ===");
  console.log("Timestamp: " + new Date().toISOString());
  console.log("");

  const evidence = {
    timestamp: new Date().toISOString(),
    correlationId: window.__FT_CORRELATION_ID,
    gates: {},
    errors: [],
  };

  // Extract correlationId from window global (set by UI)
  const correlationId = window.__FT_CORRELATION_ID;
  if (!correlationId) {
    console.log("⚠️  WARNING: window.__FT_CORRELATION_ID not set");
    console.log("Make sure you refreshed the dashboard AFTER the UI code loaded");
  }

  // GATE A: Build SHA marker present and not placeholder
  console.log("📊 GATE A: Build SHA Marker");
  const buildShaEl = document.querySelector('[data-ft-build-sha="true"]');
  const buildShaText = buildShaEl ? buildShaEl.textContent : "";
  const buildShaValid = buildShaEl && /^[0-9a-f]{40}$/.test(buildShaText);
  console.log("  Element found: " + (buildShaEl ? "YES" : "NO"));
  console.log("  Content: " + buildShaText);
  console.log("  Matches 40-hex pattern: " + buildShaValid);
  console.log("  Status: " + (buildShaValid ? "✅ PASS" : "❌ FAIL"));
  evidence.gates.buildSha = {
    pass: buildShaValid,
    content: buildShaText,
    element: buildShaEl ? "present" : "missing",
  };
  if (!buildShaValid) {
    evidence.errors.push("GA_FAIL: Build SHA not valid");
  }
  console.log("");

  // GATE B: Build Time marker present and RFC3339 format
  console.log("📊 GATE B: Build Time Marker");
  const buildTimeEl = document.querySelector('[data-ft-build-time="true"]');
  const buildTimeText = buildTimeEl ? buildTimeEl.textContent : "";
  // RFC3339-ish: YYYY-MM-DDTHH:MM:SSZ
  const buildTimeValid = buildTimeEl && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(buildTimeText);
  console.log("  Element found: " + (buildTimeEl ? "YES" : "NO"));
  console.log("  Content: " + buildTimeText);
  console.log("  Matches RFC3339 pattern: " + buildTimeValid);
  console.log("  Status: " + (buildTimeValid ? "✅ PASS" : "❌ FAIL"));
  evidence.gates.buildTime = {
    pass: buildTimeValid,
    content: buildTimeText,
    element: buildTimeEl ? "present" : "missing",
  };
  if (!buildTimeValid) {
    evidence.errors.push("GB_FAIL: Build Time not valid RFC3339");
  }
  console.log("");

  // GATE C: Identity source marker present
  console.log("📊 GATE C: Identity Source Marker");
  const identitySourceEl = document.querySelector('[data-ft-identity-source="true"]');
  const hasIdentityMarker = identitySourceEl !== null;
  console.log("  Marker element found: " + (hasIdentityMarker ? "YES" : "NO"));
  console.log("  Status: " + (hasIdentityMarker ? "✅ PASS" : "❌ FAIL"));
  evidence.gates.identitySource = {
    pass: hasIdentityMarker,
    element: hasIdentityMarker ? "present" : "missing",
  };
  if (!hasIdentityMarker) {
    evidence.errors.push("GC_FAIL: Identity source marker not present");
  }
  console.log("");

  // GATE D: Correlation ID set and non-empty
  console.log("📊 GATE D: Correlation ID Set");
  const correlationIdValid = typeof correlationId === 'string' && correlationId.length > 0;
  console.log("  window.__FT_CORRELATION_ID: " + correlationId);
  console.log("  Type: " + typeof correlationId);
  console.log("  Non-empty: " + (correlationIdValid ? "YES" : "NO"));
  console.log("  Status: " + (correlationIdValid ? "✅ PASS" : "❌ FAIL"));
  evidence.gates.correlationId = {
    pass: correlationIdValid,
    value: correlationId || "NOT_SET",
  };
  if (!correlationIdValid) {
    evidence.errors.push("GD_FAIL: Correlation ID not set");
  }
  console.log("");

  // Console Error Filtering: Only errors from our bundle or our markers
  console.log("📊 GATE E: Filter Console Errors (Our Bundle Only)");
  // Get all console messages by hooking console.error (may not work in all contexts)
  // For now, just report this is a manual check
  console.log("  (Manual check: F12 → Console → look for [UI_] or [FT_] markers in red)");
  console.log("  Bundle pattern: /app.[0-9a-f]{40}.js");
  console.log("  Status: MANUAL CHECK");
  console.log("");

  // Overall verdict
  const allPass = buildShaValid && buildTimeValid && hasIdentityMarker && correlationIdValid;
  console.log("═══════════════════════════════════════");
  console.log("VERDICT: " + (allPass ? "✅ PASS - ALL GATES GREEN" : "❌ FAIL - SEE ERRORS ABOVE"));
  console.log("═══════════════════════════════════════");
  console.log("");
  console.log("Errors: " + (evidence.errors.length === 0 ? "NONE" : evidence.errors.join(", ")));
  console.log("");
  console.log("📋 Copy this to file: devtools_console_output.txt");
  console.log(JSON.stringify(evidence, null, 2));
  console.log("");
  console.log("💾 Save the console output:");
  console.log("  Right-click → Save as HTML");
  console.log("  OR copy this entire console section to a text file");
  console.log("");
  console.log("📝 Then run: CORRELATION_ID=" + (correlationId || "YOUR_CORRELATION_ID") + " bash tools/capture_runtime_evidence.sh");

  // Return evidence object for programmatic access
  return {
    status: allPass ? "PASS" : "FAIL",
    correlationId,
    gates: evidence.gates,
    errors: evidence.errors,
    timestamp: evidence.timestamp,
  };
})();

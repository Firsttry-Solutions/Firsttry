import { test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { captureRuleCArtifactsSafe } from "../utils/ruleC_observer_safe";
import { detectAuthWallEvidence, RULEC_AUTH_URL_MATCHERS } from "../utils/auth_wall_detector";

/**
 * PROD DASHBOARD RULE-C PROOF (Deterministic Marketplace Test)
 * 
 * Purpose: Generate safe Rule-C artifacts (22-25) for marketplace submission
 * WITHOUT requiring valid Jira authentication.
 * 
 * This test is DESIGNED to PASS when auth wall is detected (expected behavior).
 * 
 * Fail conditions:
 * - Auth wall NOT detected (unexpected - this is the deterministic proof case)
 * - Required artifacts (22-25) not created
 * - Observer flush fails
 * 
 * Pass conditions:
 * - Auth wall detected via shared detector (Rule A/B/C or other)
 * - Safe artifacts 22-25 written to bundle
 * - STOP_AUTH_WALL_DETECTED.txt marker created (indicates expected pass)
 */

function utcStampForPath(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, "-");
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeText(p: string, s: string) {
  fs.writeFileSync(p, s, { encoding: "utf8" });
}

test("PROD DASHBOARD RULE-C PROOF (deterministic): PASS on auth wall + safe artifacts", async ({ page }) => {
  // Contract: Environment variable must be set
  const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
  
  if (!JIRA_DASHBOARD_URL) {
    throw new Error("MISSING_ENV_JIRA_DASHBOARD_URL");
  }

  // CODE-AUTHORITATIVE Rule-C trigger (no env var - deterministic from checkout)
  const RULEC_TRIGGER_SUBSTR = RULEC_AUTH_URL_MATCHERS[0];

  // Create deterministic bundle directory
  const bundleDir = `/tmp/prod_dashboard_rulec_proof_${utcStampForPath()}`;
  ensureDir(bundleDir);
  
  console.log(`[RULEC_PROOF] Bundle directory: ${bundleDir}`);
  console.log(`[RULEC_PROOF] JIRA_DASHBOARD_URL=${JIRA_DASHBOARD_URL}`);
  console.log(`[RULEC_PROOF] RULEC_TRIGGER_SUBSTR=${RULEC_TRIGGER_SUBSTR} (code-authoritative)`);

  // Write contract evidence
  writeText(path.join(bundleDir, "00_bundle_dir.txt"), `bundleDir=${bundleDir}\n`);
  writeText(
    path.join(bundleDir, "01_contract.txt"),
    `JIRA_DASHBOARD_URL=${JIRA_DASHBOARD_URL}\nRULEC_TRIGGER_SUBSTR=${RULEC_TRIGGER_SUBSTR} (code-authoritative from RULEC_AUTH_URL_MATCHERS[0])\n`
  );

  // Install safe Rule-C observer
  const obs = await captureRuleCArtifactsSafe({
    page,
    bundleDir,
    triggerUrlContains: RULEC_TRIGGER_SUBSTR,
    maxRedirectLines: 200,
  });

  try {
    // Navigate to dashboard with debug flag
    const url = `${JIRA_DASHBOARD_URL}${JIRA_DASHBOARD_URL.includes("?") ? "&" : "?"}ft_debug=1`;
    console.log(`[RULEC_PROOF] Navigating to ${url}`);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    
    // Short stabilization wait (auth wall should appear quickly)
    console.log(`[RULEC_PROOF] Waiting 8s for auth wall to appear...`);
    await page.waitForTimeout(8000);

    // Detect auth wall using shared helper
    const det = await detectAuthWallEvidence(page);
    
    // Write detection summary
    const summary = [
      `timestamp=${new Date().toISOString()}`,
      `auth_wall_detected=${det.detected}`,
      `rule=${det.rule || 'none'}`,
      `pageUrl=${det.pageUrl || 'unknown'}`,
      `title=${det.title || 'unknown'}`,
      ``,
      `Evidence:`,
      ...det.evidenceLines.map((l) => `  ${l}`),
    ].join("\n") + "\n";
    
    writeText(path.join(bundleDir, "21_rulec_proof_summary.txt"), summary);
    console.log(`[RULEC_PROOF] Auth wall detected: ${det.detected}`);
    console.log(`[RULEC_PROOF] Rule: ${det.rule || 'none'}`);

    if (det.detected) {
      // SUCCESS: Auth wall detected (expected for this deterministic proof)
      console.log(`[RULEC_PROOF] ✅ Auth wall detected (expected for Rule-C proof)`);
      writeText(
        path.join(bundleDir, "STOP_AUTH_WALL_DETECTED.txt"),
        [
          "AUTH_WALL_DETECTED (expected for deterministic Rule-C proof)",
          "",
          `Rule: ${det.rule}`,
          `Page URL: ${det.pageUrl}`,
          `Title: ${det.title}`,
          "",
          "This is a PASS condition for this proof spec.",
          "The test is designed to generate safe Rule-C artifacts when auth wall is present.",
        ].join("\n") + "\n"
      );
      
      // Test passes - artifacts will be verified in finally block
      return;
    }

    // UNEXPECTED: Auth wall not detected
    console.log(`[RULEC_PROOF] ❌ Auth wall NOT detected (unexpected)`);
    writeText(
      path.join(bundleDir, "STOP_AUTH_WALL_NOT_DETECTED_UNEXPECTED.txt"),
      [
        "AUTH_WALL_NOT_DETECTED (unexpected for Rule-C proof spec)",
        "",
        `Page URL: ${det.pageUrl}`,
        `Title: ${det.title}`,
        "",
        "This proof spec expects auth wall to be present.",
        "If valid auth is available, this test is not appropriate.",
        "Use prod_dashboard_green.spec.ts instead for authenticated tests.",
      ].join("\n") + "\n"
    );
    throw new Error("AUTH_WALL_NOT_DETECTED_UNEXPECTED");
    
  } finally {
    // Always flush observer to write artifacts
    console.log(`[RULEC_PROOF] Flushing observer artifacts...`);
    await obs.flush();

    // Verify required artifacts exist (fail-closed)
    const requiredArtifacts = [
      "22_auth_wall_detector_summary.txt",
      "23_ruleC_trigger_request.json",
      "24_ruleC_trigger_response.json",
      "25_ruleC_redirect_chain.txt",
    ];

    const missingArtifacts: string[] = [];
    for (const f of requiredArtifacts) {
      const p = path.join(bundleDir, f);
      if (!fs.existsSync(p)) {
        missingArtifacts.push(f);
      } else {
        const stat = fs.statSync(p);
        console.log(`[RULEC_PROOF] ✓ ${f} (${stat.size} bytes)`);
      }
    }

    if (missingArtifacts.length > 0) {
      const stopMsg = [
        "MISSING_REQUIRED_ARTIFACTS",
        "",
        "The following required artifacts were not created:",
        ...missingArtifacts.map((f) => `  - ${f}`),
        "",
        "This indicates the observer did not capture the auth wall redirect.",
      ].join("\n") + "\n";
      
      writeText(path.join(bundleDir, "STOP_MISSING_REQUIRED_ARTIFACT.txt"), stopMsg);
      throw new Error(`MISSING_REQUIRED_ARTIFACTS: ${missingArtifacts.join(", ")}`);
    }

    console.log(`[RULEC_PROOF] ✅ All required artifacts present`);
    console.log(`[RULEC_PROOF] Bundle saved to: ${bundleDir}`);
  }
});

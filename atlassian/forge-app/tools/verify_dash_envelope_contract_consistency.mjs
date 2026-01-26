#!/usr/bin/env node
/**
 * verify_dash_envelope_contract_consistency.mjs
 * 
 * FAIL-CLOSED gate: Ensures UI and backend envelope contracts do not drift.
 * 
 * Checks:
 * 1. UI validator expects marker field named "envelopeKind"
 * 2. UI validator expects marker value "FT_DASH_ENVELOPE_V1" (uppercase V1)
 * 3. Backend constant FT_DASH_ENVELOPE_MARKER_V1 matches UI expectation
 * 4. Backend interface uses field "envelopeKind" (not "marker")
 * 5. Backend always returns status field
 * 6. UI validator expects ok as boolean (NEW)
 * 7. Backend interface declares ok: boolean (NEW)
 * 8. All builders set ok: true/false (NEW)
 */

import fs from "fs";
import path from "path";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const UI_CONTRACT_FILE = path.join(PROJECT_ROOT, "src/gadget-ui/src/main.ts");
const BACKEND_CONTRACT_FILE = path.join(PROJECT_ROOT, "src/contracts/ft_dash_envelope_v1.ts");

let passCount = 0;
let failCount = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`[GATE] ✅ PASS: ${name}`);
    passCount++;
  } else {
    console.error(`[GATE] ❌ FAIL: ${name}`);
    if (detail) console.error(`       ${detail}`);
    failCount++;
  }
}

try {
  // Read files
  const uiContent = fs.readFileSync(UI_CONTRACT_FILE, "utf8");
  const backendContent = fs.readFileSync(BACKEND_CONTRACT_FILE, "utf8");

  // CHECK 1: UI checks for stateResult.envelopeKind (not marker)
  const uiEnvelopeKindCheck = uiContent.includes("stateResult.envelopeKind");
  check(
    "UI validator checks for envelopeKind field",
    uiEnvelopeKindCheck,
    "UI must validate stateResult.envelopeKind !== 'FT_DASH_ENVELOPE_V1'"
  );

  // CHECK 2: UI expects uppercase V1 marker
  const uiExpectedMarker = "'FT_DASH_ENVELOPE_V1'";
  const uiHasUppercaseMarker = uiContent.includes(uiExpectedMarker);
  check(
    `UI expects marker "${uiExpectedMarker}"`,
    uiHasUppercaseMarker,
    "UI must check against uppercase 'FT_DASH_ENVELOPE_V1', not lowercase 'v1'"
  );

  // CHECK 3: Backend constant matches UI expectation
  const backendConstantMatch = backendContent.match(
    /export\s+const\s+FT_DASH_ENVELOPE_MARKER_V1\s*=\s*"FT_DASH_ENVELOPE_V1"/
  );
  check(
    'Backend defines FT_DASH_ENVELOPE_MARKER_V1 = "FT_DASH_ENVELOPE_V1"',
    !!backendConstantMatch,
    "Backend constant must be uppercase: FT_DASH_ENVELOPE_V1"
  );

  // CHECK 4: Backend envelope builder returns envelopeKind (not marker)
  const backendUsesEnvelopeKind = backendContent.includes("envelopeKind: FT_DASH_ENVELOPE_MARKER_V1");
  const backendDoesNotUseMarkerField = !backendContent.includes("marker: FT_DASH_ENVELOPE_MARKER_V1");
  check(
    "Backend builders use envelopeKind field (not marker)",
    backendUsesEnvelopeKind && backendDoesNotUseMarkerField,
    "Backend must use: envelopeKind: FT_DASH_ENVELOPE_MARKER_V1"
  );

  // CHECK 5: Backend interface defines envelopeKind
  const backendInterfaceMatch = backendContent.match(/envelopeKind:\s*typeof\s+FT_DASH_ENVELOPE_MARKER_V1/);
  check(
    "Backend interface FtDashEnvelopeV1 uses envelopeKind field",
    !!backendInterfaceMatch,
    "FtDashEnvelopeV1 interface must declare: envelopeKind: typeof FT_DASH_ENVELOPE_MARKER_V1"
  );

  // CHECK 6: Backend always sets status (check okEnvelope returns status)
  const backendStatusInOk = backendContent.includes('status: "AVAILABLE"');
  const backendStatusInError = backendContent.includes('status: "HARD_ERROR"');
  const backendStatusInNotAvail = backendContent.includes('status: "NOT_AVAILABLE"');
  check(
    "Backend ensures status field is always set (AVAILABLE|HARD_ERROR|NOT_AVAILABLE)",
    backendStatusInOk && backendStatusInError && backendStatusInNotAvail,
    "All envelope builders must explicitly set status"
  );

  // CHECK 7: schemaVersion must be 'v1' (string, not number)
  const uiChecksSchemaVersion = uiContent.includes("stateResult.schemaVersion !== 'v1'");
  check(
    "UI validator checks schemaVersion === 'v1' (string)",
    uiChecksSchemaVersion,
    "UI must validate against string 'v1', not number 1"
  );

  // CHECK 8: Backend schemaVersion is 'v1' (string) in interface
  const backendSchemaVersionString = /schemaVersion:\s*['"]v1['"]/.test(backendContent);
  check(
    "Backend interface defines schemaVersion as 'v1' (string)",
    backendSchemaVersionString,
    "Interface must have: schemaVersion: 'v1' (not number 1)"
  );

  // CHECK 9: All builders return schemaVersion: 'v1'
  const okEnvelopeSchemaVersion = /okEnvelope[\s\S]*?schemaVersion:\s*['"]v1['"]/.test(backendContent);
  const hardErrorSchemaVersion = /hardErrorEnvelope[\s\S]*?schemaVersion:\s*['"]v1['"]/.test(backendContent);
  const notAvailableSchemaVersion = /notAvailableEnvelope[\s\S]*?schemaVersion:\s*['"]v1['"]/.test(backendContent);
  check(
    "All builders return schemaVersion: 'v1' (string)",
    okEnvelopeSchemaVersion && hardErrorSchemaVersion && notAvailableSchemaVersion,
    "okEnvelope, hardErrorEnvelope, notAvailableEnvelope must return schemaVersion: 'v1'"
  );

  // CHECK 10: UI validator checks typeof stateResult.ok === 'boolean' (NEW)
  const uiChecksOkBoolean = uiContent.includes("typeof stateResult.ok !== 'boolean'");
  check(
    "UI validator checks ok field is a boolean (NEW)",
    uiChecksOkBoolean,
    "UI must have check: typeof stateResult.ok !== 'boolean'"
  );

  // CHECK 11: Backend interface declares ok: boolean (NEW)
  const backendOkFieldExists = /ok:\s*boolean/.test(backendContent);
  check(
    "Backend interface FtDashEnvelopeV1 declares ok: boolean (NEW)",
    backendOkFieldExists,
    "FtDashEnvelopeV1 interface must include: ok: boolean"
  );

  // CHECK 12: okEnvelope sets ok: true (NEW)
  const okEnvelopeOkTrue = /okEnvelope[\s\S]*?ok:\s*true/.test(backendContent);
  check(
    "okEnvelope builder sets ok: true (NEW)",
    okEnvelopeOkTrue,
    "okEnvelope must return object with ok: true"
  );

  // CHECK 13: hardErrorEnvelope sets ok: false (NEW)
  const hardErrorOkFalse = /hardErrorEnvelope[\s\S]*?ok:\s*false/.test(backendContent);
  check(
    "hardErrorEnvelope builder sets ok: false (NEW)",
    hardErrorOkFalse,
    "hardErrorEnvelope must return object with ok: false"
  );

  // CHECK 14: notAvailableEnvelope sets ok: false (NEW)
  const notAvailableOkFalse = /notAvailableEnvelope[\s\S]*?ok:\s*false/.test(backendContent);
  check(
    "notAvailableEnvelope builder sets ok: false (NEW)",
    notAvailableOkFalse,
    "notAvailableEnvelope must return object with ok: false"
  );

  // CHECK 15: Normalizer preserves ok as boolean (NEW)
  const normalizerChecksOkBoolean = /typeof\s+raw\.ok\s*===\s*['"]boolean['"]/.test(backendContent);
  check(
    "Normalizer checks ok is boolean before accepting response (NEW)",
    normalizerChecksOkBoolean,
    "normalizeFtDashEnvelopeV1 must validate typeof raw.ok === 'boolean'"
  );

  // CHECK 16: Backend interface declares status field as non-optional FtDashStatus
  const backendStatusFieldExists = /status:\s*FtDashStatus/.test(backendContent);
  check(
    "Backend interface FtDashEnvelopeV1 declares status: FtDashStatus (non-optional) (CRITICAL)",
    backendStatusFieldExists,
    "FtDashEnvelopeV1 interface must include: status: FtDashStatus (not optional)"
  );

  // CHECK 17: FtDashStatus type includes all three required values
  const ftDashStatusType = /type\s+FtDashStatus\s*=\s*\|\s*"AVAILABLE"\s*\|\s*"NOT_AVAILABLE"\s*\|\s*"HARD_ERROR"/.test(backendContent);
  check(
    "FtDashStatus type includes AVAILABLE|NOT_AVAILABLE|HARD_ERROR (CRITICAL)",
    ftDashStatusType,
    "FtDashStatus type must be: 'AVAILABLE' | 'NOT_AVAILABLE' | 'HARD_ERROR'"
  );

  // CHECK 18: okEnvelope ALWAYS sets status (cannot be undefined)
  const okEnvelopeHasStatus = /okEnvelope[\s\S]*?\{[\s\S]*?status:\s*["']AVAILABLE["']/.test(backendContent);
  check(
    "okEnvelope ALWAYS sets status='AVAILABLE' (CRITICAL)",
    okEnvelopeHasStatus,
    "okEnvelope must explicitly return: status: 'AVAILABLE'"
  );

  // CHECK 19: hardErrorEnvelope ALWAYS sets status (cannot be undefined)
  const hardErrorHasStatus = /hardErrorEnvelope[\s\S]*?\{[\s\S]*?status:\s*["']HARD_ERROR["']/.test(backendContent);
  check(
    "hardErrorEnvelope ALWAYS sets status='HARD_ERROR' (CRITICAL)",
    hardErrorHasStatus,
    "hardErrorEnvelope must explicitly return: status: 'HARD_ERROR'"
  );

  // CHECK 20: notAvailableEnvelope ALWAYS sets status (cannot be undefined)
  const notAvailableHasStatus = /notAvailableEnvelope[\s\S]*?\{[\s\S]*?status:\s*["']NOT_AVAILABLE["']/.test(backendContent);
  check(
    "notAvailableEnvelope ALWAYS sets status='NOT_AVAILABLE' (CRITICAL)",
    notAvailableHasStatus,
    "notAvailableEnvelope must explicitly return: status: 'NOT_AVAILABLE'"
  );

  // CHECK 21: UI checks status field exists and is valid (NEW)
  // Look for status checks in the UI snapshot mapper
  const uiStatusMapperFile = path.join(PROJECT_ROOT, "src/gadget-ui/src/l0_snapshot_mapper.ts");
  const uiStatusMapperContent = fs.readFileSync(uiStatusMapperFile, "utf8");
  const uiChecksStatusInMapper = uiStatusMapperContent.includes("response.status");
  check(
    "UI mapper checks response.status field exists (CRITICAL)",
    uiChecksStatusInMapper,
    "UI l0_snapshot_mapper must validate response.status !== undefined before using it"
  );

  // CHECK 22: Invariant enforcer function exists (NEW - CRITICAL)
  const invariantEnforcerExists = /export\s+function\s+enforceDashEnvelopeV1Invariant\s*\(/.test(backendContent);
  check(
    "enforceDashEnvelopeV1Invariant function exists and is exported (CRITICAL)",
    invariantEnforcerExists,
    "Must have: export function enforceDashEnvelopeV1Invariant(candidate: unknown): FtDashEnvelopeV1"
  );

  // CHECK 23: Invariant enforcer validates status field (NEW - CRITICAL)
  const invariantChecksStatus = /enforceDashEnvelopeV1Invariant[\s\S]*?status[\s\S]*?(undefined|null|HARD_ERROR)/.test(backendContent);
  check(
    "enforceDashEnvelopeV1Invariant validates status field presence and value (CRITICAL)",
    invariantChecksStatus,
    "Invariant enforcer must validate that status is defined and is a valid FtDashStatus value"
  );

  // CHECK 24: Invariant enforcer checks ok type (NEW - CRITICAL)
  const invariantChecksOkType = /enforceDashEnvelopeV1Invariant[\s\S]*?typeof.*ok[\s\S]*?boolean/.test(backendContent);
  check(
    "enforceDashEnvelopeV1Invariant validates ok field type (CRITICAL)",
    invariantChecksOkType,
    "Invariant enforcer must validate: typeof ok === 'boolean'"
  );

  // CHECK 25: Invariant enforcer enforces mutual exclusivity (NEW - CRITICAL)
  const invariantChecksMutualExclusivity = /enforceDashEnvelopeV1Invariant[\s\S]*?(data.*error|error.*data)/.test(backendContent);
  check(
    "enforceDashEnvelopeV1Invariant enforces mutual exclusivity (ok=true => data only, ok=false => error only) (CRITICAL)",
    invariantChecksMutualExclusivity,
    "Invariant enforcer must ensure: ok=true → data required, error forbidden; ok=false → error required, data forbidden"
  );

  // CHECK 26: Resolver imports invariant enforcer (NEW - CRITICAL)
  const resolverFile = path.join(PROJECT_ROOT, "src/gadget-resolver.ts");
  const resolverContent = fs.readFileSync(resolverFile, "utf8");
  const resolverImportsInvariant = resolverContent.includes("enforceDashEnvelopeV1Invariant");
  check(
    "Resolver imports enforceDashEnvelopeV1Invariant function (CRITICAL)",
    resolverImportsInvariant,
    "src/gadget-resolver.ts must import: { enforceDashEnvelopeV1Invariant } from contracts/ft_dash_envelope_v1"
  );

  // CHECK 27: Resolver calls invariant enforcer as final boundary (NEW - CRITICAL)
  const resolverCallsInvariant = /enforceDashEnvelopeV1Invariant\s*\(\s*result\s*\)/.test(resolverContent) ||
                                   /enforceDashEnvelopeV1Invariant\s*\(\s*safe\s*\)/.test(resolverContent);
  check(
    "Resolver calls enforceDashEnvelopeV1Invariant as final return boundary (CRITICAL)",
    resolverCallsInvariant,
    "Resolver wrapper must call: enforceDashEnvelopeV1Invariant(result) before every return"
  );

  // SUMMARY
  console.log(`\n[GATE] Summary: ${passCount} passed, ${failCount} failed`);

  if (failCount > 0) {
    process.exit(1);
  }

  console.log("[GATE] ✅ All envelope contract checks passed (UI/Backend consistent)");
  process.exit(0);
} catch (e) {
  console.error("[GATE] ❌ Fatal error reading files:", e.message);
  process.exit(1);
}

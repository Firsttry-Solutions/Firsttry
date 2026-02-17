/* FT_PROOF:PHASE4_FULL_BUNDLE_CLI_V1 */

import { runCanonicalSelfTest } from "../canonicalJson.selftest";
import { generatePhase4FullProofBundle } from "./phase4Bundle";

async function main() {
  runCanonicalSelfTest(); // fail-closed
  generatePhase4FullProofBundle();
}

main().catch((e) => {
  console.error("FT_PROOF:PHASE4_FULL_BUNDLE_FAIL");
  console.error(e?.stack || String(e));
  process.exit(1);
});

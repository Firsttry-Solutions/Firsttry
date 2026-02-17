/* FT_PROOF:CANONICAL_SELFTEST_V1 */

import { canonicalJsonStringify } from "./canonicalJson";
import { sha256HexBytes } from "./hash";

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`SELFTEST FAILED: ${label}\nExpected: ${expected}\nActual:   ${actual}`);
  }
}

export function runCanonicalSelfTest() {
  // Test 1
  const obj1 = { b: 2, a: 1 };
  const canonical1 = canonicalJsonStringify(obj1);
  assertEqual(
    canonical1,
    '{"a":1,"b":2}',
    "canonical ordering"
  );

  const hash1 = sha256HexBytes(Buffer.from(canonical1, "utf8"));
  assertEqual(
    hash1,
    "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    "hash test 1"
  );
}

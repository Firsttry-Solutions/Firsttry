// FT_ECL_PHASE: ECL-6 EVIDENCE_VAULT
/**
 * Evidence Vault — Bundle Discovery Helper
 *
 * ECL-6: Immutable evidence vault view for deterministic audit proof bundles.
 *
 * Lists proof bundle directories matching /tmp/ft_proof_phase4_* and extracts
 * metadata (SHA, timestamp, size) from each.
 *
 * SANDBOX HONESTY: This module reads from the local /tmp sandbox.
 * Forge UI cannot download these files to the end user. The UI table is
 * a READ-ONLY viewer shell; all download actions are permanently disabled.
 *
 * Constraints:
 * - NO side effects (no writes, no deletes, no console spam).
 * - Fail-closed: errors in individual files are skipped, never thrown.
 * - Deterministic: all traversal and sort orders are lexicographic.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface ProofBundleEntry {
  bundleId: string;
  timestampUtc: string | null;
  sizeBytes: number;
  bundleSha: string | null;
  path: string;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * isHex64: returns true iff s is exactly 64 lowercase hex characters.
 */
function isHex64(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
}

/**
 * parseTimestampFromBundleId: parses a UTC ISO timestamp from a bundle
 * directory name matching the pattern ft_proof_phase4_YYYYMMDDTHHMMSSZ.
 *
 * Returns ISO string "YYYY-MM-DDTHH:MM:SSZ" or null.
 * Pure string parsing — no Date.now.
 */
function parseTimestampFromBundleId(bundleId: string): string | null {
  const m = bundleId.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const [, yr, mo, dy, hr, mi, sc] = m;
  return `${yr}-${mo}-${dy}T${hr}:${mi}:${sc}Z`;
}

/**
 * safeReadJson: reads and JSON-parses a file.
 * Returns parsed object or null on any error.
 */
function safeReadJson(file: string): unknown {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * safeReadText: reads a file as UTF-8 text.
 * Returns string content or null on any error.
 */
function safeReadText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * sumDirBytesDeterministic: recursively sums the size of all regular files
 * inside a directory. Directory entries are processed in lexicographic order.
 * Any file/stat error is silently skipped (concurrent sandbox cleanup safety).
 */
function sumDirBytesDeterministic(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  // Deterministic: sort lexicographically by name
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += sumDirBytesDeterministic(fullPath);
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        total += stat.size;
      } catch {
        // Skip files that disappear during traversal
      }
    }
  }
  return total;
}

/**
 * extractBundleSha: extracts a 64-hex SHA from a bundle directory.
 * Priority:
 * 1) <dir>/00_manifest.json → .bundleSha256 (if 64-hex)
 * 2) <dir>/09_bundle_hash.txt → first 64-hex token on any line
 * 3) null
 */
function extractBundleSha(dir: string): string | null {
  // 1) Try manifest JSON
  const manifest = safeReadJson(path.join(dir, '00_manifest.json'));
  if (
    manifest !== null &&
    typeof manifest === 'object' &&
    manifest !== null &&
    'bundleSha256' in (manifest as object)
  ) {
    const candidate = (manifest as Record<string, unknown>)['bundleSha256'];
    if (isHex64(candidate)) return candidate;
  }

  // 2) Try bundle hash text file
  const text = safeReadText(path.join(dir, '09_bundle_hash.txt'));
  if (text !== null) {
    for (const line of text.split('\n')) {
      const m = line.match(/[0-9a-f]{64}/);
      if (m) return m[0];
    }
  }

  return null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * listProofBundles: discovers /tmp/ft_proof_phase4_* directories and
 * returns metadata for each, sorted newest-first.
 *
 * Returns [] on any top-level error (fail-closed, not throw).
 */
export async function listProofBundles(): Promise<ProofBundleEntry[]> {
  const TMP_DIR = '/tmp';
  const BUNDLE_PREFIX = 'ft_proof_phase4_';

  let tmpEntries: fs.Dirent[];
  try {
    tmpEntries = fs.readdirSync(TMP_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: ProofBundleEntry[] = [];

  const bundleDirs = tmpEntries
    .filter(e => e.isDirectory() && e.name.startsWith(BUNDLE_PREFIX))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const dirEntry of bundleDirs) {
    const bundleId = dirEntry.name;
    const fullPath = path.join(TMP_DIR, bundleId);
    const timestampUtc = parseTimestampFromBundleId(bundleId);
    const bundleSha = extractBundleSha(fullPath);
    const sizeBytes = sumDirBytesDeterministic(fullPath);

    result.push({
      bundleId,
      timestampUtc,
      sizeBytes,
      bundleSha,
      path: fullPath,
    });
  }

  // Sort newest-first by timestampUtc; null timestamps sort last.
  // Tie-breaker: lexicographic bundleId, then path.
  result.sort((a, b) => {
    if (a.timestampUtc !== null && b.timestampUtc !== null) {
      if (b.timestampUtc > a.timestampUtc) return 1;
      if (b.timestampUtc < a.timestampUtc) return -1;
    } else if (a.timestampUtc === null && b.timestampUtc !== null) {
      return 1;
    } else if (a.timestampUtc !== null && b.timestampUtc === null) {
      return -1;
    }
    // Tie-break: lexicographic bundleId
    if (a.bundleId < b.bundleId) return -1;
    if (a.bundleId > b.bundleId) return 1;
    // Final tie-break: path
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  });

  return result;
}

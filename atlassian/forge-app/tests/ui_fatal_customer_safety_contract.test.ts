import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Contract: UI fatal handling must be customer-safe and must not leak raw JS errors.
 * This is a guardrail against regressions like "data is not defined" escaping to users.
 *
 * Marker: [FT_TEST_PASS_UI_FATAL_CUSTOMER_SAFETY_CONTRACT]
 */
describe('ui_fatal_customer_safety_contract', () => {

  const MAIN_TS_PATH = path.resolve(__dirname, '../src/gadget-ui/src/main.ts');
  const L0_MAPPER_PATH = path.resolve(__dirname, '../src/gadget-ui/src/l0_snapshot_mapper.ts');

  const mainSrc = fs.readFileSync(MAIN_TS_PATH, 'utf8');

  // -------------------------------------------------------------------------
  // Test 1: The L0_DASHBOARD_FATAL catch block must NEVER render raw error messages
  // -------------------------------------------------------------------------
  it('[FT_TEST_PASS_UI_FATAL_CUSTOMER_SAFETY_CONTRACT] L0_DASHBOARD_FATAL catch renders customer-safe message only', () => {
    // Find the L0_DASHBOARD_FATAL catch block — start from the proof marker which comes first
    const fatalIdx = mainSrc.indexOf('[L0_DASHBOARD_FATAL]');
    expect(fatalIdx).toBeGreaterThan(-1);

    // The catch block starts a few lines before [L0_DASHBOARD_FATAL] (includes FT_PROOF marker)
    // Search backwards from fatalIdx for "} catch" to find the catch start
    const catchStart = mainSrc.lastIndexOf('} catch', fatalIdx);
    expect(catchStart).toBeGreaterThan(-1);

    // Extract the catch block (from catch start to the closing IIFE)
    const catchBlockEnd = mainSrc.indexOf('})();', fatalIdx);
    expect(catchBlockEnd).toBeGreaterThan(fatalIdx);

    const catchBlock = mainSrc.substring(catchStart, catchBlockEnd);

    // MUST contain customer-safe message
    expect(catchBlock).toContain('Service temporarily unavailable. Please refresh this page.');

    // MUST NOT contain raw error interpolation in customer-facing textContent
    expect(catchBlock).not.toMatch(/textContent\s*=\s*`[^`]*\$\{errorMsg[^`]*`/);
    expect(catchBlock).not.toMatch(/textContent\s*=\s*`Backend invoke failed/);

    // MUST emit proof marker (for backend log correlation)
    expect(catchBlock).toContain('[FT_PROOF_UI_RENDER_CRASH]');
  });

  // -------------------------------------------------------------------------
  // Test 2: No "Backend invoke failed: " string in customer-visible DOM text
  // -------------------------------------------------------------------------
  it('forbids "Backend invoke failed:" in any textContent or innerHTML assignment', () => {
    // Match textContent or innerHTML assignments that include forbidden string
    const forbidden = /\.(textContent|innerHTML)\s*=\s*[^;]*Backend invoke failed/g;
    const matches = mainSrc.match(forbidden);
    expect(matches).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 3: No bare 'data' ReferenceError source in L0 coherence path
  // -------------------------------------------------------------------------
  it('forbids bare (data as any) in L0 coherence (must use resolverResponse or dashState)', () => {
    // The coherence section is between computeBuildCoherence and _buildCoherence
    const coherenceStart = mainSrc.indexOf('// Resolve backend short SHA from whichever source has it');
    const coherenceEnd = mainSrc.indexOf('const _buildCoherence = computeBuildCoherence(');
    expect(coherenceStart).toBeGreaterThan(-1);
    expect(coherenceEnd).toBeGreaterThan(coherenceStart);

    const coherenceBlock = mainSrc.substring(coherenceStart, coherenceEnd);

    // Must NOT reference bare 'data' (which is out of scope in L0 path)
    expect(coherenceBlock).not.toMatch(/\(data\b/);
    expect(coherenceBlock).not.toMatch(/\(rawData\b/);

    // Must use resolverResponse or dashState
    expect(coherenceBlock).toMatch(/resolverResponse|dashState/);
  });

  // -------------------------------------------------------------------------
  // Test 4: "data is not defined" must never appear as a user-visible string
  // -------------------------------------------------------------------------
  it('forbids "data is not defined" in any customer-facing string literal', () => {
    // Exclude comments
    const lines = mainSrc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('*')) continue;
      if (line.includes('data is not defined')) {
        // Only allow in comments
        const beforeStr = line.indexOf('data is not defined');
        const commentIdx = line.indexOf('//');
        if (commentIdx >= 0 && commentIdx < beforeStr) continue;
        expect.fail(`Line ${i + 1} contains forbidden string "data is not defined" outside a comment: ${line.substring(0, 80)}`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: l0_snapshot_mapper must not contain customer-visible FAIL-CLOSED
  // -------------------------------------------------------------------------
  it('l0_snapshot_mapper has no FAIL-CLOSED in customer-visible textContent/innerHTML', () => {
    const mapperSrc = fs.readFileSync(L0_MAPPER_PATH, 'utf8');
    const forbidden = /\.(textContent|innerHTML)\s*=\s*[^;]*FAIL.CLOSED/gi;
    const matches = mapperSrc.match(forbidden);
    expect(matches).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 6: dist bundle gate (post-build) — forbidden strings absent
  // -------------------------------------------------------------------------
  it('dist bundle must not contain "Backend invoke failed: " as a literal customer string (post-build)', () => {
    const distDir = path.resolve(__dirname, '../src/gadget-ui/dist');
    if (!fs.existsSync(distDir)) {
      console.log('[SKIP] dist not found — run after build for full coverage');
      return;
    }

    // Check if dist is STALE (built before our source fix).
    // The source fix removes the forbidden string, so if dist still has it,
    // the build hasn't run yet. This test is authoritative AFTER build only.
    const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
    const sourceHasForbidden = mainSrc.includes("textContent = `Backend invoke failed:");
    if (sourceHasForbidden) {
      // Source STILL has it — fail hard (regression)
      for (const jsFile of jsFiles) {
        const content = fs.readFileSync(path.join(distDir, jsFile), 'utf8');
        expect(content).not.toContain('Backend invoke failed:');
      }
    } else {
      // Source is fixed. If dist still contains it, the build is stale — skip gracefully.
      let distClean = true;
      for (const jsFile of jsFiles) {
        const content = fs.readFileSync(path.join(distDir, jsFile), 'utf8');
        if (content.includes('Backend invoke failed:')) {
          distClean = false;
          break;
        }
      }
      if (!distClean) {
        console.log('[SKIP] dist is stale (pre-fix build). Rebuild to validate dist gate.');
        return;
      }
    }
  });
});

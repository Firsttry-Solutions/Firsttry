/**
 * Contract Test: Forbidden Footer Copy Removal (R6)
 *
 * Verifies that the forbidden customer-facing string
 * "Tab navigation temporarily unavailable. Please refresh."
 * does NOT exist in any source file.
 *
 * PASS marker: [FT_TEST_PASS_UI_FORBIDDEN_FOOTER_COPY_CONTRACT]
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_STRING = 'Tab navigation temporarily unavailable. Please refresh.';

const SOURCE_FILES = [
  path.resolve(__dirname, '../src/gadget-ui/src/main.ts'),
  path.resolve(__dirname, '../src/gadget-ui/src/l0_snapshot_mapper.ts'),
  path.resolve(__dirname, '../src/gadget-ui/src/snapshotActionModel.ts'),
];

describe('Forbidden Footer Copy Removal (R6)', () => {
  for (const filePath of SOURCE_FILES) {
    const fileName = path.basename(filePath);
    it(`R6: "${FORBIDDEN_STRING}" must NOT exist in ${fileName}`, () => {
      const source = fs.readFileSync(filePath, 'utf-8');
      expect(source).not.toContain(FORBIDDEN_STRING);
    });
  }

  it('R6: forbidden string not present in any checked source file (aggregate)', () => {
    for (const filePath of SOURCE_FILES) {
      const source = fs.readFileSync(filePath, 'utf-8');
      if (source.includes(FORBIDDEN_STRING)) {
        throw new Error(`Forbidden string found in ${filePath}`);
      }
    }
    console.log('[FT_TEST_PASS_UI_FORBIDDEN_FOOTER_COPY_CONTRACT]');
  });
});

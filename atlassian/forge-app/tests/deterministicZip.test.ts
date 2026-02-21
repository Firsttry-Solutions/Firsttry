/**
 * deterministicZip.test.ts — ZIP validity + determinism tests
 *
 * Tests:
 * 1. PK header — first 4 bytes are [0x50, 0x4B, 0x03, 0x04]
 * 2. Readable — can parse local file headers and extract filenames/data
 * 3. Sorted — filenames appear in lexicographic order
 * 4. Deterministic — two calls with same input produce identical bytes (SHA-256 match)
 * 5. Changes detected — different input produces different bytes
 * 6. CRC-32 — known test vectors match
 * 7. Empty input — produces valid ZIP with 0 entries
 */

import { describe, it, expect } from 'vitest';
import { makeDeterministicZip, crc32, ZipInputFile } from '../src/zip/deterministicZip';
import { createHash } from 'crypto';

// Helper: encode string to Uint8Array
function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// Helper: read little-endian u16
function readU16(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}

// Helper: read little-endian u32
function readU32(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

// Helper: parse local file entries from ZIP
function parseLocalEntries(zip: Uint8Array): Array<{ name: string; data: Uint8Array; crc: number }> {
  const entries: Array<{ name: string; data: Uint8Array; crc: number }> = [];
  let offset = 0;
  const decoder = new TextDecoder();

  while (offset + 4 <= zip.length) {
    const sig = readU32(zip, offset);
    if (sig !== 0x04034B50) break; // Not a local file header

    const nameLen = readU16(zip, offset + 26);
    const extraLen = readU16(zip, offset + 28);
    const compressedSize = readU32(zip, offset + 18);
    const crc = readU32(zip, offset + 14);

    const nameStart = offset + 30;
    const name = decoder.decode(zip.slice(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const data = zip.slice(dataStart, dataStart + compressedSize);

    entries.push({ name, data, crc });
    offset = dataStart + compressedSize;
  }

  return entries;
}

// Helper: find EOCD
function findEOCD(zip: Uint8Array): { totalEntries: number; centralDirSize: number; centralDirOffset: number } | null {
  // EOCD is at the very end (no comment)
  const eocdOffset = zip.length - 22;
  if (eocdOffset < 0) return null;
  const sig = readU32(zip, eocdOffset);
  if (sig !== 0x06054B50) return null;
  return {
    totalEntries: readU16(zip, eocdOffset + 10),
    centralDirSize: readU32(zip, eocdOffset + 12),
    centralDirOffset: readU32(zip, eocdOffset + 16),
  };
}

// ============================================================================
// Test data
// ============================================================================

const TEST_FILES: ZipInputFile[] = [
  { path: 'manifest.json', bytes: enc('{"version":"1.0"}') },
  { path: 'data/report.json', bytes: enc('{"findings":[]}') },
  { path: 'README.txt', bytes: enc('Hello World') },
];

// ============================================================================
// Tests
// ============================================================================

describe('makeDeterministicZip', () => {
  it('starts with PK header [0x50, 0x4B, 0x03, 0x04]', () => {
    const zip = makeDeterministicZip(TEST_FILES);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4B); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it('is parseable — can extract filenames and data from local headers', () => {
    const zip = makeDeterministicZip(TEST_FILES);
    const entries = parseLocalEntries(zip);
    expect(entries.length).toBe(3);

    // Verify file content round-trips
    const byName = new Map(entries.map(e => [e.name, e]));
    expect(byName.has('manifest.json')).toBe(true);
    expect(new TextDecoder().decode(byName.get('manifest.json')!.data)).toBe('{"version":"1.0"}');
    expect(new TextDecoder().decode(byName.get('README.txt')!.data)).toBe('Hello World');
  });

  it('sorts files by path in lexicographic order', () => {
    const zip = makeDeterministicZip(TEST_FILES);
    const entries = parseLocalEntries(zip);
    const names = entries.map(e => e.name);
    // "README.txt" < "data/report.json" < "manifest.json" (byte order)
    expect(names).toEqual(['README.txt', 'data/report.json', 'manifest.json']);
  });

  it('is deterministic — same input produces identical SHA-256', () => {
    const zip1 = makeDeterministicZip(TEST_FILES);
    const zip2 = makeDeterministicZip(TEST_FILES);
    const hash1 = createHash('sha256').update(zip1).digest('hex');
    const hash2 = createHash('sha256').update(zip2).digest('hex');
    expect(hash1).toBe(hash2);
    // Also check byte equality
    expect(Buffer.from(zip1).equals(Buffer.from(zip2))).toBe(true);
  });

  it('detects changes — different input produces different bytes', () => {
    const zip1 = makeDeterministicZip(TEST_FILES);
    const modified: ZipInputFile[] = [
      ...TEST_FILES.slice(0, 2),
      { path: 'README.txt', bytes: enc('Changed!') },
    ];
    const zip2 = makeDeterministicZip(modified);
    const hash1 = createHash('sha256').update(zip1).digest('hex');
    const hash2 = createHash('sha256').update(zip2).digest('hex');
    expect(hash1).not.toBe(hash2);
  });

  it('produces valid EOCD with correct entry count', () => {
    const zip = makeDeterministicZip(TEST_FILES);
    const eocd = findEOCD(zip);
    expect(eocd).not.toBeNull();
    expect(eocd!.totalEntries).toBe(3);
    expect(eocd!.centralDirOffset).toBeGreaterThan(0);
    expect(eocd!.centralDirSize).toBeGreaterThan(0);
  });

  it('handles empty file list — produces valid ZIP with 0 entries', () => {
    const zip = makeDeterministicZip([]);
    // Empty ZIP is just the EOCD (22 bytes)
    expect(zip.length).toBe(22);
    const eocd = findEOCD(zip);
    expect(eocd).not.toBeNull();
    expect(eocd!.totalEntries).toBe(0);
  });

  it('handles files with empty content', () => {
    const zip = makeDeterministicZip([
      { path: 'empty.txt', bytes: new Uint8Array(0) },
    ]);
    expect(zip[0]).toBe(0x50);
    const entries = parseLocalEntries(zip);
    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe('empty.txt');
    expect(entries[0].data.length).toBe(0);
  });

  it('sets DOS timestamp to 1980-01-01 00:00:00', () => {
    const zip = makeDeterministicZip([{ path: 'a.txt', bytes: enc('x') }]);
    // Local file header: offset 10-11 = time, offset 12-13 = date
    const time = readU16(zip, 10);
    const date = readU16(zip, 12);
    expect(time).toBe(0x0000);
    expect(date).toBe(0x0021);
  });

  it('sets UTF-8 flag (bit 11) in general purpose bit flag', () => {
    const zip = makeDeterministicZip([{ path: 'a.txt', bytes: enc('x') }]);
    const gpFlag = readU16(zip, 6);
    expect(gpFlag & 0x0800).toBe(0x0800);
  });
});

describe('crc32', () => {
  it('matches known CRC32 test vector for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
  });

  it('matches known CRC32 for "123456789"', () => {
    // Standard CRC-32 check value
    expect(crc32(enc('123456789'))).toBe(0xCBF43926);
  });

  it('matches CRC32 stored in ZIP local header', () => {
    const content = enc('test content');
    const expectedCrc = crc32(content);
    const zip = makeDeterministicZip([{ path: 'test.txt', bytes: content }]);
    const entries = parseLocalEntries(zip);
    expect(entries[0].crc).toBe(expectedCrc);
  });
});

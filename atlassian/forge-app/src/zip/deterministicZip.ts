/**
 * deterministicZip.ts — Standards-compliant deterministic ZIP writer
 *
 * Produces a PKZIP-compatible archive (STORE method 0, no compression).
 * - Files sorted by path (lexicographic byte order)
 * - DOS timestamp fixed to 1980-01-01 00:00:00 (date=0x0021, time=0x0000)
 * - CRC-32 computed internally (no external deps)
 * - UTF-8 filenames with general-purpose bit flag 0x0800
 * - Output starts with PK\x03\x04 (local file header signature)
 *
 * Zero dependencies. Pure function. Deterministic (same input → same bytes).
 *
 * [FT_PROOF_BACKEND_ZIP_MODULE] — deterministic zip writer loaded
 */

// ============================================================================
// Types
// ============================================================================

export interface ZipInputFile {
  /** Relative path inside the ZIP (e.g. "manifest.json") */
  path: string;
  /** Raw file content as bytes */
  bytes: Uint8Array;
}

// ============================================================================
// CRC-32 (IEEE 802.3 polynomial, same as zlib / PKZIP)
// ============================================================================

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================================
// Helpers — little-endian writers
// ============================================================================

function writeU16(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xFF;
  buf[offset + 1] = (val >>> 8) & 0xFF;
}

function writeU32(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xFF;
  buf[offset + 1] = (val >>> 8) & 0xFF;
  buf[offset + 2] = (val >>> 16) & 0xFF;
  buf[offset + 3] = (val >>> 24) & 0xFF;
}

// ============================================================================
// Constants
// ============================================================================

// Fixed DOS date/time for 1980-01-01 00:00:00
// DOS time: 0x0000 (00:00:00)
// DOS date: 0x0021 (1980-01-01)  → ((1980-1980)<<9) | (1<<5) | 1
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021;

// ZIP signatures
const LOCAL_FILE_HEADER_SIG   = 0x04034B50;
const CENTRAL_DIR_HEADER_SIG  = 0x02014B50;
const END_OF_CENTRAL_DIR_SIG  = 0x06054B50;

// Sizes
const LOCAL_HEADER_FIXED_SIZE   = 30;
const CENTRAL_HEADER_FIXED_SIZE = 46;
const EOCD_SIZE                 = 22;

// Version needed to extract (2.0 = 20)
const VERSION_NEEDED = 20;
// Version made by (UNIX + 2.0)
const VERSION_MADE_BY = (3 << 8) | 20; // 0x0314

// General purpose bit flag: bit 11 = UTF-8 filenames
const GP_FLAG_UTF8 = 0x0800;

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Build a standards-compliant ZIP archive from a list of files.
 *
 * @param files  Array of { path, bytes } entries. Will be sorted by path.
 * @returns      Complete ZIP archive as Uint8Array.
 *               First 4 bytes are always [0x50, 0x4B, 0x03, 0x04].
 */
export function makeDeterministicZip(files: ZipInputFile[]): Uint8Array {
  // Sort files by path (lexicographic, byte-order)
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Encode filenames to UTF-8 once
  const encoder = new TextEncoder();
  const encodedNames = sorted.map(f => encoder.encode(f.path));

  // Pre-compute total size
  let localHeadersSize = 0;
  let centralDirSize = 0;
  for (let i = 0; i < sorted.length; i++) {
    const nameLen = encodedNames[i].length;
    const dataLen = sorted[i].bytes.length;
    localHeadersSize += LOCAL_HEADER_FIXED_SIZE + nameLen + dataLen;
    centralDirSize += CENTRAL_HEADER_FIXED_SIZE + nameLen;
  }
  const totalSize = localHeadersSize + centralDirSize + EOCD_SIZE;

  const out = new Uint8Array(totalSize);
  let offset = 0;
  const localOffsets: number[] = [];

  // ---- Local file headers + file data ----
  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const name = encodedNames[i];
    const data = file.bytes;
    const fileCrc = crc32(data);

    localOffsets.push(offset);

    // Local file header (30 bytes + filename + extra)
    writeU32(out, offset, LOCAL_FILE_HEADER_SIG);       // 0-3   signature
    writeU16(out, offset + 4, VERSION_NEEDED);           // 4-5   version needed
    writeU16(out, offset + 6, GP_FLAG_UTF8);             // 6-7   general purpose bit flag
    writeU16(out, offset + 8, 0);                        // 8-9   compression method (STORE)
    writeU16(out, offset + 10, DOS_TIME);                // 10-11 last mod time
    writeU16(out, offset + 12, DOS_DATE);                // 12-13 last mod date
    writeU32(out, offset + 14, fileCrc);                 // 14-17 CRC-32
    writeU32(out, offset + 18, data.length);             // 18-21 compressed size
    writeU32(out, offset + 22, data.length);             // 22-25 uncompressed size
    writeU16(out, offset + 26, name.length);             // 26-27 filename length
    writeU16(out, offset + 28, 0);                       // 28-29 extra field length
    offset += LOCAL_HEADER_FIXED_SIZE;

    // Filename
    out.set(name, offset);
    offset += name.length;

    // File data (uncompressed)
    out.set(data, offset);
    offset += data.length;
  }

  // ---- Central directory ----
  const centralDirStart = offset;

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const name = encodedNames[i];
    const data = file.bytes;
    const fileCrc = crc32(data);

    writeU32(out, offset, CENTRAL_DIR_HEADER_SIG);       // 0-3   signature
    writeU16(out, offset + 4, VERSION_MADE_BY);           // 4-5   version made by
    writeU16(out, offset + 6, VERSION_NEEDED);            // 6-7   version needed
    writeU16(out, offset + 8, GP_FLAG_UTF8);              // 8-9   general purpose bit flag
    writeU16(out, offset + 10, 0);                        // 10-11 compression method (STORE)
    writeU16(out, offset + 12, DOS_TIME);                 // 12-13 last mod time
    writeU16(out, offset + 14, DOS_DATE);                 // 14-15 last mod date
    writeU32(out, offset + 16, fileCrc);                  // 16-19 CRC-32
    writeU32(out, offset + 20, data.length);              // 20-23 compressed size
    writeU32(out, offset + 24, data.length);              // 24-27 uncompressed size
    writeU16(out, offset + 28, name.length);              // 28-29 filename length
    writeU16(out, offset + 30, 0);                        // 30-31 extra field length
    writeU16(out, offset + 32, 0);                        // 32-33 file comment length
    writeU16(out, offset + 34, 0);                        // 34-35 disk number start
    writeU16(out, offset + 36, 0);                        // 36-37 internal file attributes
    writeU32(out, offset + 38, 0);                        // 38-41 external file attributes
    writeU32(out, offset + 42, localOffsets[i]);          // 42-45 relative offset of local header
    offset += CENTRAL_HEADER_FIXED_SIZE;

    // Filename
    out.set(name, offset);
    offset += name.length;
  }

  const centralDirEnd = offset;
  const centralDirSizeActual = centralDirEnd - centralDirStart;

  // ---- End of central directory record ----
  writeU32(out, offset, END_OF_CENTRAL_DIR_SIG);          // 0-3   signature
  writeU16(out, offset + 4, 0);                           // 4-5   disk number
  writeU16(out, offset + 6, 0);                           // 6-7   disk where central dir starts
  writeU16(out, offset + 8, sorted.length);               // 8-9   entries on this disk
  writeU16(out, offset + 10, sorted.length);              // 10-11 total entries
  writeU32(out, offset + 12, centralDirSizeActual);       // 12-15 central dir size
  writeU32(out, offset + 16, centralDirStart);            // 16-19 central dir offset
  writeU16(out, offset + 20, 0);                          // 20-21 comment length

  console.log('[FT_PROOF_BACKEND_ZIP_OK] makeDeterministicZip completed', JSON.stringify({
    fileCount: sorted.length,
    totalBytes: totalSize,
    firstFourBytes: `${out[0].toString(16)}${out[1].toString(16)}${out[2].toString(16)}${out[3].toString(16)}`,
  }));

  return out;
}

/**
 * DETERMINISTIC ZIP BUILDER
 * 
 * Creates a byte-for-byte reproducible ZIP file for the same input.
 * 
 * Key constraints:
 * - Fixed entry order (no sorting during iteration)
 * - All file modification times set to 1980-01-01 00:00:00 (ZIP epoch)
 * - Store method only (no compression)
 * - No extra fields
 * - Deterministic CRC32 calculation
 * - Reproducible central directory layout
 * 
 * Internal self-check:
 * - Builds ZIP twice in one run
 * - If bytes differ, throws ZIP_NONDETERMINISTIC
 */

/**
 * CRC32 lookup table for deterministic calculation
 */
const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

/**
 * Calculate CRC32 of buffer (deterministic)
 */
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Write little-endian 32-bit unsigned integer
 */
function writeUint32LE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return buf;
}

/**
 * Write little-endian 16-bit unsigned integer
 */
function writeUint16LE(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value & 0xffff, 0);
  return buf;
}

/**
 * ZIP entry (filename, data)
 */
export interface ZipEntry {
  path: string; // Path in ZIP (e.g., "manifest.json" - no leading slash)
  data: Buffer;
}

/**
 * Build ZIP with deterministic structure
 */
function buildZipBytes(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const centralDirHeaders: Buffer[] = [];
  let offset = 0;

  // DOS datetime: 1980-01-01 00:00:00 = (1 << 21) | (1 << 16) = 0x00210001
  const DOS_DATETIME = 0x00210001;

  for (const entry of entries) {
    const filename = Buffer.from(entry.path, 'utf-8');
    const filedata = entry.data;
    const crc = crc32(filedata);

    // Local file header
    // Signature: 0x04034b50
    // Version: 20 (2.0)
    // Flags: 0 (no compression, no data descriptor)
    // Compression: 0 (stored)
    // DOS Date/Time: 0x00210001 (1980-01-01 00:00:00)
    // CRC-32, Compressed size, Uncompressed size
    // Filename length, Extra field length

    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // Signature
      Buffer.from([0x14, 0x00]), // Version 2.0
      Buffer.from([0x00, 0x00]), // Flags
      Buffer.from([0x00, 0x00]), // Compression method (store)
      writeUint16LE((DOS_DATETIME & 0xffff) >>> 0), // Time
      writeUint16LE((DOS_DATETIME >>> 16) & 0xffff), // Date
      writeUint32LE(crc), // CRC-32
      writeUint32LE(filedata.length), // Compressed size
      writeUint32LE(filedata.length), // Uncompressed size
      writeUint16LE(filename.length), // Filename length
      Buffer.from([0x00, 0x00]), // Extra field length (0)
      filename, // Filename
    ]);

    // Track offset for central directory
    const fileOffset = offset;
    offset += localHeader.length + filedata.length;

    parts.push(localHeader, filedata);

    // Central directory file header
    const centralHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // Signature
      Buffer.from([0x14, 0x00]), // Version made by
      Buffer.from([0x14, 0x00]), // Version needed
      Buffer.from([0x00, 0x00]), // Flags
      Buffer.from([0x00, 0x00]), // Compression method
      writeUint16LE((DOS_DATETIME & 0xffff) >>> 0), // Time
      writeUint16LE((DOS_DATETIME >>> 16) & 0xffff), // Date
      writeUint32LE(crc), // CRC-32
      writeUint32LE(filedata.length), // Compressed size
      writeUint32LE(filedata.length), // Uncompressed size
      writeUint16LE(filename.length), // Filename length
      Buffer.from([0x00, 0x00]), // Extra field length
      Buffer.from([0x00, 0x00]), // File comment length
      Buffer.from([0x00, 0x00]), // Disk number start
      Buffer.from([0x00, 0x00]), // Internal file attributes
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // External file attributes
      writeUint32LE(fileOffset), // Relative offset of local header
      filename, // Filename
    ]);

    centralDirHeaders.push(centralHeader);
  }

  // Central directory offset
  const centralDirOffset = offset;

  // Build central directory
  const centralDir = Buffer.concat(centralDirHeaders);
  parts.push(centralDir);

  // End of central directory record
  const diskNumber = 0;
  const diskWithCentralDir = 0;
  const diskEntries = entries.length;
  const totalEntries = entries.length;
  const centralDirSize = centralDir.length;
  const comment = Buffer.alloc(0);

  const endOfCentralDir = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // Signature
    writeUint16LE(diskNumber), // Disk number
    writeUint16LE(diskWithCentralDir), // Disk with central dir
    writeUint16LE(diskEntries), // Entries on this disk
    writeUint16LE(totalEntries), // Total entries
    writeUint32LE(centralDirSize), // Central dir size
    writeUint32LE(centralDirOffset), // Central dir offset
    writeUint16LE(comment.length), // Comment length
    comment, // Comment
  ]);

  parts.push(endOfCentralDir);

  return Buffer.concat(parts);
}

/**
 * Build deterministic ZIP with self-check
 * Throws Error("ZIP_NONDETERMINISTIC") if generated bytes differ
 */
export function buildDeterministicZip(entries: ZipEntry[]): Buffer {
  // Build twice and compare
  const zip1 = buildZipBytes(entries);
  const zip2 = buildZipBytes(entries);

  if (zip1.compare(zip2) !== 0) {
    throw new Error('ZIP_NONDETERMINISTIC');
  }

  return zip1;
}

/**
 * Validate ZIP structure
 */
export function validateZipStructure(zipBuffer: Buffer): boolean {
  // Check local file header signature
  if (zipBuffer.length < 4) {
    return false;
  }

  const sig = zipBuffer.readUInt32LE(0);
  return sig === 0x04034b50; // Local file header signature
}

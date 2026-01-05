/**
 * SHA256 Hash Implementation
 * 
 * Produces deterministic hexadecimal SHA256 hash of input string.
 */

import crypto from 'crypto';

export function sha256Hex(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text, 'utf-8')
    .digest('hex');
}

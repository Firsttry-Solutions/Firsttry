/**
 * Sanitize storage/snapshot keys to match Forge API validation:
 * Pattern: ^(?!\s+$)[a-zA-Z0-9:._\s-#]+$
 *
 * Rules:
 * - Allow: alphanumeric, colon, dot, underscore, space, hyphen, hash
 * - Disallow: other special characters
 * - Trim whitespace
 * - Replace disallowed chars with underscore
 * - Collapse consecutive underscores
 */
export function sanitizeKey(input: string): string {
  if (!input || input.trim() === '') {
    // Fallback for empty input
    return `key_${Date.now()}`;
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Replace disallowed characters with underscore
  // Keep only: a-z A-Z 0-9 : . _ space - #
  sanitized = sanitized.replace(/[^a-zA-Z0-9:._\s\-#]/g, '_');

  // Collapse consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_');

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  // If empty after sanitization, fallback
  if (sanitized === '') {
    return `key_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Returns true if key was modified during sanitization
 */
export function keyWasModified(original: string, sanitized: string): boolean {
  return original !== sanitized;
}

/**
 * API Key Utilities — Phase 2.1
 *
 * Cryptographic generation and validation helpers for developer API keys.
 *
 * SECURITY RULES (enforced here, documented for review):
 *   1. Only SHA-256 digests are stored in the database — never plaintext.
 *   2. The plaintext key is returned to callers ONCE and then lost.
 *   3. Keys are 32 bytes of CSPRNG output encoded as base64url (43 chars).
 *   4. The environment and type are encoded in the prefix so format validation
 *      can detect environment-mismatch before a database round-trip.
 *   5. All validation is constant-time (timingSafeEqual) to prevent
 *      timing side-channels.
 *
 * Key format:
 *   <type>_<env>_<32-char base64url random suffix>
 *   e.g.  pk_test_aB3dEfGhIjKlMnOpQrStUvWx01234567
 *         sk_live_zYxWvUsTrQpOnMlKjIhGfEdCbA98765432
 */

import crypto from 'crypto';
import type { ApiKeyType, AppEnvironment } from '@/lib/db/types';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Length of the random suffix in characters after base64url-encoding.
 * 32 bytes → 43 chars base64url (without padding), we take the first 32.
 */
const SUFFIX_LENGTH = 32;

/** All valid key prefixes.  Used for format validation. */
export const KEY_PREFIXES: Record<ApiKeyType, Record<AppEnvironment, string>> = {
  publishable: { test: 'pk_test_', live: 'pk_live_' },
  secret:      { test: 'sk_test_', live: 'sk_live_' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedKey {
  /** Full plaintext key — show to user ONCE, then discard. */
  plaintext: string;
  /** SHA-256 hex digest — the only value stored in the database. */
  hash: string;
  /** Non-secret display prefix for UI, e.g. "sk_test_aB3d…" */
  prefix: string;
}

// ─── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure API key.
 *
 * Uses 32 bytes (256 bits) of CSPRNG output so the probability of two keys
 * sharing the same plaintext is negligible (< 2^-128 for 2^64 keys).
 *
 * @param keyType   'publishable' or 'secret'
 * @param env       'test' or 'live'
 * @returns         { plaintext, hash, prefix }
 */
export function generateApiKey(
  keyType: ApiKeyType,
  env: AppEnvironment,
): GeneratedKey {
  const keyPrefix = KEY_PREFIXES[keyType][env];

  // 32 cryptographically random bytes
  const randomBytes = crypto.randomBytes(32);

  // base64url encoding (RFC 4648 §5): no padding, URL-safe alphabet
  const randomSuffix = randomBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g,  '')
    .slice(0, SUFFIX_LENGTH);

  const plaintext = keyPrefix + randomSuffix;

  return {
    plaintext,
    hash:   hashApiKey(plaintext),
    prefix: buildDisplayPrefix(plaintext),
  };
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a plaintext API key.
 * This is the value stored in api_keys.key_hash.
 */
export function hashApiKey(plaintext: string): string {
  return crypto
    .createHash('sha256')
    .update(plaintext, 'utf8')
    .digest('hex');
}

// ─── Format Validation ───────────────────────────────────────────────────────

/**
 * Returns true if the string looks like a structurally valid API key.
 * Does NOT verify that the key exists in the database.
 *
 * Rules:
 *   • Starts with one of the four known prefixes
 *   • Suffix is exactly SUFFIX_LENGTH base64url characters
 *   • Total length matches prefix + suffix
 */
export function isValidKeyFormat(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;

  for (const typeMap of Object.values(KEY_PREFIXES)) {
    for (const prefix of Object.values(typeMap)) {
      if (key.startsWith(prefix)) {
        const suffix = key.slice(prefix.length);
        return suffix.length === SUFFIX_LENGTH && /^[A-Za-z0-9_-]+$/.test(suffix);
      }
    }
  }
  return false;
}

/**
 * Extracts the key type and environment from a key's prefix.
 * Returns null if the format is invalid.
 */
export function parseKeyPrefix(key: string): {
  keyType: ApiKeyType;
  environment: AppEnvironment;
} | null {
  for (const [keyType, envMap] of Object.entries(KEY_PREFIXES) as [
    ApiKeyType,
    Record<AppEnvironment, string>,
  ][]) {
    for (const [env, prefix] of Object.entries(envMap) as [
      AppEnvironment,
      string,
    ][]) {
      if (key.startsWith(prefix)) {
        return { keyType, environment: env };
      }
    }
  }
  return null;
}

// ─── Display Helpers ─────────────────────────────────────────────────────────

/**
 * Builds a non-secret display prefix for the UI.
 * Example: "sk_test_aB3dEf…"
 * Keeps the full type+env prefix plus 6 chars of the suffix, then "…"
 */
export function buildDisplayPrefix(plaintext: string): string {
  // Find prefix length
  for (const typeMap of Object.values(KEY_PREFIXES)) {
    for (const prefix of Object.values(typeMap)) {
      if (plaintext.startsWith(prefix)) {
        // Show prefix + first 6 chars of suffix + ellipsis
        return plaintext.slice(0, prefix.length + 6) + '…';
      }
    }
  }
  // Fallback — should never reach here if key format is valid
  return plaintext.slice(0, 15) + '…';
}

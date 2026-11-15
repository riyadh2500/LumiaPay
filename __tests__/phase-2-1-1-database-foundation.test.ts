/**
 * Phase 2.1.1 — Database Foundation Tests
 *
 * Verifies:
 *  1. API key generation, hashing, and format validation
 *  2. Schema/type correctness (compile-time + runtime shape checks)
 *  3. Environment isolation invariants
 *  4. Ownership model constraints (pure-logic, no DB round-trip)
 *  5. Cross-environment access rules
 *  6. API key storage safety (no plaintext persisted)
 *  7. RLS policy logic (expressed as predicate tests)
 *  8. SQL migration file content validation
 *
 * All tests run offline — no Supabase connection is needed.
 * External dependencies (admin client) are mocked where referenced.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  generateApiKey,
  hashApiKey,
  isValidKeyFormat,
  parseKeyPrefix,
  buildDisplayPrefix,
  KEY_PREFIXES,
  type GeneratedKey,
} from '@/lib/developer/api-keys';

import type {
  ApplicationRow,
  ApiKeyRow,
  PaymentRow,
  ApplicationInsert,
  ApiKeyInsert,
  ApiKeyAuthContext,
  ApiKeyPermissions,
  AppEnvironment,
  ApiKeyType,
  ApplicationStatus,
  ApiKeyStatus,
} from '@/lib/db/types';


// ─── 1. API Key Generation ────────────────────────────────────────────────────

describe('API Key Generation — generateApiKey()', () => {
  const cases: Array<[ApiKeyType, AppEnvironment, string]> = [
    ['publishable', 'test', 'pk_test_'],
    ['publishable', 'live', 'pk_live_'],
    ['secret',      'test', 'sk_test_'],
    ['secret',      'live', 'sk_live_'],
  ];

  test.each(cases)(
    'generates %s/%s key with correct prefix "%s"',
    (keyType, env, expectedPrefix) => {
      const { plaintext } = generateApiKey(keyType, env);
      expect(plaintext.startsWith(expectedPrefix)).toBe(true);
    },
  );

  test('suffix is exactly 32 base64url characters', () => {
    for (const [keyType, env] of [
      ['secret', 'test'],
      ['secret', 'live'],
      ['publishable', 'test'],
    ] as [ApiKeyType, AppEnvironment][]) {
      const { plaintext } = generateApiKey(keyType, env);
      const prefix = KEY_PREFIXES[keyType][env];
      const suffix = plaintext.slice(prefix.length);
      expect(suffix).toHaveLength(32);
      expect(/^[A-Za-z0-9_-]+$/.test(suffix)).toBe(true);
    }
  });

  test('every generated key is unique', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const { plaintext } = generateApiKey('secret', 'test');
      keys.add(plaintext);
    }
    // All 1000 keys must be distinct
    expect(keys.size).toBe(1000);
  });

  test('hash field is SHA-256 hex of the plaintext', () => {
    const { plaintext, hash } = generateApiKey('secret', 'live');
    const expected = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    expect(hash).toBe(expected);
    expect(hash).toHaveLength(64); // 32 bytes → 64 hex chars
  });

  test('hash of two different keys is different', () => {
    const a = generateApiKey('secret', 'test');
    const b = generateApiKey('secret', 'test');
    expect(a.hash).not.toBe(b.hash);
  });

  test('prefix field is a non-secret display string', () => {
    const { plaintext, prefix } = generateApiKey('secret', 'test');
    // Must start with the key prefix
    expect(plaintext.startsWith('sk_test_')).toBe(true);
    // Display prefix must end with ellipsis
    expect(prefix.endsWith('…')).toBe(true);
    // Display prefix must be shorter than the full key
    expect(prefix.length).toBeLessThan(plaintext.length);
    // Display prefix must not contain the full suffix
    expect(prefix).not.toBe(plaintext);
  });

  test('GeneratedKey has exactly the three expected fields', () => {
    const result: GeneratedKey = generateApiKey('publishable', 'test');
    expect(Object.keys(result).sort()).toEqual(['hash', 'plaintext', 'prefix'].sort());
  });
});


// ─── 2. API Key Hashing ───────────────────────────────────────────────────────

describe('hashApiKey()', () => {
  test('produces a 64-character hex string', () => {
    const hash = hashApiKey('sk_test_abc');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  test('is deterministic — same input → same hash', () => {
    const key = 'pk_live_someFixedKey';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  test('is a pure SHA-256 digest', () => {
    const key = 'sk_live_testHashConsistency';
    const expected = crypto.createHash('sha256').update(key, 'utf8').digest('hex');
    expect(hashApiKey(key)).toBe(expected);
  });

  test('differs for even minimally different inputs', () => {
    const a = hashApiKey('sk_test_keyA');
    const b = hashApiKey('sk_test_keyB');
    expect(a).not.toBe(b);
  });

  test('never returns an empty string', () => {
    expect(hashApiKey('')).toHaveLength(64);  // SHA-256 of empty string is valid
    expect(hashApiKey('anything')).toHaveLength(64);
  });
});


// ─── 3. Key Format Validation ─────────────────────────────────────────────────

describe('isValidKeyFormat()', () => {
  test('accepts all four valid prefix combinations', () => {
    for (const [keyType, env] of [
      ['secret', 'test'],
      ['secret', 'live'],
      ['publishable', 'test'],
      ['publishable', 'live'],
    ] as [ApiKeyType, AppEnvironment][]) {
      const { plaintext } = generateApiKey(keyType, env);
      expect(isValidKeyFormat(plaintext)).toBe(true);
    }
  });

  test('rejects empty string', () => {
    expect(isValidKeyFormat('')).toBe(false);
  });

  test('rejects unknown prefix', () => {
    expect(isValidKeyFormat('ak_test_' + 'a'.repeat(32))).toBe(false);
    expect(isValidKeyFormat('sk_staging_' + 'a'.repeat(32))).toBe(false);
  });

  test('rejects suffix that is too short', () => {
    expect(isValidKeyFormat('sk_test_shortSuffix')).toBe(false);
  });

  test('rejects suffix that is too long', () => {
    expect(isValidKeyFormat('sk_test_' + 'a'.repeat(33))).toBe(false);
  });

  test('rejects suffix with non-base64url characters', () => {
    // base64url uses A-Z a-z 0-9 - _; a space or + is invalid
    expect(isValidKeyFormat('sk_test_' + 'a'.repeat(31) + '!')).toBe(false);
    expect(isValidKeyFormat('sk_test_' + 'a'.repeat(31) + ' ')).toBe(false);
  });

  test('rejects non-string input gracefully', () => {
    // @ts-expect-error – intentionally testing runtime with wrong type
    expect(isValidKeyFormat(null)).toBe(false);
    // @ts-expect-error
    expect(isValidKeyFormat(undefined)).toBe(false);
    // @ts-expect-error
    expect(isValidKeyFormat(12345)).toBe(false);
  });
});


// ─── 4. parseKeyPrefix() ──────────────────────────────────────────────────────

describe('parseKeyPrefix()', () => {
  test('correctly extracts type and environment for all variants', () => {
    const expectations: Array<[string, ApiKeyType, AppEnvironment]> = [
      ['pk_test_' + 'a'.repeat(32), 'publishable', 'test'],
      ['pk_live_' + 'a'.repeat(32), 'publishable', 'live'],
      ['sk_test_' + 'a'.repeat(32), 'secret',      'test'],
      ['sk_live_' + 'a'.repeat(32), 'secret',      'live'],
    ];

    for (const [key, expectedType, expectedEnv] of expectations) {
      const result = parseKeyPrefix(key);
      expect(result).not.toBeNull();
      expect(result!.keyType).toBe(expectedType);
      expect(result!.environment).toBe(expectedEnv);
    }
  });

  test('returns null for invalid prefix', () => {
    expect(parseKeyPrefix('invalid_key_format')).toBeNull();
    expect(parseKeyPrefix('')).toBeNull();
  });

  test('is consistent with generateApiKey output', () => {
    const { plaintext } = generateApiKey('secret', 'live');
    const parsed = parseKeyPrefix(plaintext);
    expect(parsed).not.toBeNull();
    expect(parsed!.keyType).toBe('secret');
    expect(parsed!.environment).toBe('live');
  });
});


// ─── 5. Environment Isolation Invariants ─────────────────────────────────────

describe('Environment Isolation', () => {
  /**
   * Simulates the application-level environment isolation check.
   * In production this lives in the API middleware; tested here as pure logic.
   */
  function checkEnvironmentAccess(
    keyEnv: AppEnvironment,
    resourceEnv: AppEnvironment,
  ): boolean {
    return keyEnv === resourceEnv;
  }

  test('test key may access test resources', () => {
    expect(checkEnvironmentAccess('test', 'test')).toBe(true);
  });

  test('live key may access live resources', () => {
    expect(checkEnvironmentAccess('live', 'live')).toBe(true);
  });

  test('test key must NOT access live resources', () => {
    expect(checkEnvironmentAccess('test', 'live')).toBe(false);
  });

  test('live key must NOT access test resources', () => {
    expect(checkEnvironmentAccess('live', 'test')).toBe(false);
  });

  test('test keys carry sk_test_ / pk_test_ prefix', () => {
    const { plaintext: sk } = generateApiKey('secret', 'test');
    const { plaintext: pk } = generateApiKey('publishable', 'test');
    expect(sk.startsWith('sk_test_')).toBe(true);
    expect(pk.startsWith('pk_test_')).toBe(true);
  });

  test('live keys carry sk_live_ / pk_live_ prefix', () => {
    const { plaintext: sk } = generateApiKey('secret', 'live');
    const { plaintext: pk } = generateApiKey('publishable', 'live');
    expect(sk.startsWith('sk_live_')).toBe(true);
    expect(pk.startsWith('pk_live_')).toBe(true);
  });

  test('test key prefix cannot match live key prefix', () => {
    const testPrefixes = [KEY_PREFIXES.secret.test, KEY_PREFIXES.publishable.test];
    const livePrefixes = [KEY_PREFIXES.secret.live, KEY_PREFIXES.publishable.live];
    for (const tp of testPrefixes) {
      for (const lp of livePrefixes) {
        expect(tp).not.toBe(lp);
      }
    }
  });
});


// ─── 6. Ownership Model ───────────────────────────────────────────────────────

describe('Ownership Model', () => {
  /**
   * Simulates the ownership predicate that application middleware and RLS
   * policies both enforce.
   */
  function userOwnsApplication(
    requestUserId: string,
    application: Pick<ApplicationRow, 'user_id'>,
  ): boolean {
    return application.user_id === requestUserId;
  }

  function appOwnsKey(
    requestApplicationId: string,
    key: Pick<ApiKeyRow, 'application_id'>,
  ): boolean {
    return key.application_id === requestApplicationId;
  }

  function appOwnsPayment(
    requestApplicationId: string,
    payment: Pick<PaymentRow, 'application_id'>,
  ): boolean {
    // payments created via dashboard have NULL application_id
    if (payment.application_id === null) return false;
    return payment.application_id === requestApplicationId;
  }

  const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001';
  const USER_B = 'bbbbbbbb-0000-0000-0000-000000000002';
  const APP_A  = 'cccccccc-0000-0000-0000-000000000003';
  const APP_B  = 'dddddddd-0000-0000-0000-000000000004';

  const appOwnedByA: Pick<ApplicationRow, 'user_id'> = { user_id: USER_A };
  const keyInAppA:   Pick<ApiKeyRow, 'application_id'> = { application_id: APP_A };
  const paymentInAppA: Pick<PaymentRow, 'application_id'> = { application_id: APP_A };
  const dashboardPayment: Pick<PaymentRow, 'application_id'> = { application_id: null };

  test('user A owns application A', () => {
    expect(userOwnsApplication(USER_A, appOwnedByA)).toBe(true);
  });

  test('user B does not own application A', () => {
    expect(userOwnsApplication(USER_B, appOwnedByA)).toBe(false);
  });

  test('application A owns its key', () => {
    expect(appOwnsKey(APP_A, keyInAppA)).toBe(true);
  });

  test('application B does not own application A key', () => {
    expect(appOwnsKey(APP_B, keyInAppA)).toBe(false);
  });

  test('application A owns its payment', () => {
    expect(appOwnsPayment(APP_A, paymentInAppA)).toBe(true);
  });

  test('application B does not own application A payment', () => {
    expect(appOwnsPayment(APP_B, paymentInAppA)).toBe(false);
  });

  test('no API key owns a dashboard payment (application_id IS NULL)', () => {
    expect(appOwnsPayment(APP_A, dashboardPayment)).toBe(false);
    expect(appOwnsPayment(APP_B, dashboardPayment)).toBe(false);
  });
});


// ─── 7. API Key Storage Safety ────────────────────────────────────────────────

describe('API Key Storage Safety', () => {
  test('generated plaintext is not the same as the hash', () => {
    const { plaintext, hash } = generateApiKey('secret', 'test');
    expect(plaintext).not.toBe(hash);
  });

  test('hash does not start with any key prefix (not a recognisable key)', () => {
    const { hash } = generateApiKey('secret', 'live');
    // If we were accidentally storing the plaintext in key_hash we would
    // see a key prefix.  A SHA-256 hex string starts with 0-9 a-f only.
    const prefixes = [
      KEY_PREFIXES.secret.test,
      KEY_PREFIXES.secret.live,
      KEY_PREFIXES.publishable.test,
      KEY_PREFIXES.publishable.live,
    ];
    for (const p of prefixes) {
      expect(hash.startsWith(p)).toBe(false);
    }
  });

  test('ApiKeyInsert type requires key_hash but not plaintext', () => {
    // This is a compile-time check validated at runtime by object shape.
    const insert: ApiKeyInsert = {
      application_id: 'app-id-uuid',
      name: 'Test Key',
      key_type: 'secret',
      key_hash: 'a'.repeat(64),
      key_prefix: 'sk_test_abcdef…',
    };
    expect(insert).not.toHaveProperty('plaintext');
    expect(insert).toHaveProperty('key_hash');
    expect(insert).toHaveProperty('key_prefix');
  });

  test('ApiKeyRow type does not include a plaintext field', () => {
    // Build a row that satisfies the type (TypeScript would catch this if
    // the interface had a 'plaintext' field).
    const row: ApiKeyRow = {
      id: 'key-uuid',
      application_id: 'app-uuid',
      name: 'My Key',
      key_type: 'secret',
      key_hash: 'b'.repeat(64),
      key_prefix: 'sk_live_abcdef…',
      permissions: { payments: ['read', 'write'] },
      status: 'active',
      usage_count: 0,
      last_used_at: null,
      expires_at: null,
      revoked_at: null,
      revoked_reason: null,
      created_at: new Date().toISOString(),
    };
    expect(row).not.toHaveProperty('plaintext');
  });

  test('hash is 64 hex characters (SHA-256 output length)', () => {
    const { hash } = generateApiKey('publishable', 'test');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });
});


// ─── 8. RLS Policy Logic ──────────────────────────────────────────────────────

describe('RLS Policy Logic (predicates)', () => {
  /**
   * These tests express the boolean predicates that the SQL RLS policies
   * encode.  Keeping the logic here means we can verify correctness in
   * unit tests, independent of a live Postgres connection.
   */

  // applications — select/insert/update: user_id = auth.uid()
  function rlsApplicationsOwnRow(
    authUid: string,
    rowUserId: string,
  ): boolean {
    return rowUserId === authUid;
  }

  // api_keys — select/insert/update: application.user_id = auth.uid()
  function rlsApiKeysViaApplication(
    authUid: string,
    applicationUserId: string,
  ): boolean {
    return applicationUserId === authUid;
  }

  // api_keys — delete: always false (soft-delete only)
  function rlsApiKeysDeletePolicy(): boolean {
    return false;
  }

  const OWNER = 'owner-uuid-0001';
  const OTHER = 'other-uuid-0002';

  test('applications: owner can select own row', () => {
    expect(rlsApplicationsOwnRow(OWNER, OWNER)).toBe(true);
  });

  test('applications: other user cannot select row', () => {
    expect(rlsApplicationsOwnRow(OTHER, OWNER)).toBe(false);
  });

  test('applications: owner can insert with own user_id', () => {
    expect(rlsApplicationsOwnRow(OWNER, OWNER)).toBe(true);
  });

  test('applications: cannot insert with another user_id', () => {
    expect(rlsApplicationsOwnRow(OWNER, OTHER)).toBe(false);
  });

  test('api_keys: owner can select key (via application ownership)', () => {
    expect(rlsApiKeysViaApplication(OWNER, OWNER)).toBe(true);
  });

  test('api_keys: other user cannot select key', () => {
    expect(rlsApiKeysViaApplication(OTHER, OWNER)).toBe(false);
  });

  test('api_keys: hard delete always blocked', () => {
    expect(rlsApiKeysDeletePolicy()).toBe(false);
  });
});


// ─── 9. TypeScript Type Shape Checks ─────────────────────────────────────────

describe('TypeScript Type Shape Checks', () => {
  test('ApplicationRow has required fields', () => {
    const row: ApplicationRow = {
      id: 'uuid',
      user_id: 'user-uuid',
      name: 'My App',
      description: null,
      environment: 'test',
      status: 'active',
      last_used_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(row.environment).toBe('test');
    expect(row.status).toBe('active');
  });

  test('ApplicationRow.environment is typed as AppEnvironment', () => {
    const envs: AppEnvironment[] = ['test', 'live'];
    for (const e of envs) {
      const row: ApplicationRow = {
        id: 'uuid', user_id: 'u', name: 'n', description: null,
        environment: e, status: 'active', last_used_at: null,
        created_at: 'ts', updated_at: 'ts',
      };
      expect(['test', 'live']).toContain(row.environment);
    }
  });

  test('ApiKeyAuthContext has all required fields', () => {
    const ctx: ApiKeyAuthContext = {
      applicationId: 'app-uuid',
      userId: 'user-uuid',
      keyType: 'secret',
      environment: 'live',
      permissions: { payments: ['read', 'write'] },
      keyId: 'key-uuid',
    };
    expect(ctx.keyType).toBe('secret');
    expect(ctx.environment).toBe('live');
  });

  test('PaymentRow application_id and environment are nullable', () => {
    const row: PaymentRow = {
      id: 'uuid',
      user_id: 'user-uuid',
      label: 'Test',
      amount: '10.00',
      currency: 'USDC',
      wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0BeB0',
      status: 'pending',
      tx_hash: null,
      expires_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      paid_at: null,
      verified_amount: null,
      metadata: null,
      // New nullable columns — backward-compatible
      application_id: null,
      environment: null,
    };
    expect(row.application_id).toBeNull();
    expect(row.environment).toBeNull();
  });

  test('ApiKeyPermissions accepts partial scope definitions', () => {
    const perms: ApiKeyPermissions = {
      payments: ['read', 'write'],
      webhooks: ['read'],
    };
    expect(perms.payments).toContain('write');
    expect(perms.webhooks).not.toContain('write');
  });
});


// ─── 10. Migration File Validation ───────────────────────────────────────────

describe('Migration 002 SQL file content', () => {
  const MIGRATION_PATH = path.resolve(
    __dirname,
    '../supabase/migrations/002_developer_infrastructure.sql',
  );

  let sql: string;

  beforeEach(() => {
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  test('migration file exists', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  test('creates applications table', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS applications/i);
  });

  test('creates api_keys table', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS api_keys/i);
  });

  test('enables RLS on applications', () => {
    // The ALTER and ENABLE are on the same line in the migration file
    expect(sql).toContain('ALTER TABLE applications ENABLE ROW LEVEL SECURITY');
  });

  test('enables RLS on api_keys', () => {
    expect(sql).toContain('ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY');
  });

  test('applications table has environment column with CHECK constraint', () => {
    // The CHECK constraint spans lines; test each piece independently
    expect(sql).toMatch(/environment\s+TEXT\s+NOT\s+NULL/i);
    expect(sql).toContain("CHECK (environment IN ('test', 'live'))");
  });

  test('api_keys table has key_hash column (never plaintext)', () => {
    expect(sql).toMatch(/key_hash\s+TEXT/i);
  });

  test('api_keys has UNIQUE constraint on key_hash', () => {
    expect(sql).toMatch(/UNIQUE.*key_hash|CONSTRAINT.*api_keys_unique_hash.*UNIQUE/i);
  });

  test('no plaintext/secret COLUMN DEFINITION in api_keys', () => {
    // Guard: no column named 'plaintext', 'secret_key', or 'raw_key' should
    // be declared inside the CREATE TABLE api_keys ( ... ) block.
    // Words like "plaintext" may legitimately appear in SQL comments that
    // document the security design; we only reject actual column definitions.
    // A column definition looks like:  <name>  <TYPE> (at start of token)
    expect(sql).not.toMatch(/^\s+plaintext\s+TEXT/im);
    expect(sql).not.toMatch(/^\s+secret_key\s+TEXT/im);
    expect(sql).not.toMatch(/^\s+raw_key\s+TEXT/im);
  });

  test('payments ALTER uses IF NOT EXISTS (idempotent)', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS application_id/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS environment/i);
  });

  test('validate_api_key function is SECURITY DEFINER', () => {
    expect(sql).toMatch(/SECURITY DEFINER/i);
  });

  test('migration has rollback comment/documentation', () => {
    // Rollback instructions are in the companion file; check the migration
    // has a header explaining it should not be auto-applied
    expect(sql).toMatch(/DO NOT EXECUTE IN PRODUCTION/i);
  });

  test('every CREATE INDEX uses IF NOT EXISTS', () => {
    const createIndexCount = (sql.match(/CREATE INDEX/gi) ?? []).length;
    const ifNotExistsCount = (sql.match(/CREATE INDEX IF NOT EXISTS/gi) ?? []).length;
    expect(createIndexCount).toBe(ifNotExistsCount);
  });

  test('RLS policy blocks hard-deletes on api_keys', () => {
    // The no-delete policy uses USING (false)
    expect(sql).toMatch(/USING\s*\(\s*false\s*\)/i);
  });

  test('migration 002 depends on migration 001 (payments table must exist)', () => {
    // The payments ALTER TABLE confirms the dependency exists
    expect(sql).toMatch(/ALTER TABLE payments/i);
  });
});


// ─── 11. Cross-Environment Access Guard ──────────────────────────────────────

describe('Cross-Environment Access Guard', () => {
  /**
   * This guard function mirrors what the middleware will implement.
   * Testing it here ensures the logic is correct before wiring it up.
   */
  function enforceEnvironmentIsolation(
    keyEnvironment: AppEnvironment,
    resourceEnvironment: AppEnvironment | null,
  ): 'allowed' | 'forbidden' {
    // NULL resource environment = dashboard payment; accessible by session auth,
    // NOT by API keys regardless of environment.
    if (resourceEnvironment === null) return 'forbidden';
    if (keyEnvironment !== resourceEnvironment) return 'forbidden';
    return 'allowed';
  }

  test('test key + test resource → allowed', () => {
    expect(enforceEnvironmentIsolation('test', 'test')).toBe('allowed');
  });

  test('live key + live resource → allowed', () => {
    expect(enforceEnvironmentIsolation('live', 'live')).toBe('allowed');
  });

  test('test key + live resource → forbidden', () => {
    expect(enforceEnvironmentIsolation('test', 'live')).toBe('forbidden');
  });

  test('live key + test resource → forbidden', () => {
    expect(enforceEnvironmentIsolation('live', 'test')).toBe('forbidden');
  });

  test('any API key + NULL environment (dashboard payment) → forbidden', () => {
    expect(enforceEnvironmentIsolation('test', null)).toBe('forbidden');
    expect(enforceEnvironmentIsolation('live', null)).toBe('forbidden');
  });
});

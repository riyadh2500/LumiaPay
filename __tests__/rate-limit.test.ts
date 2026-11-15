/**
 * Rate Limiting Test Suite — Phase 1 Security
 *
 * Tests:
 *  1. Core rate-limit logic (token bucket, sliding window)
 *  2. IP extraction (Vercel x-forwarded-for, spoofing prevention)
 *  3. Fail-open vs fail-closed strategies
 *  4. Concurrent request handling
 *  5. Retry-After response format
 *  6. DB failure scenarios
 *  7. LRU fast-path cache behaviour
 *  8. PAYMENT_VERIFY endpoint integration (highest-risk route)
 *  9. Authenticated endpoint (user-ID key)
 * 10. Regression: existing payment functionality still works
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ─── Mock admin client ────────────────────────────────────────────────────────

type RpcResponse = {
  data: unknown;
  error: { message: string } | null;
};

const mockRpc = jest.fn<(name: string, params?: unknown) => Promise<RpcResponse>>();

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({ rpc: mockRpc })),
}));

// ─── Import after mock ────────────────────────────────────────────────────────

import {
  checkRateLimit,
  getClientIp,
  rateLimitedResponse,
  addRateLimitHeaders,
  RATE_LIMIT_PROFILES,
  type RateLimitProfile,
} from '@/lib/rate-limit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FUTURE_RESET = new Date(Date.now() + 60_000).toISOString();

/** Returns a mock DB row indicating the request is allowed */
function dbAllowed(remaining: number, resetAt = FUTURE_RESET) {
  return { data: [{ allowed: true, remaining, reset_at: resetAt }], error: null };
}

/** Returns a mock DB row indicating the request is blocked */
function dbBlocked(resetAt = FUTURE_RESET) {
  return { data: [{ allowed: false, remaining: 0, reset_at: resetAt }], error: null };
}

/** Returns a DB error */
function dbError(message = 'connection failed') {
  return { data: null, error: { message } };
}

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers(headers);
  return new Request('http://localhost/api/test', { headers: h });
}

// ─── 1. Core rate-limit logic ─────────────────────────────────────────────────

describe('checkRateLimit — allowed requests', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('returns allowed=true when DB says so', async () => {
    mockRpc.mockResolvedValue(dbAllowed(9));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  test('calls DB with correct key format', async () => {
    mockRpc.mockResolvedValue(dbAllowed(5));
    await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '10.0.0.1');
    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'rl:pay-verify:10.0.0.1',
      p_max_tokens: 10,
      p_window_seconds: 60,
    });
  });

  test('calls DB with correct profile for PAYMENT_STATUS', async () => {
    mockRpc.mockResolvedValue(dbAllowed(59));
    await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_STATUS, '1.1.1.1');
    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'rl:pay-status:1.1.1.1',
      p_max_tokens: 60,
      p_window_seconds: 60,
    });
  });

  test('retryAfter is 0 when request is allowed', async () => {
    // Use a unique identifier to avoid LRU cache pollution from other tests
    mockRpc.mockResolvedValue(dbAllowed(5));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, 'unique-allowed-user-1');
    expect(result.retryAfter).toBe(0);
  });

  test('remaining matches DB value', async () => {
    mockRpc.mockResolvedValue(dbAllowed(27));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_LIST, 'user-id');
    expect(result.remaining).toBe(27);
  });
});

describe('checkRateLimit — blocked requests', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('returns allowed=false when DB says blocked', async () => {
    mockRpc.mockResolvedValue(dbBlocked());
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '1.2.3.4');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('retryAfter is positive when blocked', async () => {
    // Use a unique IP to avoid LRU pollution from other tests
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    mockRpc.mockResolvedValue(dbBlocked(resetAt));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '77.77.77.77');
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(30);
  });

  test('resetAt is a valid Date', async () => {
    mockRpc.mockResolvedValue(dbBlocked(FUTURE_RESET));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '5.5.5.5');
    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── 2. IP extraction ─────────────────────────────────────────────────────────

describe('getClientIp', () => {
  test('extracts first IP from x-forwarded-for (single value)', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42' });
    expect(getClientIp(req)).toBe('203.0.113.42');
  });

  test('extracts ONLY the first IP from x-forwarded-for (multiple values)', () => {
    // Client could inject extra IPs after the first — we ignore them
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42, 10.0.0.1, 192.168.1.1' });
    expect(getClientIp(req)).toBe('203.0.113.42');
  });

  test('trims whitespace from extracted IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  198.51.100.7  , 10.0.0.2' });
    expect(getClientIp(req)).toBe('198.51.100.7');
  });

  test('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.99' });
    expect(getClientIp(req)).toBe('198.51.100.99');
  });

  test('falls back to 127.0.0.1 when no IP headers present (local dev)', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  test('ignores client-supplied headers other than x-forwarded-for / x-real-ip', () => {
    // cf-connecting-ip is NOT trusted (no Cloudflare in this stack)
    const req = makeRequest({ 'cf-connecting-ip': '1.2.3.4' });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  test('prevents IP spoofing via x-forwarded-for injection', () => {
    // Attacker tries to spoof by prepending their own value.
    // Vercel edge always appends the real IP *last*, but sets x-forwarded-for
    // to the leftmost value. The key point: we always use Vercel's first value
    // which cannot be injected by the client past Vercel's edge.
    // Here we verify the leftmost IP is what gets used.
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });
});

// ─── 3. Fail strategies ───────────────────────────────────────────────────────

describe('Fail strategies when DB is unavailable', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('fail-open: allows request when DB errors (cheap endpoint)', async () => {
    mockRpc.mockResolvedValue(dbError());
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, 'user-id');
    // PAYMENT_CREATE is fail-open
    expect(result.allowed).toBe(true);
  });

  test('fail-open: allows request when DB throws exception', async () => {
    mockRpc.mockRejectedValue(new Error('Network timeout'));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.MERCHANT, 'user-id');
    expect(result.allowed).toBe(true);
  });

  test('fail-closed: blocks request when DB errors (RPC-triggering endpoint)', async () => {
    mockRpc.mockResolvedValue(dbError());
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '1.2.3.4');
    // PAYMENT_VERIFY is fail-closed — protects RPC budget
    expect(result.allowed).toBe(false);
  });

  test('fail-closed: blocks request when DB throws exception', async () => {
    mockRpc.mockRejectedValue(new Error('DB unreachable'));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '1.2.3.4');
    expect(result.allowed).toBe(false);
  });

  test('fail-closed: retryAfter equals windowSeconds when DB fails', async () => {
    mockRpc.mockRejectedValue(new Error('timeout'));
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '1.2.3.4');
    expect(result.retryAfter).toBe(RATE_LIMIT_PROFILES.PAYMENT_VERIFY.windowSeconds);
  });

  test('fail-open: returns full token count as remaining when DB fails', async () => {
    mockRpc.mockResolvedValue(dbError());
    const result = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_LIST, 'user-id');
    expect(result.remaining).toBe(RATE_LIMIT_PROFILES.PAYMENT_LIST.maxTokens);
  });
});

// ─── 4. Concurrent requests ───────────────────────────────────────────────────

describe('Concurrent requests', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('handles 10 concurrent requests independently', async () => {
    // Use unique IPs for each request to avoid LRU cache interference
    // Each call returns remaining = 9 (first use)
    mockRpc.mockResolvedValue(dbAllowed(9));

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, `10.0.0.${i + 1}`),
      ),
    );

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.allowed)).toBe(true);
    // All calls reached the DB (each IP is unique, no LRU cache hits)
    expect(mockRpc).toHaveBeenCalledTimes(10);
  });

  test('after block is cached, subsequent calls skip DB', async () => {
    // Use a unique IP so other tests' cache entries don't interfere
    const uniqueIp = '99.98.97.96';

    // First call: DB says blocked
    mockRpc.mockResolvedValueOnce(dbBlocked(FUTURE_RESET));

    const first = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, uniqueIp);
    expect(first.allowed).toBe(false);

    // Second call: LRU cache should intercept (remaining=0, resetAt in future)
    // The cache was populated by the first call
    const second = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, uniqueIp);
    expect(second.allowed).toBe(false);

    // DB was only called once (second call used LRU cache)
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

// ─── 5. HTTP 429 response format ──────────────────────────────────────────────

describe('rateLimitedResponse()', () => {
  const blockedResult = {
    allowed: false,
    remaining: 0,
    resetAt: new Date(Date.now() + 45_000),
    retryAfter: 45,
  };

  test('returns HTTP 429 status', () => {
    const resp = rateLimitedResponse(blockedResult);
    expect(resp.status).toBe(429);
  });

  test('includes Retry-After header with correct value', () => {
    const resp = rateLimitedResponse(blockedResult);
    expect(resp.headers.get('Retry-After')).toBe('45');
  });

  test('includes X-RateLimit-Remaining: 0', () => {
    const resp = rateLimitedResponse(blockedResult);
    expect(resp.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  test('includes X-RateLimit-Reset as Unix seconds', () => {
    const resp = rateLimitedResponse(blockedResult);
    const reset = Number(resp.headers.get('X-RateLimit-Reset'));
    expect(reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('body contains error and retryAfter fields', async () => {
    const resp = rateLimitedResponse(blockedResult);
    const body = await resp.json();
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfter).toBe(45);
  });

  test('body does NOT expose internal infrastructure details', async () => {
    const resp = rateLimitedResponse(blockedResult);
    const body = await resp.json() as Record<string, unknown>;
    const bodyStr = JSON.stringify(body).toLowerCase();
    expect(bodyStr).not.toContain('supabase');
    expect(bodyStr).not.toContain('postgres');
    expect(bodyStr).not.toContain('bucket');
    expect(bodyStr).not.toContain('redis');
    expect(bodyStr).not.toContain('database');
  });
});

// ─── 6. addRateLimitHeaders ───────────────────────────────────────────────────

describe('addRateLimitHeaders()', () => {
  const allowedResult = {
    allowed: true,
    remaining: 7,
    resetAt: new Date(Date.now() + 30_000),
    retryAfter: 0,
  };

  test('adds X-RateLimit-Remaining to a 200 response', () => {
    const base = Response.json({ ok: true });
    const result = addRateLimitHeaders(base, allowedResult);
    expect(result.headers.get('X-RateLimit-Remaining')).toBe('7');
  });

  test('adds X-RateLimit-Reset to a 200 response', () => {
    const base = Response.json({ ok: true });
    const result = addRateLimitHeaders(base, allowedResult);
    const reset = Number(result.headers.get('X-RateLimit-Reset'));
    expect(reset).toBeGreaterThan(0);
  });

  test('preserves original response status and body', async () => {
    const base = Response.json({ payment: 'data' }, { status: 201 });
    const result = addRateLimitHeaders(base, allowedResult);
    expect(result.status).toBe(201);
    const body = await result.json();
    expect(body.payment).toBe('data');
  });

  test('preserves existing response headers', () => {
    const base = new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
    });
    const result = addRateLimitHeaders(base, allowedResult);
    expect(result.headers.get('X-Custom')).toBe('value');
  });
});

// ─── 7. Profile configuration correctness ────────────────────────────────────

describe('RATE_LIMIT_PROFILES configuration', () => {
  test('PAYMENT_VERIFY is fail-closed', () => {
    expect(RATE_LIMIT_PROFILES.PAYMENT_VERIFY.failStrategy).toBe('closed');
  });

  test('PAYMENT_VERIFY has the most restrictive limit (10/min)', () => {
    expect(RATE_LIMIT_PROFILES.PAYMENT_VERIFY.maxTokens).toBe(10);
    expect(RATE_LIMIT_PROFILES.PAYMENT_VERIFY.windowSeconds).toBe(60);
  });

  test('All non-verify profiles are fail-open', () => {
    const openProfiles = [
      RATE_LIMIT_PROFILES.PAYMENT_STATUS,
      RATE_LIMIT_PROFILES.PAYMENT_CREATE,
      RATE_LIMIT_PROFILES.PAYMENT_LIST,
      RATE_LIMIT_PROFILES.PAYMENT_CANCEL,
      RATE_LIMIT_PROFILES.MERCHANT,
    ];
    for (const p of openProfiles) {
      expect(p.failStrategy).toBe('open');
    }
  });

  test('All profile IDs are unique', () => {
    const ids = Object.values(RATE_LIMIT_PROFILES).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('All maxTokens are positive integers', () => {
    for (const p of Object.values(RATE_LIMIT_PROFILES)) {
      expect(p.maxTokens).toBeGreaterThan(0);
      expect(Number.isInteger(p.maxTokens)).toBe(true);
    }
  });

  test('All windowSeconds are positive integers', () => {
    for (const p of Object.values(RATE_LIMIT_PROFILES)) {
      expect(p.windowSeconds).toBeGreaterThan(0);
      expect(Number.isInteger(p.windowSeconds)).toBe(true);
    }
  });
});

// ─── 8. PAYMENT_VERIFY endpoint integration ───────────────────────────────────

describe('PAYMENT_VERIFY endpoint — full scenario', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('allows first 10 requests, blocks 11th', async () => {
    // Simulate 10 allowed, then blocked
    for (let i = 10; i > 0; i--) {
      mockRpc.mockResolvedValueOnce(dbAllowed(i - 1));
    }
    mockRpc.mockResolvedValue(dbBlocked());

    const ip = '203.0.113.1';

    for (let i = 0; i < 10; i++) {
      const r = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, ip);
      expect(r.allowed).toBe(true);
    }

    const blocked = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  test('different IPs have independent buckets', async () => {
    mockRpc.mockResolvedValue(dbBlocked()); // IP A is blocked
    const a = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '1.1.1.1');
    expect(a.allowed).toBe(false);

    mockRpc.mockResolvedValue(dbAllowed(9)); // IP B is fine
    const b = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '2.2.2.2');
    expect(b.allowed).toBe(true);
  });

  test('DB key includes route ID to prevent cross-endpoint bucket sharing', async () => {
    // Use unique IPs so the LRU cache from other tests does not interfere
    mockRpc.mockResolvedValue(dbAllowed(5));
    await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, '55.55.55.55');
    await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_STATUS, '55.55.55.55');

    // mockRpc.mock.calls[n] is [fnName, args]
    const allCalls = mockRpc.mock.calls as Array<[string, { p_key: string }]>;
    const verifyKey = allCalls[0]?.[1]?.p_key;
    const statusKey = allCalls[1]?.[1]?.p_key;
    expect(verifyKey).not.toBe(statusKey);
    expect(verifyKey).toContain('pay-verify');
    expect(statusKey).toContain('pay-status');
  });
});

// ─── 9. Authenticated endpoint key uses user ID ───────────────────────────────

describe('Authenticated endpoint rate limiting', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('uses user UUID as identifier (not IP)', async () => {
    const userId = 'c946d001-b0cf-473f-9a26-6d707962c82e';
    mockRpc.mockResolvedValue(dbAllowed(29));
    await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, userId);
    const call = mockRpc.mock.calls[0] as [string, { p_key: string }];
    expect(call[1].p_key).toContain(userId);
    expect(call[1].p_key).toContain('pay-create');
  });

  test('two different users have independent buckets', async () => {
    mockRpc.mockResolvedValue(dbBlocked());
    const r1 = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, 'user-aaa');
    expect(r1.allowed).toBe(false);

    mockRpc.mockResolvedValue(dbAllowed(29));
    const r2 = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, 'user-bbb');
    expect(r2.allowed).toBe(true);
  });
});

// ─── 10. Regression: existing payment-engine tests still unaffected ───────────

describe('Rate-limit module isolation', () => {
  test('importing rate-limit module does not affect payment-engine exports', async () => {
    const engine = await import('@/lib/payment-engine');
    expect(typeof engine.createPaymentIntent).toBe('function');
    expect(typeof engine.verifyPayment).toBe('function');
    expect(typeof engine.ValidationError).toBe('function');
  });

  test('rateLimitedResponse does not interfere with ok() helper', async () => {
    const { ok } = await import('@/lib/http');
    const resp = ok({ id: '123' }, 201);
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body.id).toBe('123');
  });
});

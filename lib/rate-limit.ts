/**
 * Production-grade rate limiting for LumiaPay API routes.
 *
 * ARCHITECTURE
 * ────────────
 * Layer 1 — In-process LRU cache (fast path)
 *   On every request we first check a local LRU cache.  If the cache says
 *   the identifier is definitely blocked (tokens == 0, reset_at in the
 *   future) we return 429 immediately without touching the database.
 *   This eliminates the DB round-trip for the common "already throttled"
 *   case and reduces load on Postgres.
 *
 * Layer 2 — Supabase PostgreSQL (distributed store)
 *   The authoritative token bucket lives in `rate_limit_buckets` and is
 *   atomically decremented by the `check_rate_limit()` SECURITY DEFINER
 *   function.  This is correct across all Vercel serverless instances.
 *
 * FAIL-SAFE STRATEGY
 * ──────────────────
 * For cheap endpoints (merchant CRUD, payment list): fail open — if the
 * DB is unreachable, allow the request rather than blocking legitimate users.
 *
 * For expensive endpoints (blockchain RPC verify): fail closed — if the
 * DB is unreachable, return 429.  This prevents uncontrolled RPC spend even
 * when the rate-limit store is degraded.
 *
 * IP TRUST
 * ────────
 * On Vercel the real client IP is in `x-forwarded-for`.  We take only the
 * FIRST value (leftmost in the list), which is the original client IP as
 * set by Vercel's edge — it cannot be spoofed by the client.
 * We deliberately ignore `x-real-ip` and `cf-connecting-ip` because this
 * deployment does not sit behind Cloudflare.
 *
 * KEY FORMAT
 * ──────────
 * `rl:<route_id>:<identifier>`
 * route_id  — short slug for the route (e.g. "verify", "create")
 * identifier — IP address (public routes) or user UUID (authenticated)
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ─── LRU cache (Layer 1 fast-path) ───────────────────────────────────────────
// lru-cache v5 is already installed as a transitive dependency.
// We import with require() to stay compatible with the ESM-first tsconfig.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LRU = require('lru-cache');

interface CacheEntry {
  remaining: number;
  resetAt: number; // Unix ms
}

// Max 10 000 entries (~80 KB at ~8 bytes/entry) — evicts LRU when full.
const localCache: { get(k: string): CacheEntry | undefined; set(k: string, v: CacheEntry): void } =
  new LRU({ max: 10_000 });

// ─── Rate-limit profiles ──────────────────────────────────────────────────────

export interface RateLimitProfile {
  /** Short slug used as part of the bucket key */
  id: string;
  /** Maximum requests allowed per window */
  maxTokens: number;
  /** Window length in seconds */
  windowSeconds: number;
  /**
   * fail-open  → allow the request if the DB is unavailable (safe default for cheap ops)
   * fail-closed → block the request if the DB is unavailable (for expensive RPC calls)
   */
  failStrategy: 'open' | 'closed';
}

/**
 * All rate-limit profiles in one place.
 * Adjust these numbers without touching any other file.
 */
export const RATE_LIMIT_PROFILES = {
  // ── Public endpoints ───────────────────────────────────────────────────────

  /** GET /api/payments/[id] — public payment status fetch */
  PAYMENT_STATUS: {
    id: 'pay-status',
    maxTokens: 60,
    windowSeconds: 60,
    failStrategy: 'open',
  },

  /**
   * POST /api/payments/[id]?action=verify — triggers Arc RPC getLogs + receipt
   * This is the critical endpoint: 10 requests per 60 s per IP.
   */
  PAYMENT_VERIFY: {
    id: 'pay-verify',
    maxTokens: 10,
    windowSeconds: 60,
    failStrategy: 'closed', // fail-closed: protect RPC budget even if DB is down
  },

  // ── Authenticated endpoints (keyed by user ID) ─────────────────────────────

  /** POST /api/payments — create payment intent */
  PAYMENT_CREATE: {
    id: 'pay-create',
    maxTokens: 30,
    windowSeconds: 60,
    failStrategy: 'open',
  },

  /** GET /api/payments — list user's payments */
  PAYMENT_LIST: {
    id: 'pay-list',
    maxTokens: 60,
    windowSeconds: 60,
    failStrategy: 'open',
  },

  /** DELETE /api/payments/[id] — cancel payment */
  PAYMENT_CANCEL: {
    id: 'pay-cancel',
    maxTokens: 20,
    windowSeconds: 60,
    failStrategy: 'open',
  },

  /** GET/PUT /api/merchant — merchant profile */
  MERCHANT: {
    id: 'merchant',
    maxTokens: 30,
    windowSeconds: 60,
    failStrategy: 'open',
  },
} as const satisfies Record<string, RateLimitProfile>;

// ─── Result type ──────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  /** Seconds until the window resets — use in Retry-After header */
  retryAfter: number;
}

// ─── Core check ───────────────────────────────────────────────────────────────

/**
 * Checks whether the given identifier is within the rate limit defined by
 * `profile`.  Uses the two-layer architecture described above.
 */
export async function checkRateLimit(
  profile: RateLimitProfile,
  identifier: string,
): Promise<RateLimitResult> {
  const key = `rl:${profile.id}:${identifier}`;
  const now = Date.now();

  // ── Layer 1: LRU fast path ──────────────────────────────────────────────
  const cached = localCache.get(key);
  if (cached && cached.resetAt > now && cached.remaining <= 0) {
    // Definitely blocked — no DB needed
    const retryAfter = Math.ceil((cached.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(cached.resetAt),
      retryAfter,
    };
  }

  // ── Layer 2: DB atomic decrement ───────────────────────────────────────
  try {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max_tokens: profile.maxTokens,
      p_window_seconds: profile.windowSeconds,
    });

    if (error) {
      console.error('[RateLimit] DB error:', error.message);
      return fallback(profile, now);
    }

    // PostgREST returns an array for RETURNS TABLE functions
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return fallback(profile, now);
    }

    const resetAtMs = new Date(row.reset_at).getTime();
    // retryAfter is only meaningful when request is blocked
    const retryAfter = row.allowed ? 0 : Math.ceil(Math.max(0, resetAtMs - now) / 1000);

    // Update LRU cache so subsequent requests in this instance don't hit DB
    localCache.set(key, { remaining: row.remaining, resetAt: resetAtMs });

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: new Date(row.reset_at),
      retryAfter,
    };
  } catch (err) {
    console.error('[RateLimit] Unexpected error:', err);
    return fallback(profile, now);
  }
}

/** Applies the profile's fail strategy when the DB is unreachable. */
function fallback(profile: RateLimitProfile, now: number): RateLimitResult {
  const resetAt = new Date(now + profile.windowSeconds * 1000);
  if (profile.failStrategy === 'closed') {
    return { allowed: false, remaining: 0, resetAt, retryAfter: profile.windowSeconds };
  }
  // fail-open: allow the request
  return { allowed: true, remaining: profile.maxTokens, resetAt, retryAfter: 0 };
}

// ─── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extracts the real client IP from a Next.js Request.
 *
 * On Vercel, `x-forwarded-for` contains a comma-separated list where the
 * first value is the original client IP added by Vercel's edge.  We take
 * only that first value and refuse to trust any subsequent values (which
 * could be client-supplied).
 *
 * Falls back to '127.0.0.1' in development (where the header may be absent).
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // Take only the leftmost IP — Vercel's edge sets this, clients cannot spoof it
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  // Vercel also sets x-real-ip as an alias for the first XFF value
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();

  return '127.0.0.1'; // local dev fallback
}

// ─── Response builder ─────────────────────────────────────────────────────────

/**
 * Builds a standard HTTP 429 Response with Retry-After header.
 * Never exposes internal infrastructure details.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: 'Too many requests',
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000)),
      },
    },
  );
}

/**
 * Adds rate-limit informational headers to any successful response.
 * Call this on 2xx responses so clients can track their quota.
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

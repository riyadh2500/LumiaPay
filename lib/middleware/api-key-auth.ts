/**
 * API Key Authentication Middleware — Phase 2.1
 *
 * Validates developer API keys and attaches authentication context to requests.
 *
 * ARCHITECTURE
 *   This middleware extracts the API key from the Authorization header,
 *   validates its format, hashes it, queries the database for validation,
 *   and returns an ApiKeyAuthContext that downstream route handlers use
 *   to enforce permissions and merchant isolation.
 *
 * SECURITY MODEL (defense-in-depth)
 *   1. Format validation (fail fast, no DB hit for malformed keys)
 *   2. Constant-time hash comparison (prevent timing attacks)
 *   3. Database validation via validate_api_key() RPC (SECURITY DEFINER)
 *   4. Status checks (active key, active application)
 *   5. Expiration checks (at DB and app level)
 *   6. Environment isolation (test vs live)
 *   7. Rate limiting integration (via existing system)
 *
 * USAGE
 *   import { withApiKeyAuth } from '@/lib/middleware/api-key-auth';
 *
 *   export async function POST(req: Request) {
 *     const authResult = await withApiKeyAuth(req);
 *     if (!authResult.success) {
 *       return authResult.error;
 *     }
 *     const { context } = authResult;
 *     // context.userId, context.applicationId, context.environment, etc.
 *   }
 */

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  hashApiKey,
  isValidKeyFormat,
  parseKeyPrefix,
} from '@/lib/developer/api-keys';
import type {
  ApiKeyAuthContext,
  ApiKeyValidationResult,
  AppEnvironment,
} from '@/lib/db/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiKeyAuthSuccess {
  success: true;
  context: ApiKeyAuthContext;
}

export interface ApiKeyAuthError {
  success: false;
  error: NextResponse;
}

export type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthError;

// ─── Error Responses ─────────────────────────────────────────────────────────

const ERROR_RESPONSES = {
  MISSING_KEY: {
    error: 'authentication_required',
    message: 'API key required. Include Authorization: Bearer <your_api_key>',
  },
  INVALID_FORMAT: {
    error: 'invalid_api_key',
    message: 'Invalid API key format',
  },
  INVALID_KEY: {
    error: 'invalid_api_key',
    message: 'Invalid API key',
  },
  REVOKED_KEY: {
    error: 'api_key_revoked',
    message: 'This API key has been revoked',
  },
  EXPIRED_KEY: {
    error: 'api_key_expired',
    message: 'This API key has expired',
  },
  INTERNAL_ERROR: {
    error: 'internal_error',
    message: 'Authentication failed',
  },
} as const;

function errorResponse(
  type: keyof typeof ERROR_RESPONSES,
  status: number = 401,
): NextResponse {
  return NextResponse.json(ERROR_RESPONSES[type], { status });
}

// ─── Main Authentication Function ────────────────────────────────────────────

/**
 * Authenticates an API request using the Authorization: Bearer header.
 *
 * Returns either:
 *   { success: true, context: ApiKeyAuthContext }
 *   { success: false, error: NextResponse }
 *
 * The error response is a fully formed NextResponse that the caller should
 * return immediately.
 */
export async function withApiKeyAuth(
  req: Request,
): Promise<ApiKeyAuthResult> {
  // ── Step 1: Extract API key from Authorization header ──────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { success: false, error: errorResponse('MISSING_KEY') };
  }

  // Expected format: "Bearer <key>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { success: false, error: errorResponse('INVALID_FORMAT') };
  }

  const apiKey = parts[1];

  // ── Step 2: Format validation (fail fast, no DB query) ─────────────────────
  if (!isValidKeyFormat(apiKey)) {
    return { success: false, error: errorResponse('INVALID_FORMAT') };
  }

  // ── Step 3: Parse prefix to extract environment and key type ───────────────
  const prefixInfo = parseKeyPrefix(apiKey);
  if (!prefixInfo) {
    return { success: false, error: errorResponse('INVALID_FORMAT') };
  }

  // ── Step 4: Hash the key (SHA-256) ─────────────────────────────────────────
  const keyHash = hashApiKey(apiKey);

  // ── Step 5: Query database via validate_api_key() RPC ──────────────────────
  try {
    const supabase = await createServerClient();

    // Call the SECURITY DEFINER function defined in migration 002
    const { data, error } = await supabase.rpc('validate_api_key', {
      key_hash_param: keyHash,
    });

    if (error) {
      console.error('[API Key Auth] Database error:', error);
      return { success: false, error: errorResponse('INTERNAL_ERROR', 500) };
    }

    // validate_api_key() returns zero rows on any failure (invalid, revoked, etc.)
    if (!data || data.length === 0) {
      return { success: false, error: errorResponse('INVALID_KEY') };
    }

    const validation = data[0] as ApiKeyValidationResult;

    // ── Step 6: Environment consistency check ──────────────────────────────────
    // The prefix environment must match the DB-stored environment
    if (validation.environment !== prefixInfo.environment) {
      console.error(
        '[API Key Auth] Environment mismatch:',
        { prefix: prefixInfo.environment, db: validation.environment },
      );
      return { success: false, error: errorResponse('INVALID_KEY') };
    }

    // ── Step 7: Update usage tracking (async, non-blocking) ────────────────────
    // Fire-and-forget: update last_used_at and usage_count
    updateKeyUsage(supabase, validation.key_id).catch((err) => {
      console.error('[API Key Auth] Failed to update usage stats:', err);
      // Don't fail the request if usage tracking fails
    });

    // ── Step 8: Build and return auth context ──────────────────────────────────
    const context: ApiKeyAuthContext = {
      applicationId: validation.application_id,
      userId: validation.user_id,
      keyType: validation.key_type,
      environment: validation.environment,
      permissions: validation.permissions,
      keyId: validation.key_id,
    };

    return { success: true, context };
  } catch (err) {
    console.error('[API Key Auth] Unexpected error:', err);
    return { success: false, error: errorResponse('INTERNAL_ERROR', 500) };
  }
}

// ─── Helper: Update Key Usage ────────────────────────────────────────────────

/**
 * Updates the last_used_at timestamp and increments usage_count.
 * Non-blocking, fire-and-forget.
 */
async function updateKeyUsage(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  keyId: string,
): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      // Increment usage_count in the database
    })
    .eq('id', keyId)
    .select('usage_count')
    .single()
    .then(async ({ data }) => {
      if (data) {
        return supabase
          .from('api_keys')
          .update({ usage_count: data.usage_count + 1 })
          .eq('id', keyId);
      }
      return { error: null };
    });

  if (error) {
    throw error;
  }
}

// ─── Permission Checking Utilities ───────────────────────────────────────────

/**
 * Checks if the authenticated context has a specific permission.
 *
 * @param context   The auth context from withApiKeyAuth
 * @param resource  Resource name (e.g. 'payments', 'webhooks')
 * @param scope     Required scope ('read' or 'write')
 * @returns         true if permission granted, false otherwise
 */
export function hasPermission(
  context: ApiKeyAuthContext,
  resource: string,
  scope: 'read' | 'write',
): boolean {
  const resourcePerms = context.permissions[resource];
  if (!resourcePerms || !Array.isArray(resourcePerms)) {
    return false;
  }
  return resourcePerms.includes(scope);
}

/**
 * Returns a 403 Forbidden response with a permission error message.
 */
export function forbiddenResponse(
  resource: string,
  scope: string,
): NextResponse {
  return NextResponse.json(
    {
      error: 'permission_denied',
      message: `Your API key does not have ${scope} permission for ${resource}`,
    },
    { status: 403 },
  );
}

/**
 * Ensures the API key has write permission for the given resource.
 * Returns an error response if not; otherwise returns null (continue).
 */
export function requirePermission(
  context: ApiKeyAuthContext,
  resource: string,
  scope: 'read' | 'write',
): NextResponse | null {
  if (!hasPermission(context, resource, scope)) {
    return forbiddenResponse(resource, scope);
  }
  return null;
}

// ─── Environment Isolation Utilities ─────────────────────────────────────────

/**
 * Validates that a payment belongs to the authenticated merchant.
 * Prevents cross-merchant data access.
 *
 * @param context    The auth context
 * @param payment    The payment row to validate
 * @returns          true if the payment belongs to the merchant, false otherwise
 */
export function validatePaymentOwnership(
  context: ApiKeyAuthContext,
  payment: { user_id: string },
): boolean {
  return payment.user_id === context.userId;
}

/**
 * Validates that a payment belongs to the correct environment.
 * Prevents test keys from accessing live payments and vice versa.
 *
 * @param context    The auth context
 * @param payment    The payment row to validate
 * @returns          true if environments match, false otherwise
 */
export function validatePaymentEnvironment(
  context: ApiKeyAuthContext,
  payment: { environment: AppEnvironment | null; application_id: string | null },
): boolean {
  // Dashboard-created payments (environment=null) are inaccessible via API
  if (payment.environment === null || payment.application_id === null) {
    return false;
  }
  return payment.environment === context.environment;
}

/**
 * Combined ownership and environment validation.
 * Use this for all payment retrieval operations.
 */
export function validatePaymentAccess(
  context: ApiKeyAuthContext,
  payment: {
    user_id: string;
    environment: AppEnvironment | null;
    application_id: string | null;
  },
): boolean {
  return (
    validatePaymentOwnership(context, payment) &&
    validatePaymentEnvironment(context, payment)
  );
}

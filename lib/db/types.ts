/**
 * LumiaPay Database Types — Phase 2.1
 *
 * Manual TypeScript representations of every Supabase table row.
 * These augment (not replace) the existing types in lib/payment-engine/payment-types.ts.
 *
 * CONVENTIONS
 *   • Column names match the database schema exactly (snake_case).
 *   • Nullable columns use `T | null`.
 *   • Timestamps are ISO-8601 strings as returned by Supabase's JSON layer.
 *   • Insert / Update variants omit server-defaulted fields (id, created_at …)
 *     and mark optional fields with `?`.
 *
 * BACKWARD COMPATIBILITY
 *   The existing PaymentIntent type (lib/payment-engine/payment-types.ts) is
 *   intentionally preserved.  PaymentRow here is the raw DB row; it adds the
 *   two new nullable columns introduced in migration 002.
 *
 * DO NOT auto-generate from Supabase CLI until migration 002 is applied to
 * the hosted project, as the remote schema will not yet contain these columns.
 */

// ─── Shared primitives ───────────────────────────────────────────────────────

/** ISO-8601 timestamp string as returned by Supabase/PostgREST. */
export type ISOTimestamp = string;

/** UUID v4 string. */
export type UUID = string;

/** Supported stablecoin symbols on Arc Network. */
export type TokenSymbol = 'USDC' | 'EURC';

/** All reachable payment states (unchanged from Phase 1). */
export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'detecting'
  | 'verifying'
  | 'paid'
  | 'underpaid'
  | 'overpaid'
  | 'expired'
  | 'failed'
  | 'review_required';

/**
 * Environment an application or payment belongs to.
 *   test → no real blockchain interaction; payments are simulated
 *   live → real Arc network transactions
 */
export type AppEnvironment = 'test' | 'live';

/** Lifecycle status of a developer application. */
export type ApplicationStatus = 'active' | 'suspended' | 'deleted';

/** Lifecycle status of an API key. */
export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

/** Which operations a key may perform. */
export type ApiKeyType = 'publishable' | 'secret';

// ─── EXISTING TABLE: merchants ───────────────────────────────────────────────
// (Defined here for reference; not modified by migration 002.)

export interface MerchantRow {
  id: UUID;
  user_id: UUID;
  wallet_address: string;
  business_name: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp | null;
}

// ─── EXISTING TABLE: payments ────────────────────────────────────────────────
// Extended by migration 002: application_id and environment added as nullable
// columns so all existing rows remain valid.

export interface PaymentRow {
  id: UUID;
  user_id: UUID;
  label: string;
  amount: string;           // Decimal string — avoids float rounding
  currency: TokenSymbol;
  wallet_address: string;
  status: PaymentStatus;
  tx_hash: string | null;
  expires_at: ISOTimestamp;
  created_at: ISOTimestamp;
  paid_at: ISOTimestamp | null;
  verified_amount: string | null;
  metadata: Record<string, unknown> | null;

  // ── Added by migration 002 (nullable for backward compat) ──────────────
  /** ID of the developer application that created this payment.
   *  NULL when created via the merchant dashboard. */
  application_id: UUID | null;

  /** Mirrors applications.environment.  NULL for dashboard payments. */
  environment: AppEnvironment | null;
}

export type PaymentInsert = Omit<
  PaymentRow,
  'id' | 'created_at' | 'paid_at' | 'tx_hash' | 'verified_amount' | 'metadata'
> & {
  tx_hash?: string | null;
  verified_amount?: string | null;
  metadata?: Record<string, unknown>;
  application_id?: UUID | null;
  environment?: AppEnvironment | null;
};

// ─── EXISTING TABLE: payment_events ─────────────────────────────────────────
// Extended by migration 002: application_id added as nullable column.

export interface PaymentEventRow {
  id: UUID;
  payment_id: UUID;
  user_id: UUID;
  event_type: string;
  status: PaymentStatus;
  data: Record<string, unknown>;
  processed: boolean;
  created_at: ISOTimestamp;

  // ── Added by migration 002 ──────────────────────────────────────────────
  /** Developer application associated with this event.  May be NULL. */
  application_id: UUID | null;
}

// ─── EXISTING TABLE: payment_transactions ───────────────────────────────────
// Not modified by migration 002.

export interface PaymentTransactionRow {
  id: UUID;
  payment_id: UUID;
  tx_hash: string;
  verified_amount: string;
  verified_at: ISOTimestamp;
  created_at: ISOTimestamp;
}

// ─── NEW TABLE: applications ─────────────────────────────────────────────────
// Introduced by migration 002.

export interface ApplicationRow {
  id: UUID;
  user_id: UUID;
  name: string;
  description: string | null;
  environment: AppEnvironment;
  status: ApplicationStatus;
  last_used_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

/** Fields required when inserting a new application row. */
export type ApplicationInsert = {
  user_id: UUID;
  name: string;
  environment: AppEnvironment;
  description?: string | null;
  status?: ApplicationStatus;        // defaults to 'active'
};

/** Fields allowed in an UPDATE. */
export type ApplicationUpdate = Partial<Pick<
  ApplicationRow,
  'name' | 'description' | 'status' | 'last_used_at'
>>;

// ─── NEW TABLE: api_keys ─────────────────────────────────────────────────────
// Introduced by migration 002.

export interface ApiKeyRow {
  id: UUID;
  application_id: UUID;
  name: string;
  key_type: ApiKeyType;

  /**
   * SHA-256 hex digest of the plaintext key.
   * The plaintext is shown exactly once and NEVER persisted.
   */
  key_hash: string;

  /**
   * Display-only prefix (non-secret), e.g. "sk_test_abc123…".
   * No secret material — safe to show in the UI.
   */
  key_prefix: string;

  /**
   * Permitted API scopes for this key.
   * Example: { "payments": ["read", "write"], "webhooks": ["read"] }
   */
  permissions: ApiKeyPermissions;

  status: ApiKeyStatus;
  usage_count: number;
  last_used_at: ISOTimestamp | null;
  expires_at: ISOTimestamp | null;
  revoked_at: ISOTimestamp | null;
  revoked_reason: string | null;
  created_at: ISOTimestamp;
}

/** Permissions JSON shape stored in api_keys.permissions. */
export interface ApiKeyPermissions {
  payments?: ApiKeyScope[];
  webhooks?: ApiKeyScope[];
  [resource: string]: ApiKeyScope[] | undefined;
}

export type ApiKeyScope = 'read' | 'write';

/** Fields required when inserting a new API key row. */
export type ApiKeyInsert = {
  application_id: UUID;
  name: string;
  key_type: ApiKeyType;
  key_hash: string;        // SHA-256 of plaintext key — computed before insert
  key_prefix: string;      // Non-secret display prefix
  permissions?: ApiKeyPermissions;
  status?: ApiKeyStatus;   // defaults to 'active'
  expires_at?: ISOTimestamp | null;
};

/** Fields allowed in an UPDATE. */
export type ApiKeyUpdate = Partial<Pick<
  ApiKeyRow,
  | 'name'
  | 'permissions'
  | 'status'
  | 'last_used_at'
  | 'usage_count'
  | 'revoked_at'
  | 'revoked_reason'
>>;

// ─── Returned by validate_api_key() DB function ──────────────────────────────

/**
 * Shape returned by the validate_api_key(key_hash) RPC function.
 * This is the minimal context needed to authenticate and authorise a request.
 */
export interface ApiKeyValidationResult {
  key_id: UUID;
  application_id: UUID;
  user_id: UUID;
  key_type: ApiKeyType;
  environment: AppEnvironment;
  permissions: ApiKeyPermissions;
}

// ─── Returned by get_application_payment_stats() DB function ────────────────

export interface ApplicationPaymentStats {
  total_payments: number;
  paid_payments: number;
  failed_payments: number;
  expired_payments: number;
  pending_payments: number;
  total_amount_paid: number;
  success_rate: number;
}

// ─── Composite helper types ───────────────────────────────────────────────────

/**
 * An application row joined with its aggregated payment statistics.
 * Used by the developer portal's application list view.
 */
export interface ApplicationWithStats extends ApplicationRow {
  stats: ApplicationPaymentStats;
}

/**
 * Result of creating a new application.
 * Keys are returned here; they are NEVER stored in plaintext and will not
 * be retrievable again after the initial response.
 */
export interface ApplicationCreationResult {
  application: ApplicationRow;
  keys: {
    publishable: string; // Full plaintext key — show once then discard
    secret: string;      // Full plaintext key — show once then discard
  };
}

/**
 * Context object produced by the API key authentication middleware.
 * Passed to every API route handler that uses API key auth.
 */
export interface ApiKeyAuthContext {
  applicationId: UUID;
  userId: UUID;
  keyType: ApiKeyType;
  environment: AppEnvironment;
  permissions: ApiKeyPermissions;
  keyId: UUID;
}

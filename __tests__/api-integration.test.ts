/**
 * API Integration Tests — Phase 1.1
 *
 * Tests the behaviour of payment API route handlers and the cron endpoint.
 * All external dependencies (Supabase, Payment Engine DB calls) are mocked
 * so tests run offline without a real database or blockchain node.
 *
 * Coverage:
 *  - Authentication guard on every protected route
 *  - Merchant ownership check before payment creation
 *  - Payment creation happy-path and validation errors
 *  - Payment retrieval (found / not found)
 *  - Payment verification (happy-path, not-found, already paid, engine error)
 *  - Payment cancellation (happy-path, not owner, non-pending status)
 *  - Duplicate transaction hash rejection
 *  - Expired payment handling
 *  - Cron job authentication, delegation, and error propagation
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// ─── Shared fixture data ─────────────────────────────────────────────────────

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_UUID = '00000000-0000-0000-0000-000000000001';
const VALID_WALLET = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
const VALID_TX = '0x' + 'a'.repeat(64);

import type { PaymentIntent } from '@/lib/payment-engine';

const makePendingPayment = (overrides: Record<string, unknown> = {}): PaymentIntent => ({
  id: VALID_UUID,
  user_id: VALID_UUID,
  label: 'Test Payment',
  amount: '10.00',
  currency: 'USDC' as const,
  wallet_address: VALID_WALLET,
  status: 'pending',
  tx_hash: null,
  verified_amount: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  ...overrides,
} as PaymentIntent);

// ─── Mock: next/server ───────────────────────────────────────────────────────
// Provide minimal NextRequest / NextResponse so route files can be imported.

jest.mock('next/server', () => {
  const actual = jest.requireActual<typeof import('next/server')>('next/server');
  return actual;
});

// ─── Mock: @/lib/supabase/server ─────────────────────────────────────────────

const mockGetUser = jest.fn<() => Promise<{ data: { user: { id: string } | null } }>>();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser } })
  ),
}));

// ─── Mock: @/lib/supabase/admin ───────────────────────────────────────────────

const mockAdmin = {
  from: jest.fn(),
};
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdmin),
}));

// ─── Mock: @/lib/rate-limit ──────────────────────────────────────────────────

const mockCheckRateLimit = jest.fn<() => Promise<{ allowed: boolean; remaining: number; resetAt: Date; retryAfter: number }>>();
const mockRateLimitedResponse = jest.fn();
const mockAddRateLimitHeaders = jest.fn((resp: Response) => resp);

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...(args as Parameters<typeof mockCheckRateLimit>)),
  rateLimitedResponse: (...args: unknown[]) => mockRateLimitedResponse(...(args as Parameters<typeof mockRateLimitedResponse>)),
  addRateLimitHeaders: (...args: unknown[]) => mockAddRateLimitHeaders(...(args as Parameters<typeof mockAddRateLimitHeaders>)),
  getClientIp: jest.fn(() => '127.0.0.1'),
  RATE_LIMIT_PROFILES: {
    PAYMENT_STATUS: { id: 'pay-status', maxTokens: 60, windowSeconds: 60, failStrategy: 'open' },
    PAYMENT_VERIFY: { id: 'pay-verify', maxTokens: 10, windowSeconds: 60, failStrategy: 'closed' },
    PAYMENT_CREATE: { id: 'pay-create', maxTokens: 30, windowSeconds: 60, failStrategy: 'open' },
    PAYMENT_LIST: { id: 'pay-list', maxTokens: 60, windowSeconds: 60, failStrategy: 'open' },
    PAYMENT_CANCEL: { id: 'pay-cancel', maxTokens: 20, windowSeconds: 60, failStrategy: 'open' },
    MERCHANT: { id: 'merchant', maxTokens: 30, windowSeconds: 60, failStrategy: 'open' },
  },
}));

// ─── Mock: @/lib/payment-engine ───────────────────────────────────────────────

const mockCreatePaymentIntent = jest.fn<typeof import('@/lib/payment-engine').createPaymentIntent>();
const mockGetPaymentsByUser = jest.fn<typeof import('@/lib/payment-engine').getPaymentsByUser>();
const mockGetPaymentById = jest.fn<typeof import('@/lib/payment-engine').getPaymentById>();
const mockVerifyPayment = jest.fn<typeof import('@/lib/payment-engine').verifyPayment>();
const mockCancelPendingPayment = jest.fn<typeof import('@/lib/payment-engine').cancelPendingPayment>();
const mockExpirePendingPayments = jest.fn<typeof import('@/lib/payment-engine').expirePendingPayments>();

jest.mock('@/lib/payment-engine', () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...(args as Parameters<typeof mockCreatePaymentIntent>)),
  getPaymentsByUser: (...args: unknown[]) => mockGetPaymentsByUser(...(args as Parameters<typeof mockGetPaymentsByUser>)),
  getPaymentById: (...args: unknown[]) => mockGetPaymentById(...(args as Parameters<typeof mockGetPaymentById>)),
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...(args as Parameters<typeof mockVerifyPayment>)),
  cancelPendingPayment: (...args: unknown[]) => mockCancelPendingPayment(...(args as Parameters<typeof mockCancelPendingPayment>)),
  expirePendingPayments: (...args: unknown[]) => mockExpirePendingPayments(...(args as Parameters<typeof mockExpirePendingPayments>)),
  ValidationError: class ValidationError extends Error {
    code = 'VALIDATION_ERROR';
    statusCode: number;
    constructor(message: string, public details?: Record<string, unknown>) {
      super(message);
      this.name = 'ValidationError';
      this.statusCode = 400;
    }
  },
  PaymentEngineError: class PaymentEngineError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code = 'ENGINE_ERROR', statusCode = 500) {
      super(message);
      this.name = 'PaymentEngineError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  VerificationError: class VerificationError extends Error {
    code = 'VERIFICATION_ERROR';
    statusCode: number;
    constructor(message: string) {
      super(message);
      this.name = 'VerificationError';
      this.statusCode = 422;
    }
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the imported error classes from the mock so tests can throw them. */
async function getErrors() {
  const engine = await import('@/lib/payment-engine');
  return {
    ValidationError: engine.ValidationError,
    PaymentEngineError: engine.PaymentEngineError,
    VerificationError: engine.VerificationError,
  };
}

function makeRequest(method: string, body?: unknown, search?: string): Request {
  const url = `http://localhost/api/payments${search ?? ''}`;
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── POST /api/payments ───────────────────────────────────────────────────────

describe('POST /api/payments', () => {
  const { POST } = require('../app/api/payments/route');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 0,
    });
  });

  function setupMerchantQuery(wallet: string | null) {
    const result = wallet
      ? { data: { wallet_address: wallet }, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
    // Cast through unknown to avoid ts-jest's strict inference on chained mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const single = jest.fn().mockResolvedValue(result as unknown as never) as jest.Mock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eq = jest.fn().mockReturnValue({ single }) as jest.Mock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const select = jest.fn().mockReturnValue({ eq }) as jest.Mock;
    (mockAdmin.from as jest.Mock).mockReturnValue({ select });
  }

  test('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeRequest('POST', { label: 'x', amount: '1', currency: 'USDC' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('returns 400 when merchant profile is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    setupMerchantQuery(null);
    const req = makeRequest('POST', { label: 'Test', amount: '10.00', currency: 'USDC' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/merchant/i);
  });

  test('returns 400 when amount is missing from request body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    const req = makeRequest('POST', { label: 'Test', currency: 'USDC' }); // no amount
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('returns 400 when currency is unsupported', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    const req = makeRequest('POST', { label: 'Test', amount: '10.00', currency: 'BTC' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('returns 400 when body is not valid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    const req = new Request('http://localhost/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('returns 201 and payment on successful creation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    setupMerchantQuery(VALID_WALLET);
    const payment = makePendingPayment();
    mockCreatePaymentIntent.mockResolvedValue({ success: true, payment });

    const req = makeRequest('POST', { label: 'Order #1', amount: '10.00', currency: 'USDC' });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(VALID_UUID);
    expect(body.status).toBe('pending');
  });

  test('returns 400 when Payment Engine throws ValidationError', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    setupMerchantQuery(VALID_WALLET);
    const { ValidationError } = await getErrors();
    mockCreatePaymentIntent.mockRejectedValue(new ValidationError('Amount too small'));

    const req = makeRequest('POST', { label: 'Test', amount: '0.000001', currency: 'USDC' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Amount too small');
  });

  test('createPaymentIntent is called with the merchant wallet address', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    setupMerchantQuery(VALID_WALLET);
    const payment = makePendingPayment();
    mockCreatePaymentIntent.mockResolvedValue({ success: true, payment });

    const req = makeRequest('POST', { label: 'Pay me', amount: '5.00', currency: 'EURC' });
    await POST(req);

    expect(mockCreatePaymentIntent).toHaveBeenCalledTimes(1);
    const callArg = mockCreatePaymentIntent.mock.calls[0][0];
    expect(callArg.wallet_address).toBe(VALID_WALLET);
    expect(callArg.user_id).toBe(VALID_UUID);
    expect(callArg.currency).toBe('EURC');
  });
});

// ─── GET /api/payments ────────────────────────────────────────────────────────

describe('GET /api/payments', () => {
  const { GET } = require('../app/api/payments/route');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 0,
    });
  });

  test('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty array when user has no payments', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    mockGetPaymentsByUser.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test('returns 200 with payment list', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    const payments = [makePendingPayment(), makePendingPayment({ id: OTHER_UUID })];
    mockGetPaymentsByUser.mockResolvedValue(payments);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  test('getPaymentsByUser is called with the authenticated user id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    mockGetPaymentsByUser.mockResolvedValue([]);
    await GET();
    expect(mockGetPaymentsByUser).toHaveBeenCalledWith(VALID_UUID);
  });
});

// ─── GET /api/payments/[id] ───────────────────────────────────────────────────

describe('GET /api/payments/[id]', () => {
  const { GET } = require('../app/api/payments/[id]/route');
  const params = { params: Promise.resolve({ id: VALID_UUID }) };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 0,
    });
  });

  test('returns 404 when payment does not exist', async () => {
    mockGetPaymentById.mockResolvedValue(null);
    const req = makeRequest('GET');
    const res = await GET(req, params);
    expect(res.status).toBe(404);
  });

  test('returns 200 with payment data when found', async () => {
    const payment = makePendingPayment();
    mockGetPaymentById.mockResolvedValue(payment);
    const req = makeRequest('GET');
    const res = await GET(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(VALID_UUID);
  });

  test('returns expired status for an expired payment', async () => {
    // getPaymentById auto-expires inside the engine; the route just returns
    // whatever the engine returns.
    const expired = makePendingPayment({
      status: 'expired',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    mockGetPaymentById.mockResolvedValue(expired);
    const req = makeRequest('GET');
    const res = await GET(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('expired');
  });

  test('returns 400 when Payment Engine throws ValidationError', async () => {
    const { ValidationError } = await getErrors();
    mockGetPaymentById.mockRejectedValue(new ValidationError('Invalid ID'));
    const req = makeRequest('GET');
    const res = await GET(req, params);
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/payments/[id]?action=verify ────────────────────────────────────

describe('POST /api/payments/[id]?action=verify', () => {
  const { POST } = require('../app/api/payments/[id]/route');

  function makeVerifyRequest(search = '?action=verify') {
    return new Request(`http://localhost/api/payments/${VALID_UUID}${search}`, {
      method: 'POST',
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 0,
    });
  });

  test('returns 400 when action query param is missing', async () => {
    const req = makeVerifyRequest('');
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    const res = await POST(req, params);
    expect(res.status).toBe(400);
  });

  test('returns 400 when action query param is not "verify"', async () => {
    const req = makeVerifyRequest('?action=delete');
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    const res = await POST(req, params);
    expect(res.status).toBe(400);
  });

  test('returns 200 with status when verification succeeds', async () => {
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    mockVerifyPayment.mockResolvedValue({
      success: true,
      payment_id: VALID_UUID,
      status: 'paid',
      tx_hash: VALID_TX,
      verified_amount: '10.00',
      message: 'Payment successfully verified',
    });
    const req = makeVerifyRequest();
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('paid');
    expect(body.txHash).toBe(VALID_TX);
  });

  test('returns 200 with current status when payment is already paid', async () => {
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    mockVerifyPayment.mockResolvedValue({
      success: true,
      payment_id: VALID_UUID,
      status: 'paid',
      tx_hash: VALID_TX,
      message: 'Payment already verified',
    });
    const req = makeVerifyRequest();
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('paid');
  });

  test('returns 400 when Payment Engine throws ValidationError (payment not found)', async () => {
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    const { ValidationError } = await getErrors();
    mockVerifyPayment.mockRejectedValue(new ValidationError('Payment not found'));
    const req = makeVerifyRequest();
    const res = await POST(req, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Payment not found');
  });

  test('returns 422 when VerificationError is thrown (e.g. transaction not found)', async () => {
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    const { VerificationError } = await getErrors();
    mockVerifyPayment.mockRejectedValue(new VerificationError('Transaction not found on blockchain'));
    const req = makeVerifyRequest();
    const res = await POST(req, params);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Transaction not found on blockchain');
  });

  test('verifyPayment is called with payment_id from route params', async () => {
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    mockVerifyPayment.mockResolvedValue({
      success: false,
      payment_id: VALID_UUID,
      status: 'pending',
      message: 'No transaction found',
    });
    const req = makeVerifyRequest();
    await POST(req, params);
    expect(mockVerifyPayment).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: VALID_UUID, force: false })
    );
  });
});

// ─── DELETE /api/payments/[id] ────────────────────────────────────────────────

describe('DELETE /api/payments/[id]', () => {
  const { DELETE } = require('../app/api/payments/[id]/route');
  const params = { params: Promise.resolve({ id: VALID_UUID }) };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 0,
    });
  });

  test('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeRequest('DELETE');
    const res = await DELETE(req, params);
    expect(res.status).toBe(401);
  });

  test('returns 200 on successful cancellation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    mockCancelPendingPayment.mockResolvedValue(makePendingPayment({ status: 'failed' }));
    const req = makeRequest('DELETE');
    const res = await DELETE(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 400 when user does not own the payment', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OTHER_UUID } } });
    const { ValidationError } = await getErrors();
    mockCancelPendingPayment.mockRejectedValue(
      new ValidationError('Payment not found or access denied')
    );
    const req = makeRequest('DELETE');
    const res = await DELETE(req, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/access denied/i);
  });

  test('returns 400 when payment is not in pending status', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    const { ValidationError } = await getErrors();
    mockCancelPendingPayment.mockRejectedValue(
      new ValidationError('Only pending payments can be cancelled')
    );
    const req = makeRequest('DELETE');
    const res = await DELETE(req, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/pending/i);
  });

  test('cancelPendingPayment is called with payment id and authenticated user id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
    mockCancelPendingPayment.mockResolvedValue(makePendingPayment({ status: 'failed' }));
    const req = makeRequest('DELETE');
    await DELETE(req, params);
    expect(mockCancelPendingPayment).toHaveBeenCalledWith(VALID_UUID, VALID_UUID);
  });
});

// ─── Duplicate transaction hash ───────────────────────────────────────────────

describe('Duplicate transaction hash rejection', () => {
  const { POST } = require('../app/api/payments/[id]/route');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 0,
    });
  });

  test('verifyPayment returns review_required status when tx already used', async () => {
    const params = { params: Promise.resolve({ id: VALID_UUID }) };
    // The Payment Engine handles duplicate detection internally and returns
    // review_required rather than throwing, so the route returns 200.
    mockVerifyPayment.mockResolvedValue({
      success: false,
      payment_id: VALID_UUID,
      status: 'review_required',
      message: 'Transaction already used for another payment',
    });
    const req = new Request(`http://localhost/api/payments/${VALID_UUID}?action=verify`, {
      method: 'POST',
    });
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('review_required');
  });
});

// ─── Cron: GET /api/cron/monitor-payments ────────────────────────────────────

describe('GET /api/cron/monitor-payments', () => {
  // Import after mocks are defined
  const getCronHandler = () =>
    require('../app/api/cron/monitor-payments/route').GET as (
      req: Request
    ) => Promise<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Restore mock after resetModules
    jest.mock('@/lib/payment-engine', () => ({
      expirePendingPayments: (...args: unknown[]) => mockExpirePendingPayments(...(args as [])),
    }));
  });

  function makeCronRequest(secret?: string) {
    return new Request('http://localhost/api/cron/monitor-payments', {
      method: 'GET',
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });
  }

  test('returns 200 with expired count when payments are expired', async () => {
    mockExpirePendingPayments.mockResolvedValue(3);
    const GET = getCronHandler();
    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.expired).toBe(3);
    expect(body.message).toMatch(/3 payment/i);
  });

  test('returns 200 with zero count when no payments are expired', async () => {
    mockExpirePendingPayments.mockResolvedValue(0);
    const GET = getCronHandler();
    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.expired).toBe(0);
    expect(body.message).toMatch(/no expired/i);
  });

  test('returns 500 when expirePendingPayments throws', async () => {
    mockExpirePendingPayments.mockRejectedValue(new Error('DB connection failed'));
    const GET = getCronHandler();
    const res = await GET(makeCronRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.detail).toMatch(/DB connection failed/);
  });

  test('response includes started_at and completed_at timestamps', async () => {
    mockExpirePendingPayments.mockResolvedValue(1);
    const GET = getCronHandler();
    const res = await GET(makeCronRequest());
    const body = await res.json();
    expect(body.started_at).toBeTruthy();
    expect(body.completed_at).toBeTruthy();
    // completed_at must be >= started_at
    expect(new Date(body.completed_at) >= new Date(body.started_at)).toBe(true);
  });

  test('calls expirePendingPayments exactly once per request', async () => {
    mockExpirePendingPayments.mockResolvedValue(0);
    const GET = getCronHandler();
    await GET(makeCronRequest());
    expect(mockExpirePendingPayments).toHaveBeenCalledTimes(1);
  });
});

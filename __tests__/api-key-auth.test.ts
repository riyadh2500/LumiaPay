/**
 * API Key Authentication Middleware Tests — Phase 2.1
 *
 * Tests authentication, permission checking, and environment isolation.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  withApiKeyAuth,
  hasPermission,
  validatePaymentOwnership,
  validatePaymentEnvironment,
  validatePaymentAccess,
} from '../lib/middleware/api-key-auth';
import { hashApiKey, generateApiKey } from '../lib/developer/api-keys';
import type { ApiKeyAuthContext, AppEnvironment } from '../lib/db/types';

// ─── Mock Supabase Client ────────────────────────────────────────────────────

const mockRpc: any = jest.fn();
const mockUpdate: any = jest.fn();
const mockEq: any = jest.fn();
const mockSelect: any = jest.fn();
const mockSingle: any = jest.fn();
const mockThen: any = jest.fn();

jest.mock('../lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
      from: jest.fn(() => ({
        update: mockUpdate.mockReturnValue({
          eq: mockEq.mockReturnValue({
            select: mockSelect.mockReturnValue({
              single: mockSingle.mockReturnValue({
                then: mockThen,
              }),
            }),
          }),
        }),
      })),
    }),
  ),
}));

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testAppId = '660e9500-f39c-52e5-b827-557766551111';
const testKeyId = '770ea600-g49d-63f6-c938-668877662222';

const testApiKey = generateApiKey('secret', 'test');

const mockValidationResult = {
  key_id: testKeyId,
  application_id: testAppId,
  user_id: testUserId,
  key_type: 'secret',
  environment: 'test',
  permissions: {
    payments: ['read', 'write'],
  },
};

// ─── Helper: Create Request ──────────────────────────────────────────────────

function createRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['authorization'] = authHeader;
  }

  return new NextRequest('https://example.com/api/v1/payments', {
    headers,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('API Key Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withApiKeyAuth', () => {
    it('returns error when Authorization header is missing', async () => {
      const req = createRequest();
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.error.json();
        expect(json.error).toBe('authentication_required');
        expect(result.error.status).toBe(401);
      }
    });

    it('returns error when Authorization header format is invalid', async () => {
      const req = createRequest('InvalidFormat');
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.error.json();
        expect(json.error).toBe('invalid_api_key');
      }
    });

    it('returns error when API key format is invalid', async () => {
      const req = createRequest('Bearer invalid_key_format');
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.error.json();
        expect(json.error).toBe('invalid_api_key');
      }
    });

    it('returns error when database validation fails', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const req = createRequest(`Bearer ${testApiKey.plaintext}`);
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.error.json();
        expect(json.error).toBe('invalid_api_key');
      }
    });

    it('returns error when database query errors', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      const req = createRequest(`Bearer ${testApiKey.plaintext}`);
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.error.json();
        expect(json.error).toBe('internal_error');
        expect(result.error.status).toBe(500);
      }
    });

    it('returns error when prefix environment does not match DB environment', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            ...mockValidationResult,
            environment: 'live', // Mismatch: key has 'test' prefix
          },
        ],
        error: null,
      });

      const req = createRequest(`Bearer ${testApiKey.plaintext}`);
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.error.json();
        expect(json.error).toBe('invalid_api_key');
      }
    });

    it('successfully authenticates valid API key', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [mockValidationResult],
        error: null,
      });
      mockThen.mockImplementationOnce((fn: any) =>
        fn({ data: { usage_count: 10 } }),
      );
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest(`Bearer ${testApiKey.plaintext}`);
      const result = await withApiKeyAuth(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.userId).toBe(testUserId);
        expect(result.context.applicationId).toBe(testAppId);
        expect(result.context.keyType).toBe('secret');
        expect(result.context.environment).toBe('test');
        expect(result.context.permissions).toEqual({
          payments: ['read', 'write'],
        });
      }

      // Verify RPC was called with hashed key
      expect(mockRpc).toHaveBeenCalledWith('validate_api_key', {
        key_hash_param: testApiKey.hash,
      });
    });

    it('updates key usage statistics asynchronously', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [mockValidationResult],
        error: null,
      });
      mockThen.mockImplementationOnce((fn: any) =>
        fn({ data: { usage_count: 10 } }),
      );
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest(`Bearer ${testApiKey.plaintext}`);
      await withApiKeyAuth(req);

      // Usage update happens asynchronously, give it time
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', testKeyId);
    });
  });

  describe('hasPermission', () => {
    const context: ApiKeyAuthContext = {
      applicationId: testAppId,
      userId: testUserId,
      keyType: 'secret',
      environment: 'test',
      keyId: testKeyId,
      permissions: {
        payments: ['read', 'write'],
        webhooks: ['read'],
      },
    };

    it('returns true when permission exists', () => {
      expect(hasPermission(context, 'payments', 'read')).toBe(true);
      expect(hasPermission(context, 'payments', 'write')).toBe(true);
      expect(hasPermission(context, 'webhooks', 'read')).toBe(true);
    });

    it('returns false when permission does not exist', () => {
      expect(hasPermission(context, 'webhooks', 'write')).toBe(false);
      expect(hasPermission(context, 'nonexistent', 'read')).toBe(false);
    });

    it('returns false when resource has no permissions', () => {
      const limitedContext = {
        ...context,
        permissions: {},
      };
      expect(hasPermission(limitedContext, 'payments', 'read')).toBe(false);
    });
  });

  describe('validatePaymentOwnership', () => {
    const context: ApiKeyAuthContext = {
      applicationId: testAppId,
      userId: testUserId,
      keyType: 'secret',
      environment: 'test',
      keyId: testKeyId,
      permissions: {},
    };

    it('returns true when payment belongs to user', () => {
      const payment = { user_id: testUserId };
      expect(validatePaymentOwnership(context, payment)).toBe(true);
    });

    it('returns false when payment belongs to different user', () => {
      const payment = { user_id: 'different-user-id' };
      expect(validatePaymentOwnership(context, payment)).toBe(false);
    });
  });

  describe('validatePaymentEnvironment', () => {
    const context: ApiKeyAuthContext = {
      applicationId: testAppId,
      userId: testUserId,
      keyType: 'secret',
      environment: 'test',
      keyId: testKeyId,
      permissions: {},
    };

    it('returns true when environments match', () => {
      const payment = {
        environment: 'test' as AppEnvironment,
        application_id: testAppId,
      };
      expect(validatePaymentEnvironment(context, payment)).toBe(true);
    });

    it('returns false when environments do not match', () => {
      const payment = {
        environment: 'live' as AppEnvironment,
        application_id: testAppId,
      };
      expect(validatePaymentEnvironment(context, payment)).toBe(false);
    });

    it('returns false when payment has null environment (dashboard payment)', () => {
      const payment = {
        environment: null,
        application_id: null,
      };
      expect(validatePaymentEnvironment(context, payment)).toBe(false);
    });

    it('returns false when payment has null application_id', () => {
      const payment = {
        environment: 'test' as AppEnvironment,
        application_id: null,
      };
      expect(validatePaymentEnvironment(context, payment)).toBe(false);
    });
  });

  describe('validatePaymentAccess', () => {
    const context: ApiKeyAuthContext = {
      applicationId: testAppId,
      userId: testUserId,
      keyType: 'secret',
      environment: 'test',
      keyId: testKeyId,
      permissions: {},
    };

    it('returns true when both ownership and environment match', () => {
      const payment = {
        user_id: testUserId,
        environment: 'test' as AppEnvironment,
        application_id: testAppId,
      };
      expect(validatePaymentAccess(context, payment)).toBe(true);
    });

    it('returns false when ownership matches but environment does not', () => {
      const payment = {
        user_id: testUserId,
        environment: 'live' as AppEnvironment,
        application_id: testAppId,
      };
      expect(validatePaymentAccess(context, payment)).toBe(false);
    });

    it('returns false when environment matches but ownership does not', () => {
      const payment = {
        user_id: 'different-user-id',
        environment: 'test' as AppEnvironment,
        application_id: testAppId,
      };
      expect(validatePaymentAccess(context, payment)).toBe(false);
    });

    it('returns false when payment is dashboard-created (null environment)', () => {
      const payment = {
        user_id: testUserId,
        environment: null,
        application_id: null,
      };
      expect(validatePaymentAccess(context, payment)).toBe(false);
    });
  });
});

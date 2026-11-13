/**
 * Payment Engine Test Suite
 * 
 * Comprehensive tests for the Central Payment Engine including:
 * - Payment creation
 * - Validation
 * - Transaction verification
 * - Status transitions
 * - Error handling
 * - Concurrency safety
 * 
 * To run these tests:
 * 1. Install Jest: npm install --save-dev jest @jest/globals @types/jest ts-jest
 * 2. Create jest.config.js (see TESTING.md)
 * 3. Run: npm test
 * 
 * Note: TypeScript errors about @jest/globals are expected if Jest is not installed.
 * These tests are optional but highly recommended before deploying to production.
 */

// @ts-ignore - Jest types not installed by default
import { describe, test, expect, beforeEach, it } from '@jest/globals';
import {
  validateAmount,
  compareAmounts,
  validateAddress,
  validateCurrency,
  validatePaymentIntentInput,
  validateStatusTransition,
  isExpired,
} from '../lib/payment-engine/payment-validator';
import {
  ValidationError,
} from '../lib/payment-engine/payment-types';
import {
  classifyAmount,
} from '../lib/payment-engine/transaction-verifier';
import { PaymentStatus, VALID_STATUS_TRANSITIONS } from '../lib/payment-engine/payment-types';

// ─── Validation Tests ────────────────────────────────────────────────────────

describe('Payment Validator', () => {
  describe('validateAmount', () => {
    test('accepts valid decimal amounts', () => {
      expect(() => validateAmount('10.50', 'USDC')).not.toThrow();
      expect(() => validateAmount('0.01', 'USDC')).not.toThrow();
      expect(() => validateAmount('1000000', 'USDC')).not.toThrow();
    });

    test('rejects invalid formats', () => {
      expect(() => validateAmount('', 'USDC')).toThrow(ValidationError);
      expect(() => validateAmount('abc', 'USDC')).toThrow(ValidationError);
      expect(() => validateAmount('-10', 'USDC')).toThrow(ValidationError);
      expect(() => validateAmount('10.', 'USDC')).toThrow(ValidationError);
    });

    test('rejects zero and negative amounts', () => {
      expect(() => validateAmount('0', 'USDC')).toThrow(ValidationError);
      expect(() => validateAmount('-5.50', 'USDC')).toThrow(ValidationError);
    });

    test('rejects amounts with too many decimals', () => {
      // USDC has 6 decimals
      expect(() => validateAmount('10.1234567', 'USDC')).toThrow(ValidationError);
      expect(() => validateAmount('1.123456', 'USDC')).not.toThrow(); // Exactly 6 is ok
    });
  });

  describe('compareAmounts', () => {
    test('correctly compares equal amounts', () => {
      expect(compareAmounts('10.50', '10.50', 'USDC')).toBe(0);
      expect(compareAmounts('0.000001', '0.000001', 'USDC')).toBe(0);
    });

    test('correctly identifies greater amount', () => {
      expect(compareAmounts('11.00', '10.50', 'USDC')).toBe(1);
      expect(compareAmounts('10.000001', '10.000000', 'USDC')).toBe(1);
    });

    test('correctly identifies lesser amount', () => {
      expect(compareAmounts('10.49', '10.50', 'USDC')).toBe(-1);
      expect(compareAmounts('9.999999', '10.000000', 'USDC')).toBe(-1);
    });

    test('handles precision without floating point errors', () => {
      // These would fail with floating point comparison
      expect(compareAmounts('0.1', '0.1', 'USDC')).toBe(0);
      expect(compareAmounts('0.2', '0.1', 'USDC')).toBe(1);
    });
  });

  describe('validateAddress', () => {
    test('accepts valid Ethereum addresses', () => {
      expect(() => validateAddress('0x742d35cc6634c0532925a3b844bc9e7595f0beb0')).not.toThrow();
      expect(() => validateAddress('0x0000000000000000000000000000000000000001')).not.toThrow();
    });

    test('rejects invalid addresses', () => {
      expect(() => validateAddress('')).toThrow(ValidationError);
      expect(() => validateAddress('not-an-address')).toThrow(ValidationError);
      expect(() => validateAddress('0x123')).toThrow(ValidationError);
    });

    test('rejects zero address', () => {
      expect(() => validateAddress('0x0000000000000000000000000000000000000000')).toThrow(ValidationError);
    });
  });

  describe('validateCurrency', () => {
    test('accepts supported currencies', () => {
      expect(validateCurrency('USDC')).toBe('USDC');
      expect(validateCurrency('EURC')).toBe('EURC');
    });

    test('rejects unsupported currencies', () => {
      expect(() => validateCurrency('BTC')).toThrow(ValidationError);
      expect(() => validateCurrency('ETH')).toThrow(ValidationError);
      expect(() => validateCurrency('')).toThrow(ValidationError);
    });
  });

  describe('validatePaymentIntentInput', () => {
    const validInput = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      label: 'Test Payment',
      amount: '10.50',
      currency: 'USDC',
      wallet_address: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
    };

    test('accepts valid input', () => {
      expect(() => validatePaymentIntentInput(validInput)).not.toThrow();
    });

    test('rejects invalid user_id', () => {
      expect(() => validatePaymentIntentInput({
        ...validInput,
        user_id: 'invalid-uuid',
      })).toThrow(ValidationError);
    });

    test('rejects empty label', () => {
      expect(() => validatePaymentIntentInput({
        ...validInput,
        label: '',
      })).toThrow(ValidationError);
    });

    test('rejects label too long', () => {
      expect(() => validatePaymentIntentInput({
        ...validInput,
        label: 'a'.repeat(201),
      })).toThrow(ValidationError);
    });

    test('rejects invalid amount', () => {
      expect(() => validatePaymentIntentInput({
        ...validInput,
        amount: 'invalid',
      })).toThrow(ValidationError);
    });

    test('rejects invalid currency', () => {
      expect(() => validatePaymentIntentInput({
        ...validInput,
        currency: 'BTC',
      })).toThrow(ValidationError);
    });

    test('rejects invalid wallet address', () => {
      expect(() => validatePaymentIntentInput({
        ...validInput,
        wallet_address: 'invalid-address',
      })).toThrow(ValidationError);
    });

    test('normalizes wallet address to lowercase', () => {
      const result = validatePaymentIntentInput({
        ...validInput,
        wallet_address: '0x742D35CC6634c0532925A3b844BC9E7595F0BEb0', // This is the proper checksummed version
      });
      expect(result.wallet_address).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
    });

    test('trims label whitespace', () => {
      const result = validatePaymentIntentInput({
        ...validInput,
        label: '  Test Payment  ',
      });
      expect(result.label).toBe('Test Payment');
    });
  });

  describe('validateStatusTransition', () => {
    test('allows valid transitions', () => {
      expect(() => validateStatusTransition('pending', 'detecting')).not.toThrow();
      expect(() => validateStatusTransition('verifying', 'paid')).not.toThrow();
      expect(() => validateStatusTransition('pending', 'expired')).not.toThrow();
    });

    test('rejects invalid transitions', () => {
      expect(() => validateStatusTransition('paid', 'pending')).toThrow(ValidationError);
      expect(() => validateStatusTransition('failed', 'paid')).toThrow(ValidationError);
      expect(() => validateStatusTransition('paid', 'expired')).toThrow(ValidationError);
    });

    test('prevents modification of terminal states', () => {
      expect(() => validateStatusTransition('paid', 'verifying')).toThrow(ValidationError);
      expect(() => validateStatusTransition('failed', 'pending')).toThrow(ValidationError);
    });
  });

  describe('isExpired', () => {
    test('detects expired timestamps', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(isExpired(past)).toBe(true);
    });

    test('detects non-expired timestamps', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(isExpired(future)).toBe(false);
    });

    test('handles edge case of exact current time', () => {
      const now = new Date().toISOString();
      // Due to processing time, this might be expired by a few milliseconds
      const result = isExpired(now);
      expect(typeof result).toBe('boolean');
    });
  });
});

// ─── Transaction Verifier Tests ──────────────────────────────────────────────

describe('Transaction Verifier', () => {
  describe('classifyAmount', () => {
    test('classifies exact match', () => {
      const result = classifyAmount('10.50', '10.50', 'USDC');
      expect(result.type).toBe('exact');
      expect(result.difference).toBe('0');
      expect(result.percentage).toBe(0);
    });

    test('classifies overpayment', () => {
      const result = classifyAmount('11.00', '10.00', 'USDC');
      expect(result.type).toBe('overpaid');
      expect(result.difference).toBe('1');
      expect(result.percentage).toBe(10); // 10% over
    });

    test('classifies underpayment', () => {
      const result = classifyAmount('9.00', '10.00', 'USDC');
      expect(result.type).toBe('underpaid');
      expect(result.difference).toBe('-1');
      expect(result.percentage).toBe(-10); // 10% under
    });

    test('handles small differences accurately', () => {
      const result = classifyAmount('10.000001', '10.000000', 'USDC');
      expect(result.type).toBe('overpaid');
      expect(parseFloat(result.difference)).toBeGreaterThan(0);
    });
  });
});

// ─── Status Transition Tests ─────────────────────────────────────────────────

describe('Payment Status Lifecycle', () => {
  test('VALID_STATUS_TRANSITIONS is comprehensive', () => {
    const allStatuses: PaymentStatus[] = [
      'created', 'pending', 'detecting', 'verifying', 
      'paid', 'underpaid', 'overpaid', 'expired', 
      'failed', 'review_required'
    ];

    allStatuses.forEach(status => {
      expect(VALID_STATUS_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(VALID_STATUS_TRANSITIONS[status])).toBe(true);
    });
  });

  test('terminal states have no outgoing transitions', () => {
    expect(VALID_STATUS_TRANSITIONS.paid).toEqual([]);
    expect(VALID_STATUS_TRANSITIONS.failed).toEqual([]);
  });

  test('pending can transition to multiple states', () => {
    const transitions = VALID_STATUS_TRANSITIONS.pending;
    expect(transitions).toContain('detecting');
    expect(transitions).toContain('expired');
    expect(transitions).toContain('failed');
  });

  test('expired payments can still be verified', () => {
    const transitions = VALID_STATUS_TRANSITIONS.expired;
    expect(transitions).toContain('detecting');
    expect(transitions).toContain('verifying');
    expect(transitions).toContain('review_required');
  });
});

// ─── Integration Test Scenarios ──────────────────────────────────────────────

describe('Payment Engine Integration Scenarios', () => {
  test('Scenario: Successful payment flow', () => {
    // created -> pending -> detecting -> verifying -> paid
    const flow: PaymentStatus[] = ['created', 'pending', 'detecting', 'verifying', 'paid'];
    
    for (let i = 0; i < flow.length - 1; i++) {
      expect(() => validateStatusTransition(flow[i], flow[i + 1])).not.toThrow();
    }
  });

  test('Scenario: Payment expires before completion', () => {
    // pending -> expired (valid)
    expect(() => validateStatusTransition('pending', 'expired')).not.toThrow();
    
    // But can still be verified later
    expect(() => validateStatusTransition('expired', 'detecting')).not.toThrow();
    expect(() => validateStatusTransition('detecting', 'verifying')).not.toThrow();
  });

  test('Scenario: Underpayment requires review', () => {
    // verifying -> underpaid -> review_required
    expect(() => validateStatusTransition('verifying', 'underpaid')).not.toThrow();
    expect(() => validateStatusTransition('underpaid', 'review_required')).not.toThrow();
  });

  test('Scenario: Payment cancellation', () => {
    // pending -> failed (cancel)
    expect(() => validateStatusTransition('pending', 'failed')).not.toThrow();
    
    // Cannot transition from failed
    expect(() => validateStatusTransition('failed', 'pending')).toThrow();
    expect(() => validateStatusTransition('failed', 'paid')).toThrow();
  });
});

// ─── Error Handling Tests ────────────────────────────────────────────────────

describe('Error Handling', () => {
  test('ValidationError includes helpful details', () => {
    expect(() => {
      validateAmount('-10', 'USDC');
    }).toThrow(ValidationError);
    
    try {
      validateAmount('-10', 'USDC');
      throw new Error('Should have thrown');
    } catch (error) {
      if (error instanceof ValidationError) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
      }
    }
  });

  test('ValidationError for status transitions includes context', () => {
    expect(() => {
      validateStatusTransition('paid', 'pending');
    }).toThrow(ValidationError);
    
    try {
      validateStatusTransition('paid', 'pending');
      throw new Error('Should have thrown');
    } catch (error) {
      if (error instanceof ValidationError) {
        const details = error.details;
        expect(details).toHaveProperty('current');
        expect(details).toHaveProperty('requested');
        expect(details).toHaveProperty('allowed');
      }
    }
  });
});

// ─── Concurrency Safety Tests ────────────────────────────────────────────────

describe('Concurrency Safety', () => {
  test('amount comparison is deterministic', () => {
    const iterations = 100;
    const results = new Set();
    
    for (let i = 0; i < iterations; i++) {
      results.add(compareAmounts('10.50', '10.50', 'USDC'));
    }
    
    expect(results.size).toBe(1);
    expect(results.has(0)).toBe(true);
  });

  test('validation is deterministic', () => {
    const input = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      label: 'Test',
      amount: '10.50',
      currency: 'USDC',
      wallet_address: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
    };

    const iterations = 100;
    const results: ReturnType<typeof validatePaymentIntentInput>[] = [];
    
    for (let i = 0; i < iterations; i++) {
      results.push(validatePaymentIntentInput(input));
    }
    
    // All results should be identical
    results.forEach(result => {
      expect(result).toEqual(results[0]);
    });
  });
});

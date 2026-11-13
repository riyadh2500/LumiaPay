# Payment Engine Testing Guide

## Overview

The Payment Engine includes comprehensive tests covering:
- ✅ Input validation
- ✅ Amount calculations without floating-point errors
- ✅ Address validation
- ✅ Status transition rules
- ✅ Transaction classification
- ✅ Error handling
- ✅ Concurrency safety

## Running Tests

### Option 1: Install Jest (Recommended)

```bash
npm install --save-dev jest @jest/globals @types/jest ts-jest
```

Add to package.json:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

Then run:
```bash
npm test
```

### Option 2: Manual Testing

You can manually test each function in Node.js:

```javascript
// test-manual.js
import { validateAmount, compareAmounts } from './lib/payment-engine/payment-validator.js';

console.log('Test 1: Valid amount');
try {
  validateAmount('10.50', 'USDC');
  console.log('✅ PASS');
} catch (e) {
  console.log('❌ FAIL:', e.message);
}

console.log('Test 2: Compare amounts');
const result = compareAmounts('10.50', '10.50', 'USDC');
console.log(result === 0 ? '✅ PASS' : '❌ FAIL');
```

Run with:
```bash
node --loader tsx test-manual.js
```

## Test Coverage

### Validation Tests (15 tests)
- Amount format validation
- Decimal precision handling
- Address format validation
- Currency support validation
- Payment intent validation
- Status transition validation
- Expiry checks

### Transaction Tests (4 tests)
- Amount classification (exact/over/under)
- Precision handling
- Percentage calculations

### Lifecycle Tests (5 tests)
- Status transition matrix
- Terminal state validation
- Flow scenarios

### Integration Tests (4 tests)
- Successful payment flow
- Expiration handling
- Underpayment scenarios
- Cancellation flows

### Error Handling Tests (2 tests)
- Error message clarity
- Error context inclusion

### Concurrency Tests (2 tests)
- Deterministic operations
- Thread-safe validations

**Total: 32 automated tests**

## Manual Testing Checklist

### 1. Payment Creation
- [ ] Create payment with valid USDC amount
- [ ] Create payment with valid EURC amount
- [ ] Reject payment with invalid amount
- [ ] Reject payment with unsupported currency
- [ ] Reject payment with invalid wallet address

### 2. Payment Verification
- [ ] Verify payment with matching transaction
- [ ] Detect overpayment correctly
- [ ] Detect underpayment correctly
- [ ] Handle expired payment with late transaction
- [ ] Reject transaction sent to wrong address
- [ ] Reject transaction with wrong token
- [ ] Reject transaction before payment creation

### 3. Transaction Uniqueness
- [ ] Verify transaction can only be used once
- [ ] Concurrent verification of same transaction
- [ ] Different payments cannot share transaction

### 4. Status Transitions
- [ ] pending -> detecting -> verifying -> paid
- [ ] pending -> expired
- [ ] expired -> detecting (late payment)
- [ ] verifying -> underpaid
- [ ] Cannot transition from paid to pending

### 5. Event Tracking
- [ ] Events created for each status change
- [ ] Events include correct data
- [ ] Events can be queried by payment
- [ ] Events preserve audit trail

### 6. Error Handling
- [ ] RPC failures are retried
- [ ] Invalid transitions throw errors
- [ ] Validation errors are descriptive
- [ ] Database errors are handled gracefully

## Database Testing

### Check Transaction Uniqueness

```sql
-- This should fail with unique constraint violation
INSERT INTO payment_transactions (payment_id, tx_hash, verified_amount)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '0xDUPLICATE', '10.50'),
  ('00000000-0000-0000-0000-000000000002', '0xDUPLICATE', '20.00');
-- Should error: duplicate key value violates unique constraint "unique_tx_hash"
```

### Check RLS Policies

```sql
-- As user A, try to access user B's payment events
SET request.jwt.claims.sub = 'user-a-uuid';
SELECT * FROM payment_events WHERE user_id = 'user-b-uuid';
-- Should return 0 rows (RLS blocks access)
```

### Check Status Indexes

```sql
EXPLAIN ANALYZE 
SELECT * FROM payments 
WHERE status = 'pending' AND expires_at < NOW();
-- Should show Index Scan on idx_payments_expires_at
```

## Performance Testing

### Load Test Payment Creation

```javascript
async function createManyPayments(count) {
  const start = Date.now();
  const promises = [];
  
  for (let i = 0; i < count; i++) {
    promises.push(createPaymentIntent({
      user_id: 'test-user-uuid',
      label: `Test Payment ${i}`,
      amount: '10.50',
      currency: 'USDC',
      wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    }));
  }
  
  await Promise.all(promises);
  const duration = Date.now() - start;
  
  console.log(`Created ${count} payments in ${duration}ms`);
  console.log(`Average: ${duration / count}ms per payment`);
}

// Test with 100 payments
await createManyPayments(100);
```

Expected results:
- < 200ms average per payment
- No database deadlocks
- No duplicate IDs

### Concurrent Verification Test

```javascript
async function concurrentVerifications(paymentId) {
  const promises = [];
  
  // Simulate 10 concurrent verification requests
  for (let i = 0; i < 10; i++) {
    promises.push(verifyPayment({ payment_id: paymentId }));
  }
  
  const results = await Promise.all(promises);
  
  // All should succeed or fail consistently
  const statuses = results.map(r => r.status);
  const unique = [...new Set(statuses)];
  
  console.log('Unique statuses:', unique);
  // Should be 1 unique status (all same result)
}
```

## Regression Testing

Before deploying, verify existing features:

```bash
# Test existing payment creation
curl -X POST http://localhost:3000/api/payments \
  -H "Authorization: Bearer TOKEN" \
  -d '{"label":"Test","amount":"10.50","currency":"USDC"}'

# Test existing verification
curl -X POST http://localhost:3000/api/payments/ID?action=verify

# Test existing dashboard
curl http://localhost:3000/api/payments \
  -H "Authorization: Bearer TOKEN"
```

All should work exactly as before.

## Continuous Integration

For CI/CD pipelines:

```yaml
# .github/workflows/test.yml
name: Test Payment Engine

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run typecheck
      - run: npm run lint
```

## Test Data

### Valid Test Addresses (Arc Testnet)

```
Merchant Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Customer Wallet: 0x123d45Cc6634C0532925a3b844Bc9e7595f0XYZ
```

### Valid Test Transaction Hashes

```
USDC Transfer: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
EURC Transfer: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### Valid Test Amounts

```
Small: 0.000001 (minimum)
Normal: 10.50
Large: 1000000.00
```

## Debugging Tips

### Enable Debug Logging

Set environment variable:
```bash
DEBUG=payment-engine:*
```

### Check Payment Events

```sql
SELECT * FROM payment_events 
WHERE payment_id = 'YOUR_PAYMENT_ID'
ORDER BY created_at;
```

### Verify Transaction Records

```sql
SELECT pt.*, p.amount as expected_amount
FROM payment_transactions pt
JOIN payments p ON p.id = pt.payment_id
WHERE pt.tx_hash = 'YOUR_TX_HASH';
```

## Success Criteria

All tests pass when:
- ✅ All 32 automated tests pass
- ✅ All manual test cases pass
- ✅ No regression in existing features
- ✅ Database constraints enforced
- ✅ RLS policies working
- ✅ Performance within targets
- ✅ Concurrent operations safe
- ✅ Error messages helpful

## Next Steps After Testing

1. ✅ Run all tests locally
2. ✅ Deploy to staging environment
3. ✅ Run integration tests
4. ✅ Monitor for 24 hours
5. ✅ Deploy to production
6. ✅ Enable monitoring/alerts

---

**Questions?** Check payment_events table for detailed logs of what happened during payment processing.

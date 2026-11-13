# Payment Engine Migration Guide

## Overview

This guide explains how to deploy the new Central Payment Engine to your LumiaPay installation.

The Payment Engine is **backward compatible** with existing functionality while adding:
- Enhanced payment tracking
- Transaction uniqueness enforcement
- Event-driven architecture
- Better error handling
- Comprehensive audit trails

## Prerequisites

- Existing LumiaPay installation running
- Supabase project access
- Database admin access

## Migration Steps

### Step 1: Backup Database

**⚠️ CRITICAL: Always backup your database before running migrations**

```bash
# In Supabase Dashboard:
# Settings → Database → Backups → Create Backup
```

### Step 2: Run Database Migration

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Open and run: `supabase/migrations/001_payment_engine_tables.sql`

The migration will:
- ✅ Create `payment_transactions` table
- ✅ Create `payment_events` table  
- ✅ Add new columns to existing `payments` table
- ✅ Create necessary indexes
- ✅ Set up Row Level Security policies
- ✅ Add helper functions

**Note:** This migration is **non-destructive** and will not modify existing data.

### Step 3: Verify Migration

Run these verification queries in SQL Editor:

```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payment_transactions', 'payment_events');

-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'payments' 
AND column_name IN ('verified_amount', 'metadata');

-- Verify no existing data was lost
SELECT COUNT(*) as existing_payments FROM payments;
SELECT COUNT(*) as existing_merchants FROM merchants;
```

### Step 4: Deploy Application Code

The Payment Engine has already been integrated into the codebase.

#### Files Added:
```
lib/payment-engine/
├── index.ts                    # Main exports
├── payment-service.ts          # Central service
├── payment-types.ts            # Type definitions
├── payment-validator.ts        # Validation logic
├── payment-lifecycle.ts        # Status management
├── transaction-verifier.ts     # Blockchain verification
└── payment-events.ts           # Event tracking
```

#### Files Modified:
- None (backward compatible integration)

### Step 5: Test Payment Engine

#### Test 1: Create Payment
```bash
curl -X POST https://your-app.vercel.app/api/payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Test Payment",
    "amount": "10.50",
    "currency": "USDC"
  }'
```

#### Test 2: Verify Payment
```bash
curl -X POST https://your-app.vercel.app/api/payments/PAYMENT_ID?action=verify \
  -H "Content-Type: application/json"
```

#### Test 3: Check Events
```sql
-- In Supabase SQL Editor
SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 10;
```

### Step 6: Monitor

After deployment, monitor:

1. **Payment Creation Rate**
   ```sql
   SELECT COUNT(*), status 
   FROM payments 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY status;
   ```

2. **Event Processing**
   ```sql
   SELECT event_type, COUNT(*), MAX(created_at) as last_event
   FROM payment_events 
   GROUP BY event_type;
   ```

3. **Transaction Uniqueness**
   ```sql
   SELECT COUNT(*) as total_transactions,
          COUNT(DISTINCT tx_hash) as unique_transactions
   FROM payment_transactions;
   ```

## Rollback Plan

If you need to rollback:

### Emergency Rollback (Preserves Data)

```sql
-- Disable new features without removing data
ALTER TABLE payment_transactions DISABLE;
ALTER TABLE payment_events DISABLE;
```

### Full Rollback (Removes New Tables)

**⚠️ This will delete all event history**

```sql
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS payment_events CASCADE;

ALTER TABLE payments 
  DROP COLUMN IF EXISTS verified_amount,
  DROP COLUMN IF EXISTS metadata;
```

## Features & Benefits

### Enhanced Security
- ✅ Transaction hash uniqueness enforced at database level
- ✅ Prevents double-spending attacks
- ✅ Concurrent verification safety

### Better Tracking
- ✅ Full payment lifecycle events
- ✅ Audit trail for all status changes
- ✅ Verified amounts vs requested amounts

### Improved Reliability
- ✅ Retry logic for RPC failures
- ✅ Comprehensive error handling
- ✅ Idempotent operations

### Developer Experience
- ✅ Clear type definitions
- ✅ Comprehensive validation
- ✅ Helpful error messages

## Troubleshooting

### Issue: Migration fails with "table already exists"

**Solution:** Tables already created, safe to continue.

### Issue: Payments not being verified

**Check:**
1. RPC endpoint is accessible
2. Token contracts are correct
3. Wallet addresses are valid
4. Check payment_events table for error details

```sql
SELECT * FROM payment_events 
WHERE event_type LIKE '%failed%' 
ORDER BY created_at DESC;
```

### Issue: Transaction already used error

**Expected behavior:** This prevents double-spending. Each blockchain transaction can only fulfill one payment.

**Check:**
```sql
SELECT * FROM payment_transactions WHERE tx_hash = 'YOUR_TX_HASH';
```

## Support

For issues or questions:
1. Check payment_events table for detailed error logs
2. Review application logs
3. Verify database connectivity
4. Ensure Arc RPC endpoint is responsive

## Next Steps

After successful deployment:

1. **Monitor for 24 hours** - Watch for any unusual patterns
2. **Review events** - Check payment_events table regularly
3. **Test edge cases** - Try underpayments, overpayments, expired payments
4. **Plan webhooks** - Event system ready for webhook integration

## Compatibility Matrix

| Component | Version | Compatible |
|-----------|---------|------------|
| Next.js | 15.x | ✅ |
| Supabase | Latest | ✅ |
| PostgreSQL | 14+ | ✅ |
| Arc Network | Testnet | ✅ |
| Existing UI | All | ✅ |

## Performance Impact

Expected performance characteristics:

- **Payment Creation:** < 200ms (no change)
- **Transaction Detection:** < 2s (improved with caching)
- **Event Creation:** < 50ms (new feature)
- **Database Size:** +~100KB per 1000 payments (events)

## Security Considerations

The Payment Engine enhances security by:

1. **Server-side verification only** - No client-side trust
2. **Transaction uniqueness** - Database-level constraints
3. **Event immutability** - Audit trail cannot be modified
4. **RLS policies** - User data isolation maintained

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-13  
**Status:** Production Ready

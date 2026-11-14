# LumiaPay Quick Reference

## 🚀 Common Commands

### Development
```bash
# Start dev server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Build for production
npm run build

# Start production server
npm start
```

### Git Operations
```bash
# Check status
git status

# Add all changes
git add -A

# Commit with message
git commit -m "Your message"

# Push to GitHub
git push

# View recent commits
git log --oneline -5
```

### Database
```bash
# Connect to Supabase
psql "postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"

# Apply migration
\i supabase/migrations/001_payment_engine_tables.sql

# Check payments
SELECT id, status, amount, created_at FROM payments ORDER BY created_at DESC LIMIT 10;

# Check events
SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 10;
```

## 📂 Project Structure

```
LumiaPay/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── payments/             # Payment endpoints
│   │   │   ├── route.ts          # POST (create), GET (list)
│   │   │   └── [id]/route.ts     # GET, POST (verify), DELETE
│   │   └── cron/
│   │       └── monitor-payments/ # Background job
│   ├── dashboard/                # Dashboard page
│   ├── payments/                 # Payment pages
│   └── pay/[id]/                 # Checkout page
├── lib/
│   ├── payment-engine/           # ⭐ Payment Engine (Phase 1)
│   │   ├── payment-service.ts    # Main orchestration
│   │   ├── payment-validator.ts  # Input validation
│   │   ├── transaction-verifier.ts # Blockchain verification
│   │   ├── payment-lifecycle.ts  # Status transitions
│   │   ├── payment-events.ts     # Audit logging
│   │   ├── payment-types.ts      # TypeScript types
│   │   └── index.ts              # Public API
│   └── supabase/                 # Supabase client
├── __tests__/                    # Test files
│   ├── payment-engine.test.ts    # 44 tests
│   └── api-integration.test.ts   # 10 tests
├── supabase/
│   └── migrations/               # Database migrations
└── docs/                         # Documentation
    ├── PHASE1_COMPLETION.md      # Technical details
    ├── DEPLOYMENT_GUIDE.md       # Vercel setup
    └── NEXT_STEPS.md             # Roadmap
```

## 🔑 Environment Variables

### Required for Development
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_LUMIA_RPC_URL=https://testnet.lumia.org
```

### Required for Production
```env
# Same as development, plus:
CRON_SECRET=your-random-secret
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_EURC_ADDRESS=0x...
```

## 🧪 Testing

### Run Specific Test Suite
```bash
# Payment Engine tests only
npm test payment-engine

# Integration tests only
npm test api-integration

# Run with coverage
npm run test:coverage
```

### Test Structure
```typescript
// Example test
import { describe, test, expect } from '@jest/globals';
import { validateAmount } from '@/lib/payment-engine';

test('accepts valid decimal amounts', () => {
  expect(() => validateAmount('10.50')).not.toThrow();
  expect(() => validateAmount('0.01')).not.toThrow();
});
```

## 🔧 Payment Engine API

### Create Payment
```typescript
import { createPaymentIntent } from '@/lib/payment-engine';

const { validatedInput, ttlSeconds } = createPaymentIntent({
  user_id: 'uuid',
  label: 'Product Purchase',
  amount: '10.50',
  currency: 'USDC',
  wallet_address: '0x...'
});
```

### Verify Payment
```typescript
import { verifyPayment } from '@/lib/payment-engine';

const result = await verifyPayment({
  payment,
  txHash: '0x...',
  rpcUrl: process.env.NEXT_PUBLIC_LUMIA_RPC_URL,
  tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS
});

// result = { success: true, classification: 'exact', actualAmount: '10.50' }
```

### Get Payment
```typescript
import { getPaymentById } from '@/lib/payment-engine';

const payment = await getPaymentById('payment-id', supabase);
// Auto-checks expiry, updates status if needed
```

### Cancel Payment
```typescript
import { cancelPendingPayment } from '@/lib/payment-engine';

await cancelPendingPayment({
  paymentId: 'payment-id',
  userId: 'user-id',
  supabase
});
```

## 📊 Database Schema

### Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(20,6) NOT NULL,
  currency TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status payment_status DEFAULT 'pending',
  tx_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Status Values
- `pending` - Payment created, awaiting transaction
- `completed` - Transaction verified and confirmed
- `expired` - TTL exceeded without payment
- `cancelled` - Manually cancelled by user
- `review` - Requires manual review (underpayment, etc.)

## 🔍 Troubleshooting

### Dev Server Won't Start
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run dev
```

### Tests Failing
```bash
# Clear Jest cache
npm test -- --clearCache

# Run tests with verbose output
npm test -- --verbose
```

### Build Errors
```bash
# Check TypeScript errors
npm run typecheck

# Check for missing dependencies
npm install

# Clear build cache
rm -rf .next
npm run build
```

### Database Connection Issues
```bash
# Test Supabase connection
curl https://[project].supabase.co/rest/v1/ \
  -H "apikey: [ANON_KEY]"

# Should return 200 OK
```

### Cron Job Not Running
```bash
# Test cron endpoint manually
curl -X GET https://your-app.vercel.app/api/cron/monitor-payments \
  -H "Authorization: Bearer $CRON_SECRET"

# Check Vercel logs
vercel logs https://your-app.vercel.app --follow
```

## 📖 Common SQL Queries

### View Recent Payments
```sql
SELECT 
  id,
  label,
  amount,
  currency,
  status,
  created_at
FROM payments
ORDER BY created_at DESC
LIMIT 20;
```

### Check Payment Status Distribution
```sql
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM payments
GROUP BY status;
```

### Find Expired Payments
```sql
SELECT *
FROM payments
WHERE status = 'pending'
  AND expires_at < NOW()
ORDER BY expires_at DESC;
```

### View Payment Events
```sql
SELECT 
  pe.event_type,
  pe.old_status,
  pe.new_status,
  p.label,
  pe.created_at
FROM payment_events pe
JOIN payments p ON pe.payment_id = p.id
ORDER BY pe.created_at DESC
LIMIT 20;
```

### Check Transaction Assignments
```sql
SELECT 
  ta.tx_hash,
  p.label,
  p.amount,
  ta.assigned_at
FROM transaction_assignments ta
JOIN payments p ON ta.payment_id = p.id
ORDER BY ta.assigned_at DESC;
```

## 🎯 Quick Links

- **Repository:** https://github.com/riyadh2500/LumiaPay
- **Local Dev:** http://localhost:3000
- **Supabase:** https://supabase.com/dashboard
- **Vercel:** https://vercel.com/dashboard

## 📚 Documentation

- [Phase 1 Completion](./PHASE1_COMPLETION.md) - Technical details
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production setup
- [Next Steps](./NEXT_STEPS.md) - Roadmap and future features
- [README](./README.md) - Project overview

## 💡 Tips

1. **Always run tests before committing**
   ```bash
   npm test && git commit -m "Your message"
   ```

2. **Keep dependencies updated**
   ```bash
   npm update
   npm audit fix
   ```

3. **Monitor logs in production**
   ```bash
   vercel logs --follow
   ```

4. **Back up database regularly**
   - Supabase provides automatic backups
   - Export data monthly for additional safety

5. **Review payment_events for insights**
   - Track status changes
   - Identify patterns
   - Debug issues

---

**Version:** Phase 1 Complete  
**Last Updated:** January 13, 2024  
**Status:** ✅ Production Ready

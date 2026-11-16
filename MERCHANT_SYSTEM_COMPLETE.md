# Merchant Payment System - COMPLETE ✅

**Date:** 2026-11-16  
**Status:** Fully Working

## What's Working:

### ✅ 1. Settings Page
- **Path:** `/settings`
- **Features:**
  - Dynamic wallet address input
  - Business name configuration
  - Settings saved to `merchants` table
  - No hardcoded addresses

### ✅ 2. Payment Creation
- **Path:** `/payments/new`
- **API:** `POST /api/payments`
- **Features:**
  - Creates payment with merchant's wallet address
  - 15-minute expiry
  - QR code generation
  - Dynamic wallet from Settings

### ✅ 3. Payment Detection & Verification
- **Technology:** Arc Explorer API + Arc RPC
- **Features:**
  - Instant transaction detection (no range limitations)
  - Blockchain verification via Arc Testnet
  - Single-use QR codes (payment_transactions table)
  - Auto-complete on payment received
  - 5-second polling from checkout page

### ✅ 4. Checkout Page
- **Path:** `/pay/[id]`
- **Features:**
  - QR code display
  - Wallet address copy
  - Amount display
  - Countdown timer
  - Auto-refresh every 5 seconds
  - Success/Expired states

### ✅ 5. Dashboard
- **Path:** `/dashboard`
- **Features:**
  - Payment list
  - Status display
  - Quick stats
  - New payment button

## Database Schema (Staging: xmdeksqnzhvijaeblwhw)

### merchants
```sql
- id (uuid)
- user_id (uuid) - UNIQUE
- email (text)
- wallet_address (text) - DYNAMIC
- business_name (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### payments
```sql
- id (uuid)
- user_id (uuid)
- label (text)
- amount (text)
- currency (text)
- wallet_address (text) - From merchant settings
- payment_address (text)
- network (text)
- status (text)
- tx_hash (text)
- verified_amount (text)
- metadata (jsonb)
- expires_at (timestamp)
- created_at (timestamp)
- paid_at (timestamp)
- application_id (uuid) - For developer API
- environment (text) - For developer API
```

### payment_transactions (Single-use QR)
```sql
- id (uuid)
- payment_id (uuid)
- tx_hash (text) - UNIQUE constraint
- verified_amount (text)
- verified_at (timestamp)
- created_at (timestamp)
```

### payment_events (Audit log)
```sql
- id (uuid)
- payment_id (uuid)
- user_id (uuid)
- event_type (text)
- status (text)
- data (jsonb)
- processed (boolean)
- created_at (timestamp)
```

## Key Files - DO NOT MODIFY

### Core Payment Engine
- ✅ `lib/payment-engine/payment-service.ts` - Main payment logic
- ✅ `lib/payment-engine/transaction-verifier.ts` - Arc blockchain verification
- ✅ `lib/payment-engine/arc-explorer.ts` - Arc Explorer API integration
- ✅ `lib/payment-engine/payment-lifecycle.ts` - Status management
- ✅ `lib/payment-engine/payment-types.ts` - Type definitions

### API Routes (Merchant)
- ✅ `app/api/payments/route.ts` - Payment CRUD
- ✅ `app/api/payments/[id]/route.ts` - Payment detail & verify
- ✅ `app/api/merchant/route.ts` - Merchant settings

### UI Components (Merchant)
- ✅ `app/dashboard/page.tsx` - Dashboard
- ✅ `app/payments/new/page.tsx` - New payment
- ✅ `app/pay/[id]/checkout-client.tsx` - Checkout page
- ✅ `app/settings/page.tsx` - Settings
- ✅ `components/settings-form.tsx` - Settings form
- ✅ `components/new-payment-form.tsx` - Payment form

### Configuration
- ✅ `lib/network.ts` - Arc network config
- ✅ `lib/tokens.ts` - Token config (USDC/EURC)
- ✅ `lib/chain.ts` - Chain config
- ✅ `.env.local` - Environment variables (staging)

## Test Account
- **User ID:** `729b07ae-aee6-4fa2-b4f1-0c24e88956fd`
- **Email:** `srabonisultana78@gmail.com`
- **Wallet:** Dynamic (from Settings)

## Arc Testnet Config
- **RPC:** `https://rpc.testnet.arc.network`
- **Explorer:** `https://explorer.testnet.arc.io`
- **USDC Contract:** `0x3600000000000000000000000000000000000000`
- **Chain ID:** 5042002

## Important Notes

⚠️ **BLOCK_LOOKBACK = 100n** - Arc RPC has range limitations, uses Arc Explorer API as primary detection method

⚠️ **Payment TTL = 15 minutes** - User requested 15m instead of default 60m

⚠️ **No hardcoded wallets** - All wallet addresses come from merchant settings dynamically

⚠️ **Single-use QR codes** - `payment_transactions.tx_hash` has UNIQUE constraint

## Working Flow

1. User logs in → Dashboard
2. Settings → Set wallet address & business name
3. New Payment → Create payment (uses wallet from Settings)
4. QR Code → Customer scans & sends USDC
5. Arc Explorer API → Detects transaction instantly
6. Payment Status → Auto-updates to "paid"
7. Dashboard → Shows completed payment

---

**Status: COMPLETE - Ready for Developer API Integration**

Next Phase: Developer API Platform (DO NOT modify above files unless necessary)

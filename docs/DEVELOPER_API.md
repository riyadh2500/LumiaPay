# LumiaPay Developer API Documentation

## Overview

The LumiaPay Developer API allows you to integrate stablecoin payments (USDC, EURC) on the Arc Network into your application. Create payment requests, track payment status, and manage your integration programmatically.

**Base URL:** `https://lumia-pay.vercel.app/api/v1`

## Authentication

All API requests require authentication using your API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### API Key Types

**Publishable Keys** (`pk_test_...` or `pk_live_...`)
- Safe to use in client-side code
- Read-only access to payments
- Cannot create or modify payments

**Secret Keys** (`sk_test_...` or `sk_live_...`)
- **Never expose in client-side code**
- Full read and write access
- Store securely on your server

### Environments

**Test Environment** (`_test_` keys)
- Simulated payments (no blockchain transactions)
- Perfect for development and testing
- No real funds involved

**Live Environment** (`_live_` keys)
- Real Arc Network transactions
- Actual USDC/EURC transfers
- Production use only

## Rate Limiting

Rate limits apply per API key:

- **Payment Creation:** 30 requests/minute
- **Payment Retrieval:** 60 requests/minute
- **Payment List:** 60 requests/minute

When you exceed the limit, you'll receive a `429 Too Many Requests` response with a `Retry-After` header indicating when you can retry.

## Endpoints

### Create Payment

Creates a new payment request.

**Endpoint:** `POST /api/v1/payments`

**Permission:** `payments:write`

**Request Body:**

```json
{
  "amount": "100.00",
  "currency": "USDC",
  "label": "Invoice #1234",
  "metadata": {
    "customer_id": "cus_abc123",
    "invoice_id": "inv_001"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | Yes | Payment amount (e.g., "100.00") |
| `currency` | string | Yes | `"USDC"` or `"EURC"` |
| `label` | string | Yes | Description (1-200 characters) |
| `metadata` | object | No | Custom key-value pairs |

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": "100.00",
  "currency": "USDC",
  "status": "pending",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
  "expires_at": "2025-01-15T10:30:00Z",
  "checkout_url": "https://lumia-pay.vercel.app/checkout/550e8400-...",
  "created_at": "2025-01-15T10:00:00Z",
  "environment": "live"
}
```

**Example:**

```bash
curl https://lumia-pay.vercel.app/api/v1/payments \
  -X POST \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "50.00",
    "currency": "USDC",
    "label": "Product Purchase"
  }'
```

---

### Retrieve Payment

Retrieves a single payment by ID.

**Endpoint:** `GET /api/v1/payments/:id`

**Permission:** `payments:read`

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": "100.00",
  "currency": "USDC",
  "status": "paid",
  "label": "Invoice #1234",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
  "tx_hash": "0xabc...",
  "verified_amount": "100.00",
  "created_at": "2025-01-15T10:00:00Z",
  "expires_at": "2025-01-15T10:30:00Z",
  "paid_at": "2025-01-15T10:15:00Z",
  "environment": "live",
  "metadata": {
    "customer_id": "cus_abc123"
  },
  "checkout_url": "https://lumia-pay.vercel.app/checkout/550e8400-..."
}
```

**Example:**

```bash
curl https://lumia-pay.vercel.app/api/v1/payments/550e8400-... \
  -H "Authorization: Bearer sk_live_..."
```

---

### List Payments

Lists payments created by your application with pagination and filtering.

**Endpoint:** `GET /api/v1/payments`

**Permission:** `payments:read`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status (see Payment Status) |
| `limit` | integer | No | Results per page (1-100, default 20) |
| `offset` | integer | No | Pagination offset (default 0) |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "550e8400-...",
      "amount": "100.00",
      "currency": "USDC",
      "status": "paid",
      "label": "Invoice #1234",
      "created_at": "2025-01-15T10:00:00Z",
      "paid_at": "2025-01-15T10:15:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 142
  }
}
```

**Example:**

```bash
# List paid payments
curl "https://lumia-pay.vercel.app/api/v1/payments?status=paid&limit=10" \
  -H "Authorization: Bearer sk_live_..."
```

---

### Cancel Payment

Cancels a pending payment.

**Endpoint:** `POST /api/v1/payments/:id/cancel`

**Permission:** `payments:write`

**Requirements:**
- Payment status must be `pending`, `created`, or `detecting`
- Cannot cancel paid or expired payments

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "expired",
  "cancelled_at": "2025-01-15T10:20:00Z"
}
```

**Example:**

```bash
curl https://lumia-pay.vercel.app/api/v1/payments/550e8400-.../cancel \
  -X POST \
  -H "Authorization: Bearer sk_live_..."
```

---

## Payment Status

| Status | Description |
|--------|-------------|
| `created` | Payment request initialized |
| `pending` | Awaiting blockchain confirmation |
| `detecting` | Searching for matching transaction |
| `verifying` | Validating transaction details |
| `paid` | Payment successfully completed |
| `underpaid` | Received less than requested amount |
| `overpaid` | Received more than requested amount |
| `expired` | Payment window expired (default: 30 minutes) |
| `failed` | Payment failed verification |
| `review_required` | Manual review needed |

## Error Responses

All errors return JSON with `error` and `message` fields:

**401 Unauthorized**
```json
{
  "error": "authentication_required",
  "message": "API key required. Include Authorization: Bearer <your_api_key>"
}
```

**403 Forbidden**
```json
{
  "error": "permission_denied",
  "message": "Your API key does not have write permission for payments"
}
```

**404 Not Found**
```json
{
  "error": "payment_not_found",
  "message": "Payment not found"
}
```

**422 Unprocessable Entity**
```json
{
  "error": "validation_error",
  "message": "Invalid request body",
  "details": [
    {
      "path": ["amount"],
      "message": "Invalid amount format"
    }
  ]
}
```

**429 Too Many Requests**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 30
}
```

**500 Internal Server Error**
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

## Best Practices

### Security

1. **Never expose secret keys** in client-side code, public repositories, or browser applications
2. **Rotate keys regularly** - Create new keys and revoke old ones periodically
3. **Use environment variables** to store keys, never hardcode them
4. **Implement webhook signatures** (Phase 2.2) to verify webhook authenticity

### Error Handling

Always handle errors gracefully:

```javascript
try {
  const response = await fetch('https://lumia-pay.vercel.app/api/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LUMIAPAY_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: '100.00',
      currency: 'USDC',
      label: 'Product Purchase',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = error.retry_after || 60;
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    } else {
      console.error('Payment creation failed:', error.message);
    }
    return;
  }

  const payment = await response.json();
  console.log('Payment created:', payment.id);
  console.log('Checkout URL:', payment.checkout_url);
} catch (err) {
  console.error('Network error:', err);
}
```

### Idempotency

Use `metadata` to include unique identifiers:

```javascript
{
  "amount": "100.00",
  "currency": "USDC",
  "label": "Order #12345",
  "metadata": {
    "order_id": "12345",
    "idempotency_key": "unique-key-12345"
  }
}
```

Query by metadata to check if a payment already exists before creating a new one.

### Webhooks (Coming in Phase 2.2)

Webhooks will notify your server when payment events occur:
- `payment.paid`
- `payment.failed`
- `payment.expired`

Configure webhook URLs in your developer dashboard.

## Support

- **Documentation:** https://lumiapay.dev/docs
- **GitHub:** https://github.com/riyadh2500/LumiaPay
- **Issues:** https://github.com/riyadh2500/LumiaPay/issues


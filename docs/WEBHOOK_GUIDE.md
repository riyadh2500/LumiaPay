# LumiaPay Webhook গাইড

## Webhooks কী?

Webhooks হলো **Real-time Notifications** যা আপনার server-এ payment events সম্পর্কে জানায়।

যখন কোনো payment paid, failed, বা expired হয়, LumiaPay আপনার webhook URL-এ একটি HTTP POST request পাঠায়।

---

## কেন Webhooks প্রয়োজন?

**Polling না করে Real-time Update পাও:**

❌ **Polling (Old Way):**
```javascript
// প্রতি 10 সেকেন্ডে API call
setInterval(async () => {
  const payment = await fetch('/api/v1/payments/xxx');
  if (payment.status === 'paid') {
    // Update order
  }
}, 10000);
```

✅ **Webhooks (Better Way):**
```javascript
// একবার webhook setup করো
// Payment paid হলে automatic notification পাবে
app.post('/webhooks/lumiapay', (req, res) => {
  const event = req.body;
  if (event.type === 'payment.paid') {
    // Update order immediately
  }
});
```

---

## Webhook Setup

### Step 1: Webhook Endpoint তৈরি করো

আপনার server-এ একটি endpoint তৈরি করো:

```javascript
// Node.js / Express example
app.post('/webhooks/lumiapay', async (req, res) => {
  const signature = req.headers['x-lumiapay-signature'];
  const payload = JSON.stringify(req.body);

  // Verify signature (security!)
  const isValid = verifySignature(payload, signature, WEBHOOK_SECRET);
  
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  // Handle different event types
  switch (event.type) {
    case 'payment.paid':
      await handlePaymentPaid(event.data.payment);
      break;
    case 'payment.failed':
      await handlePaymentFailed(event.data.payment);
      break;
    case 'payment.expired':
      await handlePaymentExpired(event.data.payment);
      break;
  }

  // Return 200 quickly (don't keep webhook waiting)
  res.status(200).send('OK');
});
```

### Step 2: LumiaPay-তে Webhook Register করো

**API Call:**

```bash
curl https://lumia-pay.vercel.app/api/developer/applications/YOUR_APP_ID/webhooks \
  -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhooks/lumiapay",
    "description": "Production webhook",
    "enabled_events": ["payment.paid", "payment.failed", "payment.expired"]
  }'
```

**Response:**

```json
{
  "id": "wh_123...",
  "url": "https://your-domain.com/webhooks/lumiapay",
  "secret": "whsec_abc123xyz789...",
  "enabled_events": ["payment.paid", "payment.failed", "payment.expired"],
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z",
  "warning": "Save your webhook secret now. You cannot view it again."
}
```

⚠️ **Secret সংরক্ষণ করো:** এটি signature verify করার জন্য লাগবে!

---

## Webhook Event Structure

প্রতিটি webhook request-এ এই structure থাকবে:

```json
{
  "id": "evt_abc123",
  "type": "payment.paid",
  "created_at": "2025-01-15T10:15:00Z",
  "data": {
    "payment": {
      "id": "550e8400-...",
      "amount": "100.00",
      "currency": "USDC",
      "status": "paid",
      "label": "Invoice #1234",
      "wallet_address": "0x742d35Cc...",
      "tx_hash": "0xabc...",
      "verified_amount": "100.00",
      "created_at": "2025-01-15T10:00:00Z",
      "paid_at": "2025-01-15T10:15:00Z",
      "environment": "live",
      "metadata": {
        "order_id": "12345"
      }
    }
  }
}
```

---

## Webhook Event Types

| Event Type | কখন Trigger হয় |
|------------|-----------------|
| `payment.created` | Payment তৈরি হলে |
| `payment.paid` | Payment সফল হলে |
| `payment.failed` | Payment verification ফেল করলে |
| `payment.expired` | Payment এর সময় শেষ হলে |
| `payment.cancelled` | Payment cancel করলে |
| `payment.underpaid` | কম amount পাঠালে |
| `payment.overpaid` | বেশি amount পাঠালে |

---

## Signature Verification (Security)

**Webhook signatures verify করা অত্যন্ত গুরুত্বপূর্ণ!** নাহলে কেউ fake webhooks পাঠিয়ে আপনার system hack করতে পারে।

### Signature Format

```
X-LumiaPay-Signature: t=1705320000,v1=a3b2c1d4e5f6...
```

- `t` = Timestamp (Unix seconds)
- `v1` = HMAC-SHA256 signature

### Verification Code (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signatureHeader, secret) {
  // Parse signature header
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
  const signature = parts.find(p => p.startsWith('v1=')).split('=')[1];

  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    // Reject if timestamp is older than 5 minutes
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Constant-time comparison (prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Verification Code (Python)

```python
import hmac
import hashlib
import time

def verify_webhook_signature(payload, signature_header, secret):
    # Parse signature header
    parts = dict(item.split('=') for item in signature_header.split(','))
    timestamp = int(parts['t'])
    signature = parts['v1']

    # Check timestamp
    now = int(time.time())
    if abs(now - timestamp // 1000) > 300:
        return False

    # Compute expected signature
    signed_payload = f"{timestamp}.{payload}"
    expected_signature = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison
    return hmac.compare_digest(signature, expected_signature)
```

---

## Retry Logic

যদি আপনার webhook endpoint থেকে `2xx` response না আসে, LumiaPay automatically retry করবে:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 5 seconds |
| 3 | 25 seconds |
| 4 | 125 seconds (~2 minutes) |
| 5 | 625 seconds (~10 minutes) |

5 attempts এর পরেও fail হলে webhook `failed` mark করা হবে।

---

## Best Practices

### ✅ DO:

1. **Signature verify করো** - প্রতিটি webhook request verify করো
2. **Idempotency handle করো** - একই event একাধিকবার আসতে পারে
3. **200 quickly return করো** - Processing শেষ হওয়ার আগেই respond করো
4. **HTTPS ব্যবহার করো** - HTTP webhooks allowed নেই
5. **Error log করো** - Failed webhooks debug করার জন্য log রাখো

### ❌ DON'T:

1. **Long processing করো না** - Webhook request 10 seconds timeout
2. **Signature skip করো না** - Security risk!
3. **Same event twice process করো না** - `event.id` track করো
4. **Sensitive data expose করো না** - Webhook logs public হতে পারে

---

## Example: Order Fulfillment

```javascript
const processedEvents = new Set(); // In-memory (use Redis/DB in production)

app.post('/webhooks/lumiapay', async (req, res) => {
  const signature = req.headers['x-lumiapay-signature'];
  const payload = JSON.stringify(req.body);

  // 1. Verify signature
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  // 2. Check idempotency
  if (processedEvents.has(event.id)) {
    return res.status(200).send('Already processed');
  }

  // 3. Return 200 immediately
  res.status(200).send('OK');

  // 4. Process asynchronously
  processEvent(event).catch(err => {
    console.error('Event processing failed:', err);
  });
});

async function processEvent(event) {
  processedEvents.add(event.id);

  if (event.type === 'payment.paid') {
    const payment = event.data.payment;
    const orderId = payment.metadata.order_id;

    // Update order status in database
    await db.orders.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        payment_id: payment.id,
        tx_hash: payment.tx_hash,
        paid_at: payment.paid_at,
      },
    });

    // Send confirmation email
    await sendEmail({
      to: payment.metadata.customer_email,
      subject: 'Payment Received',
      body: `Your payment of ${payment.amount} ${payment.currency} has been confirmed.`,
    });

    // Fulfill order
    await fulfillOrder(orderId);
  }
}
```

---

## Testing Webhooks

### Local Testing with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Start your local server
npm run dev

# Expose to internet
ngrok http 3000

# Use ngrok URL in webhook settings
# Example: https://abc123.ngrok.io/webhooks/lumiapay
```

### Manual Testing

```bash
# Send test webhook
curl https://your-domain.com/webhooks/lumiapay \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-LumiaPay-Signature: t=1705320000,v1=..." \
  -d '{
    "id": "evt_test",
    "type": "payment.paid",
    "created_at": "2025-01-15T10:00:00Z",
    "data": { ... }
  }'
```

---

## Troubleshooting

### Webhook Not Receiving

1. Check URL accessible: `curl -I https://your-domain.com/webhooks/lumiapay`
2. Check HTTPS enabled
3. Check firewall settings
4. Check webhook endpoint registered correctly

### Signature Verification Failing

1. Check secret সঠিক আছে কিনা
2. Check timestamp difference < 5 minutes
3. Check payload exactly same (whitespace matters!)
4. Check HMAC algorithm = SHA256

### Duplicate Events Receiving

- Normal behavior! Idempotency handle করো
- `event.id` track করে duplicate skip করো

---

## Support

- **Documentation:** https://lumiapay.dev/docs/webhooks
- **Example Code:** https://github.com/riyadh2500/LumiaPay/tree/main/examples
- **Issues:** https://github.com/riyadh2500/LumiaPay/issues


# LumiaPay Developer Portal - Quick Start Guide

**For Developers Using the LumiaPay Platform**

---

## 🚀 Getting Started

### 1. Create Your Application

1. Log in to LumiaPay
2. Navigate to **Developer** → **Applications** in the sidebar
3. Click **"Create Application"**
4. Fill in the form:
   - **Name:** Your application name (e.g., "My E-commerce Store")
   - **Description:** Brief description (optional)
   - **Environment:** Choose `production` or `sandbox`
5. Click **"Create Application"**

### 2. Get Your API Key

After creating your application:
- Your API key will be displayed **once**
- Copy it immediately using the **"Copy API Key"** button
- Store it securely (you won't see it again!)
- Format: `lum_live_xxxxxxxx` (production) or `lum_test_xxxxxxxx` (sandbox)

---

## 💳 Create Your First Payment

### Using cURL

```bash
curl -X POST https://your-domain.com/api/v1/payments \
  -H "Authorization: Bearer lum_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "BDT",
    "customer_email": "customer@example.com",
    "redirect_url": "https://your-site.com/success",
    "metadata": {
      "order_id": "ORDER-123"
    }
  }'
```

### Using Node.js

```javascript
const response = await fetch('https://your-domain.com/api/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer lum_live_xxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5000,
    currency: 'BDT',
    customer_email: 'customer@example.com',
    redirect_url: 'https://your-site.com/success',
    metadata: {
      order_id: 'ORDER-123'
    }
  })
});

const payment = await response.json();
console.log('Checkout URL:', payment.checkout_url);
```

### Response

```json
{
  "id": "pay_xxxxxxxxx",
  "amount": 5000,
  "currency": "BDT",
  "status": "pending",
  "customer_email": "customer@example.com",
  "checkout_url": "https://your-domain.com/pay/pay_xxxxxxxxx",
  "redirect_url": "https://your-site.com/success",
  "metadata": {
    "order_id": "ORDER-123"
  },
  "created_at": "2024-11-15T10:00:00Z"
}
```

---

## 🔔 Set Up Webhooks

### 1. Create Webhook Endpoint

In your application (e.g., Node.js/Express):

```javascript
// POST /webhooks/lumiapay
app.post('/webhooks/lumiapay', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-lumiapay-signature'];
  const payload = req.body;
  
  // Verify signature (see below)
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  // Handle event
  switch (event.type) {
    case 'payment.paid':
      console.log('Payment successful:', event.data.id);
      // Update your order status
      break;
    case 'payment.failed':
      console.log('Payment failed:', event.data.id);
      // Notify customer
      break;
  }
  
  res.status(200).send('OK');
});
```

### 2. Verify Webhook Signatures

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 3. Register Webhook in Dashboard

1. Go to **Developer** → **Applications**
2. Click your application
3. Click **"Add Webhook"** (coming soon in UI - use API for now)
4. Enter your webhook URL: `https://your-site.com/webhooks/lumiapay`
5. Select events to listen to:
   - `payment.paid`
   - `payment.failed`
   - `payment.expired`
   - `payment.cancelled`
6. Save your webhook secret

---

## 📊 Monitor Your Integration

### Developer Overview
Navigate to **Developer** → **Overview** to see:
- Total applications
- Active API keys
- API requests (last 30 days)
- Webhook success rate

### API Logs
Navigate to **Developer** → **API Logs** to see:
- Last 50 API requests
- Payment details (ID, amount, status)
- Application and environment
- Timestamps

### Analytics
Navigate to **Developer** → **Analytics** to see:
- Per-application statistics
- API requests (last 7 days)
- Successful payments count
- Total payment volume
- Webhook success rate

---

## 🧪 Testing with Sandbox

### Sandbox Environment

1. Create a **sandbox** application
2. Use sandbox API keys (`lum_test_xxxxxxxx`)
3. All payments are simulated (no real money)

### Test Cards (Stripe Integration)

```
Successful Payment:  4242 4242 4242 4242
Declined Payment:    4000 0000 0000 0002
Insufficient Funds:  4000 0000 0000 9995

Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
```

### Test Webhooks

- Sandbox webhooks are sent to your endpoint
- Use ngrok for local testing: `ngrok http 3000`
- Update webhook URL to ngrok URL

---

## 📚 Full Documentation

### API Reference
- **Full API Docs:** See `docs/DEVELOPER_API.md`
- **Webhook Guide:** See `docs/WEBHOOK_GUIDE.md`

### Available Endpoints

```
POST   /api/v1/payments              Create payment
GET    /api/v1/payments              List payments
GET    /api/v1/payments/:id          Retrieve payment
POST   /api/v1/payments/:id/cancel   Cancel payment
```

### Authentication

All API requests require the `Authorization` header:

```
Authorization: Bearer lum_live_xxxxxxxx
```

---

## 🔒 Security Best Practices

### API Keys
- ✅ Store API keys in environment variables (never commit to git)
- ✅ Use production keys only in production
- ✅ Rotate keys regularly
- ✅ Revoke unused keys
- ❌ Never expose keys in client-side code
- ❌ Never share keys publicly

### Webhooks
- ✅ Always verify webhook signatures
- ✅ Use HTTPS for webhook endpoints
- ✅ Return 200 status code quickly (process async)
- ✅ Implement idempotency (same event may be sent multiple times)
- ❌ Never disable signature verification
- ❌ Never expose webhook secrets

---

## 🐛 Troubleshooting

### API Key Not Working
- Check if key starts with `lum_live_` or `lum_test_`
- Verify key is active (not revoked)
- Ensure you copied the full key (including prefix)
- Check environment matches (production vs sandbox)

### Payment Not Created
- Verify amount is >= 100 (minimum 1 BDT in cents)
- Check currency is valid (BDT, USD, EUR)
- Ensure customer_email is valid email format
- Confirm redirect_url is valid URL

### Webhook Not Received
- Check webhook URL is publicly accessible (use ngrok for local)
- Verify HTTPS is used (HTTP may be blocked)
- Ensure endpoint returns 200 status code
- Check webhook endpoint is enabled
- Review webhook attempts in database (for developers)

### "Unauthorized" Error
- Verify `Authorization` header is present
- Check header format: `Bearer lum_live_xxxxx` (with space)
- Ensure API key is not revoked
- Confirm key belongs to correct environment

---

## 💡 Example Use Cases

### E-commerce Checkout
```javascript
// Customer clicks "Pay Now"
const payment = await createPayment({
  amount: cartTotal,
  currency: 'BDT',
  customer_email: user.email,
  redirect_url: `${siteUrl}/orders/${orderId}/success`,
  metadata: { order_id: orderId }
});

// Redirect customer to payment page
window.location.href = payment.checkout_url;

// Handle webhook to confirm payment
// POST /webhooks/lumiapay receives payment.paid event
// Update order status to "paid"
```

### Subscription Billing
```javascript
// Monthly recurring payment
async function chargeSubscription(subscription) {
  const payment = await createPayment({
    amount: subscription.plan.price,
    currency: 'BDT',
    customer_email: subscription.user.email,
    redirect_url: `${siteUrl}/billing/success`,
    metadata: {
      subscription_id: subscription.id,
      billing_period: '2024-11'
    }
  });
  
  // Send payment link via email
  await sendEmail(subscription.user.email, {
    subject: 'Your monthly subscription payment',
    payment_link: payment.checkout_url
  });
}
```

### Marketplace Payouts
```javascript
// Create payment for seller payout
const payout = await createPayment({
  amount: sellerEarnings,
  currency: 'BDT',
  customer_email: seller.email,
  redirect_url: `${marketplaceUrl}/payouts/${payoutId}`,
  metadata: {
    seller_id: seller.id,
    payout_period: 'week-46-2024',
    orders: orderIds.join(',')
  }
});

// Track payout via webhooks
// payment.paid → Mark payout as complete
// payment.failed → Retry payout next cycle
```

---

## 🆘 Support

### Resources
- **API Docs:** Navigate to **Developer** → **Docs** in dashboard
- **Webhook Guide:** See docs/WEBHOOK_GUIDE.md
- **Sandbox:** Test integrations in sandbox environment

### Getting Help
- Check API Logs for request/response details
- Review webhook attempts for delivery issues
- Verify environment (production vs sandbox)
- Contact support with payment ID for specific issues

---

## ✅ Checklist for Going Live

### Development
- [ ] Test integration in sandbox environment
- [ ] Verify webhook signature verification works
- [ ] Handle all payment statuses (paid, failed, expired, cancelled)
- [ ] Test error scenarios (declined cards, insufficient funds)
- [ ] Implement proper error handling and logging

### Security
- [ ] Store API keys in environment variables
- [ ] Use HTTPS for webhook endpoints
- [ ] Verify webhook signatures on every request
- [ ] Implement rate limiting on your webhook endpoint
- [ ] Never expose API keys or webhook secrets

### Production
- [ ] Create production application in dashboard
- [ ] Generate production API key
- [ ] Update production environment variables
- [ ] Register production webhook URL
- [ ] Test with real card (small amount)
- [ ] Monitor API logs and webhook delivery
- [ ] Set up error alerts

---

**Quick Links:**
- Developer Overview: `/developer`
- Create Application: `/developer/applications`
- API Logs: `/developer/logs`
- Analytics: `/developer/analytics`
- Documentation: `/developer/docs`

**Happy Building! 🚀**

# LumiaPay Deployment Guide

## Quick Start Deployment to Vercel

### Prerequisites
- ✅ GitHub repository: https://github.com/riyadh2500/LumiaPay
- ✅ Supabase account with project created
- ✅ Lumia testnet access
- ✅ Vercel account

### Step 1: Supabase Setup

#### 1.1 Apply Database Migration
```bash
# Connect to your Supabase project
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Apply the migration
\i supabase/migrations/001_payment_engine_tables.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/001_payment_engine_tables.sql`
3. Run the query

#### 1.2 Verify Tables Created
```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
AND tablename IN ('payments', 'payment_events', 'transaction_assignments');

-- Should return 3 rows
```

#### 1.3 Configure Authentication Redirect URLs
In Supabase Dashboard → Authentication → URL Configuration:

**Site URL:**
```
https://your-app.vercel.app
```

**Redirect URLs (add all):**
```
http://localhost:3000/auth/callback
https://your-app.vercel.app/auth/callback
https://your-app-*.vercel.app/auth/callback
```

### Step 2: Environment Variables

#### 2.1 Get Supabase Credentials
From Supabase Dashboard → Project Settings → API:
- Project URL: `https://[project-ref].supabase.co`
- Anon (public) key: `eyJ...`
- Service role key: `eyJ...` (keep secret!)

#### 2.2 Generate Cron Secret
```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

#### 2.3 Environment Variables List
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Lumia Blockchain
NEXT_PUBLIC_LUMIA_RPC_URL=https://testnet.lumia.org
NEXT_PUBLIC_USDC_ADDRESS=0x... (your USDC token address)
NEXT_PUBLIC_EURC_ADDRESS=0x... (your EURC token address)

# Cron Job Security
CRON_SECRET=your-generated-secret-from-step-2.2
```

### Step 3: Deploy to Vercel

#### 3.1 Connect GitHub Repository
1. Go to https://vercel.com/new
2. Import your GitHub repository: `riyadh2500/LumiaPay`
3. Vercel will auto-detect Next.js configuration

#### 3.2 Configure Environment Variables
In Vercel project settings → Environment Variables:

Add all variables from Step 2.3:
- Select "Production", "Preview", and "Development" for each
- Click "Add" for each variable

#### 3.3 Deploy
1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Vercel will provide your deployment URL

#### 3.4 Verify Deployment
Visit your deployment URL and test:
- ✅ Homepage loads
- ✅ Can sign up / log in
- ✅ Can create payment
- ✅ Can view dashboard

### Step 4: Configure Vercel Cron

#### 4.1 Automatic Setup
Vercel Cron is configured via `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/monitor-payments",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs automatically after deployment!

#### 4.2 Verify Cron Job
1. Go to Vercel Dashboard → Your Project → Cron Jobs
2. You should see: `/api/cron/monitor-payments` running every 5 minutes
3. Check logs to verify execution

#### 4.3 Test Cron Job Manually
```bash
curl -X GET https://your-app.vercel.app/api/cron/monitor-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "message": "No expired payments found",
  "expired": 0,
  "timestamp": "2024-01-13T..."
}
```

### Step 5: Update Supabase Redirect URLs

After deployment, update Supabase with your actual Vercel URL:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your production URL:
   ```
   https://your-actual-app.vercel.app/auth/callback
   ```

### Step 6: Post-Deployment Testing

#### 6.1 Authentication Flow
1. Visit `https://your-app.vercel.app`
2. Click "Sign Up"
3. Create account with email
4. Check email for confirmation
5. Click confirmation link
6. Verify redirect to dashboard

#### 6.2 Payment Creation Flow
1. Log in to dashboard
2. Click "Create Payment"
3. Enter:
   - Label: "Test Payment"
   - Amount: "10.00"
   - Currency: USDC
4. Submit
5. Verify payment appears in dashboard with "pending" status

#### 6.3 Payment Expiry Flow
1. Create payment with default TTL (1 hour)
2. Wait 5-10 minutes for cron job
3. OR manually update expires_at to past time in Supabase
4. Wait for next cron execution (max 5 minutes)
5. Verify status changes to "expired"

#### 6.4 Payment Verification Flow (requires real blockchain transaction)
1. Create payment
2. Send actual USDC transaction to wallet address shown
3. Copy transaction hash
4. Go to payment page
5. Enter transaction hash
6. Submit verification
7. Verify status changes to "completed"

### Step 7: Monitoring & Logs

#### 7.1 View Deployment Logs
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# View logs
vercel logs https://your-app.vercel.app
```

#### 7.2 Monitor Cron Jobs
Vercel Dashboard → Your Project → Cron Jobs → View Logs

Look for:
```
[Cron] Marked X payments as expired
[Cron] No expired payments found
```

#### 7.3 Monitor Database
In Supabase Dashboard → Database → Tables:

**Check payment_events:**
```sql
SELECT * FROM payment_events 
WHERE event_type = 'status_change' 
ORDER BY created_at DESC 
LIMIT 20;
```

**Check transaction_assignments:**
```sql
SELECT * FROM transaction_assignments 
ORDER BY assigned_at DESC 
LIMIT 10;
```

### Step 8: Custom Domain (Optional)

#### 8.1 Add Domain in Vercel
1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain (e.g., `lumia-pay.com`)
3. Follow DNS configuration instructions

#### 8.2 Update Supabase URLs
Add your custom domain to Supabase redirect URLs:
```
https://lumia-pay.com/auth/callback
```

## Troubleshooting

### Build Fails
**Check:**
- All environment variables are set
- No TypeScript errors: `npm run typecheck`
- Build passes locally: `npm run build`

**Common Issues:**
- Missing `NEXT_PUBLIC_SUPABASE_URL` → Add in Vercel
- Module not found → Clear cache and redeploy

### Authentication Doesn't Work
**Check:**
- Redirect URLs in Supabase match your Vercel URL
- Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Site URL in Supabase matches your deployment

**Fix:**
1. Copy exact URL from Vercel deployment
2. Add to Supabase redirect URLs
3. Redeploy

### Cron Job Not Running
**Check:**
- `vercel.json` is in root directory
- Cron job appears in Vercel Dashboard → Cron Jobs
- `CRON_SECRET` is set in environment variables

**Test Manually:**
```bash
curl -X GET https://your-app.vercel.app/api/cron/monitor-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET" -v
```

Should return 200 OK with JSON response.

### Payments Not Expiring
**Check:**
1. Cron job is running (check Vercel logs)
2. Database has `expires_at` timestamp set
3. Current time is past `expires_at`

**Manual Fix:**
```sql
-- Force expire old pending payments
UPDATE payments 
SET status = 'expired', updated_at = NOW() 
WHERE status = 'pending' 
AND expires_at < NOW();
```

### Transaction Verification Fails
**Check:**
- `NEXT_PUBLIC_LUMIA_RPC_URL` is correct
- Token addresses (`NEXT_PUBLIC_USDC_ADDRESS`) are correct
- Transaction hash is valid and confirmed on blockchain
- Transaction sent to correct wallet address
- Amount matches payment amount

**Debug:**
1. Check transaction on Lumia block explorer
2. Verify Transfer event exists
3. Verify recipient matches payment wallet_address
4. Check RPC endpoint is accessible

## Production Checklist

Before going live:

### Security
- [ ] `CRON_SECRET` is strong and secret (32+ bytes random)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Vercel (not in code)
- [ ] RLS policies enabled on Supabase tables
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Auth redirect URLs limited to your domains only

### Testing
- [ ] All tests pass: `npm test` (54/54)
- [ ] Build passes: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Can sign up and log in
- [ ] Can create payment
- [ ] Cron job marks payments as expired
- [ ] Transaction verification works (with real tx)

### Monitoring
- [ ] Vercel logs accessible
- [ ] Supabase monitoring enabled
- [ ] Error tracking configured (optional: Sentry)
- [ ] Cron job execution visible in Vercel

### Documentation
- [ ] README updated with live URL
- [ ] API documentation accessible
- [ ] User guide created (optional)

### Backup
- [ ] Database backup strategy in place (Supabase auto-backups enabled)
- [ ] Environment variables documented and backed up securely
- [ ] Git repository up to date

## Support & Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Check Vercel deployment logs for errors
- Review payment_events for anomalies
- Verify cron job execution count

**Monthly:**
- Review and clean up expired payments older than 90 days
- Check database performance (Supabase Dashboard)
- Review and update dependencies

**Security Updates:**
```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Test after updates
npm test
npm run build
```

### Database Cleanup

Clean up old expired payments (optional):
```sql
-- Delete expired payments older than 90 days
DELETE FROM payments 
WHERE status = 'expired' 
AND created_at < NOW() - INTERVAL '90 days';

-- Clean up corresponding events
DELETE FROM payment_events 
WHERE payment_id NOT IN (SELECT id FROM payments);
```

## Contact & Support

- **GitHub Issues:** https://github.com/riyadh2500/LumiaPay/issues
- **Documentation:** See `PHASE1_COMPLETION.md` for technical details
- **Supabase Support:** https://supabase.com/docs
- **Vercel Support:** https://vercel.com/docs

---

**Deployment Status:** ✅ Ready for Production  
**Last Updated:** January 13, 2024  
**Version:** Phase 1 Complete (Commit: 26640a3)

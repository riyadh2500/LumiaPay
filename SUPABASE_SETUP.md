# 🔐 Supabase Setup Guide

## ⚠️ Email Confirmation Issue Fix

If you're getting "localhost refused to connect" after email confirmation, follow these steps:

### Step 1: Configure Redirect URLs in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/fpluaqkhstuxbmcnugbx
2. Navigate to: **Authentication → URL Configuration**
3. Add these URLs:

#### Site URL:
```
http://localhost:3000
```

#### Redirect URLs (Add all of these):
```
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
http://localhost:3000/*
```

#### For Production (Vercel):
```
https://your-domain.vercel.app/auth/callback
https://your-domain.vercel.app/dashboard
https://your-domain.vercel.app/*
```

### Step 2: Update Email Templates (Optional but Recommended)

Go to **Authentication → Email Templates** and make sure the confirmation URL is correct:

```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

### Step 3: Make Sure Local Server is Running

```bash
npm run dev
```

Your server should be running at: http://localhost:3000

---

## 📧 Email Provider Configuration

### Using Supabase Default (Development):
- Supabase provides email service for development
- Limited to 4 emails per hour per user
- Good for testing

### Using Custom SMTP (Production):
1. Go to **Settings → Auth → SMTP Settings**
2. Enable custom SMTP
3. Add your SMTP credentials (Gmail, SendGrid, etc.)

---

## 🗄️ Database Tables Setup

Run these SQL queries in Supabase SQL Editor:

### 1. Merchants Table:
```sql
create table merchants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  wallet_address text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table merchants enable row level security;

-- Allow users to read their own merchant data
create policy "Users can view own merchant data"
  on merchants for select
  using (auth.uid() = user_id);

-- Allow users to insert their own merchant data
create policy "Users can insert own merchant data"
  on merchants for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own merchant data
create policy "Users can update own merchant data"
  on merchants for update
  using (auth.uid() = user_id);
```

### 2. Payments Table:
```sql
create table payments (
  id uuid default gen_random_uuid() primary key,
  merchant_id uuid references merchants(id) not null,
  amount numeric not null,
  currency text not null,
  status text not null default 'pending',
  tx_hash text,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  paid_at timestamp with time zone
);

-- Enable RLS
alter table payments enable row level security;

-- Allow merchants to view their own payments
create policy "Merchants can view own payments"
  on payments for select
  using (
    merchant_id in (
      select id from merchants where user_id = auth.uid()
    )
  );

-- Allow merchants to create payments
create policy "Merchants can create payments"
  on payments for insert
  with check (
    merchant_id in (
      select id from merchants where user_id = auth.uid()
    )
  );

-- Allow merchants to update their own payments
create policy "Merchants can update own payments"
  on payments for update
  using (
    merchant_id in (
      select id from merchants where user_id = auth.uid()
    )
  );

-- Create index for faster queries
create index payments_merchant_id_idx on payments(merchant_id);
create index payments_status_idx on payments(status);
create index payments_created_at_idx on payments(created_at desc);
```

---

## ✅ Testing the Setup

### 1. Sign Up Flow:
1. Go to http://localhost:3000/signup
2. Enter email and password
3. Check your email for confirmation link
4. Click the confirmation link
5. You should be redirected to dashboard

### 2. Sign In Flow:
1. Go to http://localhost:3000/login
2. Enter credentials
3. Should redirect to dashboard

### 3. Create Payment:
1. First, add your wallet address in Settings
2. Go to "New Payment"
3. Create a payment request
4. Check if it appears in the dashboard

---

## 🔍 Troubleshooting

### "localhost refused to connect" after email confirmation:
- ✅ Make sure dev server is running (`npm run dev`)
- ✅ Check redirect URLs are set in Supabase
- ✅ Clear browser cache and try again

### "Failed to fetch" errors:
- ✅ Check if Supabase URL and keys are correct in `.env.local`
- ✅ Verify Supabase project is not paused
- ✅ Check if RLS policies are set correctly

### Email not sending:
- ✅ Check Supabase email quota (4/hour in free tier)
- ✅ Wait a few minutes and try again
- ✅ Check spam folder
- ✅ Consider setting up custom SMTP for production

### Database errors:
- ✅ Make sure tables are created with SQL scripts above
- ✅ Check RLS policies are enabled
- ✅ Verify user has correct permissions

---

## 📚 Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

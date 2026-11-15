# LumiaPay Email Confirmation Setup Guide

## 🎯 Email Confirmation কীভাবে কাজ করে

1. User signup করে (email + password দিয়ে)
2. Supabase একটা confirmation email পাঠায়
3. User email-এ link পায়
4. Link-এ click করলে `/auth/callback` route-এ redirect হয়
5. Account verify হয়ে যায়
6. User dashboard-এ redirect হয়

---

## 📧 Supabase Email Configuration (Dashboard)

### 1. Authentication Settings চালু করো:

```
Supabase Dashboard → Authentication → Settings → Email Auth
```

নিশ্চিত করো এগুলো **ON** আছে:

- ✅ **Enable email confirmations** - MUST BE ON
- ✅ **Enable email provider** - MUST BE ON
- ⚙️ **Confirm email** - ON (signup verification জন্য)
- ⚙️ **Secure email change** - ON (recommended)

### 2. Site URL Configure করো:

```
Supabase Dashboard → Authentication → URL Configuration
```

Set করো:
```
Site URL: https://lumia-pay.vercel.app
```

### 3. Redirect URLs Add করো:

```
Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
```

Add করো:
```
https://lumia-pay.vercel.app/auth/callback
http://localhost:3000/auth/callback  (for local testing)
```

### 4. Email Templates চেক করো:

```
Supabase Dashboard → Authentication → Email Templates
```

**Confirm signup** template-এ এটা আছে কিনা দেখো:
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

**{{ .ConfirmationURL }}** এটাই হলো magic link যেটা email-এ যাবে।

---

## 🧪 Testing - Local Development

### 1. Dev Server চালাও:

```bash
cd C:\Users\AC\OneDrive\Desktop\LumiaPay-main\LumiaPay-main
npm run dev
```

### 2. Browser-এ যাও:

```
http://localhost:3000/signup
```

### 3. Test Account তৈরি করো:

```
Email: test@example.com
Password: testpassword123
```

### 4. Console চেক করো:

Supabase Dashboard → Authentication → Logs

সেখানে দেখবে:
- ✅ "User signed up" event
- ✅ "Confirmation email sent" event

### 5. Email পাওনি?

**Development mode-এ:**
- Supabase থেকে email আসতে পারে **Inbucket** (test email service) থেকে
- Supabase Dashboard → Authentication → Logs → Email logs দেখো
- সেখানে email link পাবে

**Production mode-এ:**
- Real email provider setup করতে হবে (SendGrid, AWS SES, etc.)

---

## 🚀 Production Email Setup (Optional)

যদি custom email provider ব্যবহার করতে চাও:

### Option 1: SendGrid (Free tier: 100 emails/day)

```
Supabase Dashboard → Project Settings → Auth → SMTP Settings
```

Configure:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: <your-sendgrid-api-key>
Sender email: noreply@lumia-pay.com
Sender name: LumiaPay
```

### Option 2: AWS SES (Very cheap)

```
Host: email-smtp.us-east-1.amazonaws.com
Port: 587
Username: <your-ses-username>
Password: <your-ses-password>
```

### Option 3: Use Supabase Default (Easiest)

Supabase provides free email sending:
- ✅ 1,000 emails/month free
- ✅ No configuration needed
- ⚠️ May go to spam folder

---

## 🔍 Troubleshooting

### Email আসছে না?

**Check 1: Supabase Logs**
```
Dashboard → Authentication → Logs
```
দেখো email sent হয়েছে কিনা।

**Check 2: Spam Folder**
Email spam-এ গেছে কিনা চেক করো।

**Check 3: Email Provider Rate Limit**
Supabase free tier: 1,000 emails/month

**Check 4: Email Address Valid কিনা**
Disposable email (temp-mail.org) কাজ করবে না।

### Email আসছে কিন্তু Link কাজ করছে না?

**Check 1: Redirect URL**
Supabase Dashboard-এ `/auth/callback` add করেছো কিনা।

**Check 2: Callback Route আছে কিনা**
File: `app/auth/callback/route.ts`

**Check 3: Environment Variables**
Production-এ `.env` file-এ সঠিক Supabase URL আছে কিনা।

### Link Click করলে Error আসছে?

Check browser console:
```
Right click → Inspect → Console tab
```

Error message দেখে আমাকে বলো।

---

## ✅ Current Implementation Status

তোমার LumiaPay-এ এগুলো **already implemented** আছে:

1. ✅ Signup form with email confirmation
2. ✅ Callback route (`/auth/callback/route.ts`)
3. ✅ Success message: "Check your email for a confirmation link"
4. ✅ Email redirect URL configured

---

## 🎯 Next Steps

### 1. Supabase Dashboard Check করো:

```
1. Authentication → Settings → Email Auth → Enable email confirmations: ON
2. Authentication → URL Configuration → Add redirect URLs
3. Authentication → Email Templates → Check "Confirm signup" template
```

### 2. Test করো:

```
1. http://localhost:3000/signup
2. New account তৈরি করো
3. Email check করো
4. Link-এ click করো
5. Dashboard-এ redirect হবে
```

### 3. Production Deploy করো:

```bash
git add .
git commit -m "docs: add email setup guide"
vercel --prod
```

---

## 📞 Help Needed?

যদি এখনও email না আসে, আমাকে বলো:

1. Supabase Dashboard থেকে screenshot দাও (Authentication → Logs)
2. Browser console error পাঠাও
3. Email provider configuration দেখাও

আমি ঠিক করে দেবো! 🚀

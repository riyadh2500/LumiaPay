# ✅ Email Verification Setup Checklist

## 🎯 তোমার কাজ - Supabase Dashboard-এ Setup

### ধাপ ১: Email Confirmation চালু করো

1. যাও: https://supabase.com/dashboard
2. তোমার **LumiaPay project** select করো
3. বাম পাশে **Authentication** click করো
4. **Settings** tab-এ যাও
5. Scroll করো **Email Auth** section-এ

#### ✅ এই settings ON করো:

```
☐ Enable email provider: ✅ ON
☐ Enable email confirmations: ✅ ON
☐ Confirm email: ✅ ON
```

---

### ধাপ ২: Site URL Configure করো

Same **Authentication → Settings** page-এ:

#### Find: **"Site URL"** section

```
Site URL: https://lumia-pay.vercel.app
```

এটা set করো। এটা খুব গুরুত্বপূর্ণ! ❗

---

### ধাপ ৩: Redirect URLs Add করো

Same page-এ scroll করো **"Redirect URLs"** section-এ:

#### Add these URLs (একটা একটা করে):

```
https://lumia-pay.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

**কীভাবে add করবে:**
1. URL box-এ paste করো
2. **"Add URL"** button click করো
3. দ্বিতীয় URL-ও same process-এ add করো

---

### ধাপ ৪: Email Template Check করো (Optional)

1. যাও: **Authentication → Email Templates**
2. **"Confirm signup"** template click করো
3. দেখো এরকম কিছু আছে:

```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

**{{ .ConfirmationURL }}** - এটাই হলো verification link।

---

## 🧪 ধাপ ৫: Test করো

### Local Testing:

1. Terminal open করো:
```bash
cd C:\Users\AC\OneDrive\Desktop\LumiaPay-main\LumiaPay-main
npm run dev
```

2. Browser-এ যাও:
```
http://localhost:3000/signup
```

3. একটা test account তৈরি করো:
```
Email: তোমার real email (যেমন: yourname@gmail.com)
Password: testpassword123
```

4. Submit button click করো

5. দেখবে message:
```
✅ Check your email for a confirmation link.
```

6. তোমার email check করো (inbox + spam folder)

7. Email-এ link পাবে, click করো

8. Automatically dashboard-এ redirect হবে

---

## 🚀 ধাপ ৬: Production-এ Deploy করো

যদি local-এ কাজ করে, তাহলে production-এ deploy করো:

```bash
cd C:\Users\AC\OneDrive\Desktop\LumiaPay-main\LumiaPay-main
vercel --prod
```

---

## 🔍 Troubleshooting

### ❌ Email আসছে না?

**Check 1:** Supabase Dashboard → Authentication → Logs
- Email sent হয়েছে কিনা দেখো

**Check 2:** Spam folder check করো

**Check 3:** Disposable email ব্যবহার করছো না তো?
- temp-mail.org, guerrillamail.com এগুলো কাজ করবে না
- Real Gmail/Outlook ব্যবহার করো

**Check 4:** Rate limit exceed হয়েছে কিনা?
- Supabase free: 1,000 emails/month
- Dashboard → Settings → Billing check করো

---

### ❌ Email আসছে কিন্তু Link কাজ করছে না?

**Check 1:** Redirect URL add করেছো কিনা?
```
Authentication → Settings → Redirect URLs
https://lumia-pay.vercel.app/auth/callback
```

**Check 2:** Site URL ঠিক আছে কিনা?
```
Authentication → Settings → Site URL
https://lumia-pay.vercel.app
```

**Check 3:** Browser console-এ error আছে কিনা?
- Right click → Inspect → Console tab
- Screenshot নিয়ে আমাকে পাঠাও

---

### ❌ "Invalid redirect URL" Error?

**Fix:**
1. Supabase Dashboard → Authentication → Settings
2. Redirect URLs section-এ `/auth/callback` add করো
3. Save করো
4. 5 minutes wait করো (changes propagate হতে time লাগে)
5. আবার try করো

---

### ❌ Link Click করলে "Session not found"?

**Fix:**
1. Browser cache clear করো
2. Private/Incognito window-এ try করো
3. Email-এর link টা **fresh** আছে তো? (24 hours-এর পুরানো হলে expire হয়ে যায়)

---

## 📧 Production Email Provider (Optional - Later)

এখনকার জন্য Supabase default email provider-ই enough। 

পরে যদি custom email চাও (branded emails, better deliverability):

### Option 1: SendGrid (Recommended)
- Free: 100 emails/day
- Setup: 10 minutes
- Good deliverability

### Option 2: AWS SES (Cheapest)
- Pay-as-you-go: $0.10 per 1000 emails
- Requires verification
- Best for high volume

### Option 3: Mailgun
- Free: 5,000 emails/month
- Good docs
- Easy setup

---

## ✅ Success Criteria

তুমি জানবে সব ঠিক আছে যখন:

1. ✅ Signup form submit করার পর success message দেখছো
2. ✅ Email inbox-এ verification email পাচ্ছো
3. ✅ Link click করলে dashboard-এ redirect হচ্ছে
4. ✅ Login করতে পারছো নতুন account দিয়ে

---

## 🎯 আমাকে কী বলবে?

Setup করার পরে আমাকে বলো:

**সফল হলে:**
- ✅ "Email verification কাজ করছে!"
- Screenshot দাও (optional)

**সমস্যা হলে:**
- ❌ কোন ধাপে আটকে আছো?
- Error message কী?
- Supabase logs screenshot পাঠাও

আমি সাহায্য করবো! 🚀

---

## 📚 Additional Resources

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Email Templates:** https://supabase.com/docs/guides/auth/auth-email-templates
- **Troubleshooting:** https://supabase.com/docs/guides/auth/troubleshooting

---

**Created:** 2024-01-14  
**For:** LumiaPay Email Verification Setup

# 🚀 Deployment Guide - LumiaPay

## Deploy to Vercel

### Step 1: Push to GitHub ✅
Your code is already on GitHub at: https://github.com/riyadh2500/LumiaPay

### Step 2: Connect to Vercel

1. Go to [Vercel](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository: `riyadh2500/LumiaPay`
4. Vercel will auto-detect Next.js settings

### Step 3: Add Environment Variables

In Vercel dashboard, go to **Settings → Environment Variables** and add these:

#### Supabase Configuration:
```
NEXT_PUBLIC_SUPABASE_URL=https://fpluaqkhstuxbmcnugbx.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbHVhcWtoc3R1eGJtY251Z2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MzgxMjgsImV4cCI6MjExMDExNDEyOH0.p3Li9zWm2nByeZ1GW9sIkHL0eDqVi47Aq4VbUbmEpx8
```

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbHVhcWtoc3R1eGJtY251Z2J4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDUzODEyOCwiZXhwIjoyMTEwMTE0MTI4fQ.bPrm324K5nz-oLlzmr8fJgJ5TORTzVdw5nCrjc9COkA
```

#### Arc Network Configuration:
```
ARC_RPC_URL=https://rpc.testnet.arc.network
```

```
ARC_USDC_CONTRACT=0x3600000000000000000000000000000000000000
```

```
ARC_EURC_CONTRACT=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
```

### Step 4: Deploy 🎉

Click **"Deploy"** and Vercel will:
- ✅ Install dependencies
- ✅ Build your Next.js app
- ✅ Deploy to production

Your site will be live at: `https://your-project-name.vercel.app`

---

## 📝 Quick Copy-Paste for Vercel

### Method 1: One-by-one (Recommended)
Copy each variable name and value separately in Vercel's UI.

### Method 2: Bulk Import
You can also use Vercel CLI to import all at once:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ARC_RPC_URL
vercel env add ARC_USDC_CONTRACT
vercel env add ARC_EURC_CONTRACT
```

---

## 🔧 Supabase Setup

Make sure your Supabase database has these tables:

1. **merchants** table
2. **payments** table

Run the SQL migrations from your Supabase dashboard.

---

## ✅ Post-Deployment Checklist

- [ ] Environment variables added
- [ ] Supabase tables created
- [ ] Site loads without errors
- [ ] Animations working
- [ ] Can create payments
- [ ] Can view dashboard

---

## 🆘 Troubleshooting

### "Failed to fetch" error:
- Check if all environment variables are set correctly
- Verify Supabase URL and keys are correct
- Check Supabase project is not paused

### Build errors:
- Clear Vercel cache and redeploy
- Check build logs in Vercel dashboard

### Animations not working:
- Hard refresh the page (Ctrl + F5)
- Clear browser cache

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Arc Network Documentation](https://docs.arc.io)

# Migration 002 - Apply করার সম্পূর্ণ গাইড

## ⚠️ Migration Apply করার আগে

এই Migration টি **Production-Ready** এবং **Safe**। কিন্তু Database-এ কোনো পরিবর্তন করার আগে সবসময় সাবধান থাকতে হবে।

---

## 🎯 এই Migration কী করবে?

### নতুন Tables তৈরি করবে:
1. **applications** - Developer applications
2. **api_keys** - Hashed API keys

### নতুন Columns যোগ করবে (Backward-Compatible):
1. `payments.application_id` (NULL by default)
2. `payments.environment` (NULL by default)
3. `payment_events.application_id` (NULL by default)

### নতুন Functions তৈরি করবে:
1. `validate_api_key(key_hash TEXT)` - API authentication
2. `get_application_payment_stats(application_id UUID)` - Analytics
3. `update_updated_at_column()` - Auto timestamp

### RLS Policies যোগ করবে:
- Merchant শুধু নিজের applications দেখতে পারবে
- Merchant শুধু নিজের API keys দেখতে পারবে
- Cross-user access blocked

---

## 📋 Migration Apply করার Steps

### Step 1: Supabase Dashboard-এ যাও

1. খোলো: https://supabase.com/dashboard
2. তোমার project select করো: **ueenribdrbowrxobuvyv**
3. Left sidebar থেকে **SQL Editor** click করো

### Step 2: Migration SQL Copy করো

Migration file এর পুরো content copy করো:

```
LumiaPay-main/supabase/migrations/002_developer_infrastructure.sql
```

### Step 3: SQL Editor-এ Paste করে Run করো

1. SQL Editor-এ একটা **New query** তৈরি করো
2. Migration SQL paste করো
3. **RUN** button click করো
4. সফল হলে success message দেখাবে

### Step 4: Verification করো

এই queries চালিয়ে verify করো:

```sql
-- Check tables created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('applications', 'api_keys');
-- Should return: applications, api_keys

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('applications', 'api_keys');
-- Both should show: true

-- Check functions created
SELECT proname FROM pg_proc 
WHERE proname IN ('validate_api_key', 'get_application_payment_stats');
-- Should return: both function names

-- Check new columns added
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND column_name IN ('application_id', 'environment');
-- Should return: both columns with is_nullable = YES
```

---

## ✅ Migration সফল হলে

তুমি এখন:
- Developer API ব্যবহার করতে পারবে
- Application তৈরি করতে পারবে
- API keys generate করতে পারবে
- Test/Live environments ব্যবহার করতে পারবে

---

## 🔄 Rollback (যদি কোনো সমস্যা হয়)

Migration revert করার জন্য:

```sql
-- Drop new tables
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS applications CASCADE;

-- Remove added columns
ALTER TABLE payments DROP COLUMN IF EXISTS application_id;
ALTER TABLE payments DROP COLUMN IF EXISTS environment;
ALTER TABLE payment_events DROP COLUMN IF EXISTS application_id;

-- Drop functions
DROP FUNCTION IF EXISTS validate_api_key(TEXT);
DROP FUNCTION IF EXISTS get_application_payment_stats(UUID);
DROP FUNCTION IF EXISTS update_updated_at_column();
```

---

## 📞 যদি Error আসে

**Common Errors:**

### Error: "relation already exists"
**Meaning:** Table আগে থেকেই আছে  
**Solution:** Migration আগে apply হয়ে গেছে, skip করো

### Error: "column already exists"
**Meaning:** Column আগে থেকেই আছে  
**Solution:** এই specific column এর ALTER statement comment out করো

### Error: "permission denied"
**Meaning:** Database admin permission নেই  
**Solution:** Supabase dashboard থেকে login করে আবার try করো

---

## 🎯 Next Steps After Migration

1. ✅ Vercel-এ production deploy করো
2. ✅ API endpoints test করো
3. ✅ Developer documentation review করো
4. ✅ Phase 2.2 (Webhooks) শুরু করো

---

**Migration File Location:**
```
LumiaPay-main/supabase/migrations/002_developer_infrastructure.sql
```

**Status:** ✅ Ready to Apply  
**Risk Level:** LOW (Backward-compatible, nullable columns)  
**Estimated Time:** 2-5 minutes

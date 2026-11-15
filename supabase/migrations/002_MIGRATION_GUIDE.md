# Migration 002 — Developer Infrastructure
## Application & Forward Migration Guide

> **Status:** 📋 READY FOR REVIEW — **DO NOT APPLY WITHOUT APPROVAL**

---

## What This Migration Does

Migration `002_developer_infrastructure.sql` introduces the database foundation for the Phase 2.1 Developer Infrastructure. All changes are **additive and backward-compatible**: no existing columns, tables, or rows are modified or removed.

### New Tables

| Table | Purpose |
|-------|---------|
| `applications` | Developer apps registered by merchants. Owns the `environment` (test/live) for a set of payments and API keys. |
| `api_keys` | Hashed API keys per application. Plaintext is **never stored** — only the SHA-256 digest (`key_hash`). |

### Extended Existing Tables

| Table | Column Added | Type | Notes |
|-------|-------------|------|-------|
| `payments` | `application_id` | `UUID NULL` | Links payment to developer app. NULL = dashboard payment. |
| `payments` | `environment` | `TEXT NULL` | `'test'` or `'live'`. NULL = dashboard payment. |
| `payment_events` | `application_id` | `UUID NULL` | Links event to developer app. NULL = dashboard event. |

All added columns are **nullable** so every existing row remains valid without any data backfill.

### New Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_applications_user_id` | applications | List user's apps |
| `idx_applications_active` | applications | Filter active only |
| `idx_applications_environment` | applications | Filter by env |
| `idx_applications_user_active_created` | applications | Dashboard list |
| `idx_api_keys_hash_active` | api_keys | Auth hot path |
| `idx_api_keys_application_id` | api_keys | Management UI |
| `idx_api_keys_application_active` | api_keys | Active keys per app |
| `idx_api_keys_expires_at` | api_keys | Expiry cron |
| `idx_payments_application_id` | payments | App's payments |
| `idx_payments_environment` | payments | Env filter |
| `idx_payments_app_env_status` | payments | API query pattern |
| `idx_payments_app_created` | payments | Paginated list |
| `idx_payment_events_application_id` | payment_events | App's events |

### New DB Functions

| Function | Description |
|----------|-------------|
| `update_updated_at_column()` | Trigger function: sets `updated_at = NOW()` on UPDATE |
| `validate_api_key(key_hash TEXT)` | Authenticates a hashed API key; returns application context |
| `get_application_payment_stats(app_id UUID)` | Aggregated payment metrics for an application |

---

## Pre-Migration Checklist

- [ ] Migration `001_payment_engine_tables.sql` has been applied and verified
- [ ] `merchants` table exists with `user_id` and `wallet_address` columns
- [ ] `payments` table exists with at minimum `id`, `user_id`, `status` columns
- [ ] `payment_events` table exists
- [ ] All 78+ existing tests still pass: `npm test`
- [ ] TypeScript builds cleanly: `npm run typecheck`
- [ ] A current database backup exists (Supabase Dashboard → Backups)
- [ ] This migration has been reviewed and approved by the technical lead
- [ ] Maintenance window is scheduled (migration is fast but should be applied during low-traffic)

---

## Applying the Migration

### Option A — Supabase Dashboard SQL Editor (Recommended for first application)

1. Open the Supabase Dashboard for your project.
2. Navigate to **SQL Editor**.
3. Click **New query**.
4. Copy the entire contents of `002_developer_infrastructure.sql` into the editor.
5. Click **RUN**.
6. Verify there are no error messages.
7. Run the verification queries below.

### Option B — Supabase CLI (CI/CD)

```bash
# 1. Link your project (one-time)
supabase link --project-ref <your-project-ref>

# 2. Apply the migration
supabase db push

# 3. Verify
supabase db diff
```

### Option C — Direct psql (Advanced)

```bash
psql "$DATABASE_URL" -f supabase/migrations/002_developer_infrastructure.sql
```

---

## Post-Migration Verification

Run these queries in the SQL Editor to confirm the migration applied correctly:

```sql
-- 1. Both new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('applications', 'api_keys');
-- Expected: 2 rows

-- 2. New columns on payments exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments'
  AND column_name IN ('application_id', 'environment');
-- Expected: 2 rows, both nullable (YES)

-- 3. New column on payment_events exists
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_events'
  AND column_name = 'application_id';
-- Expected: 1 row, nullable (YES)

-- 4. RLS is enabled on new tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('applications', 'api_keys');
-- Expected: 2 rows, rowsecurity = true

-- 5. Validate_api_key function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'validate_api_key';
-- Expected: 1 row

-- 6. No existing payments were broken (NULL is acceptable)
SELECT COUNT(*) FROM payments WHERE application_id IS NOT NULL;
-- Expected: 0 (no existing payments have app IDs)

-- 7. Applications table is empty (no data yet)
SELECT COUNT(*) FROM applications;
-- Expected: 0
```

---

## Rollback Procedure

If the migration must be undone:

### Impact Warning

> **HIGH IMPACT:** Rolling back will permanently delete all rows in `applications`
> and `api_keys` and will remove the `application_id` / `environment` columns
> from `payments` and `payment_events`.  Any developer applications created
> after the migration was applied will be irrecoverably lost.

### Steps

1. **Take a backup** via Supabase Dashboard → Database → Backups → Create backup.

2. **Apply the rollback script:**
   ```bash
   # Option A: Supabase SQL Editor
   # Paste the contents of 002_rollback.sql and run it.

   # Option B: psql
   psql "$DATABASE_URL" -f supabase/migrations/002_rollback.sql
   ```

3. **Verify the rollback:**
   ```sql
   -- Tables should not exist
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('applications', 'api_keys');
   -- Expected: 0

   -- Columns should not exist
   SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'payments'
     AND column_name IN ('application_id', 'environment');
   -- Expected: 0
   ```

4. **Run existing tests** to confirm no regression:
   ```bash
   npm test
   ```

---

## Security Notes

1. **No plaintext keys are stored.** The `key_hash` column in `api_keys` holds only a SHA-256 hex digest. The plaintext key is generated server-side, shown to the user once, and then discarded.

2. **Hard deletes on `api_keys` are blocked by RLS.** The policy `api_keys_no_delete` returns `USING (false)`, meaning even authenticated users cannot issue a `DELETE`. Keys are revoked by setting `status = 'revoked'`.

3. **`validate_api_key()` is `SECURITY DEFINER`.** It runs as the function's defining role (service role) so it can bypass RLS when doing the hash lookup. It never returns the hash to callers — only the application context.

4. **Environment isolation is enforced at the application layer** (middleware) as the primary control, with the `environment` column on `payments` as a secondary data-layer control.

5. **Service-role credentials are not exposed.** The admin client (`lib/supabase/admin.ts`) is used exclusively in server-side code. The migration does not add any mechanism that would expose these credentials.

---

## Estimated Migration Time

| Operation | Estimated Time |
|-----------|---------------|
| CREATE TABLE applications | < 100ms |
| CREATE TABLE api_keys | < 100ms |
| ALTER TABLE payments (add columns) | < 1s (no rows changed) |
| ALTER TABLE payment_events (add column) | < 1s (no rows changed) |
| All CREATE INDEX | < 2s (tables are empty at application time) |
| Total | **< 5 seconds** |

The migration uses `IF NOT EXISTS` throughout and is **safe to run multiple times**.

---

## Questions or Issues

Open a GitHub issue on the `phase-1.1-fixes` branch or contact the
Engineering Lead before applying this migration in any non-local environment.

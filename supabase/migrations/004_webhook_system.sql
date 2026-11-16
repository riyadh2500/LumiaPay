-- ============================================================================
-- LumiaPay Webhook System — Migration 004
-- Created: 2025-01-15
--
-- PURPOSE
--   Adds webhook infrastructure for real-time payment event notifications:
--     • webhook_endpoints     — Registered webhook URLs
--     • webhook_events        — Event delivery log
--     • webhook_attempts      — Delivery attempt tracking
--
-- FEATURES
--   - HMAC signature verification
--   - Automatic retry with exponential backoff
--   - Event filtering by type
--   - Delivery status tracking
--   - Failed delivery alerts
--
-- DEPENDENCIES
--   Migration 002 (applications table) must be applied first
--
-- SAFE TO RE-RUN?
--   Yes — all DDL uses IF NOT EXISTS / OR REPLACE (idempotent)
-- ============================================================================

-- ============================================================================
-- SECTION 1 — WEBHOOK ENDPOINTS TABLE
-- ============================================================================
-- Stores registered webhook URLs for each developer application

CREATE TABLE IF NOT EXISTS webhook_endpoints (

  -- ── Identity ───────────────────────────────────────────────────────────
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Ownership ──────────────────────────────────────────────────────────
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

  -- ── Endpoint Configuration ─────────────────────────────────────────────
  url TEXT NOT NULL
      CONSTRAINT webhook_endpoints_url_format
        CHECK (url ~* '^https?://'),

  description TEXT
              CONSTRAINT webhook_endpoints_description_length
                CHECK (description IS NULL OR char_length(description) <= 500),

  -- ── Security ───────────────────────────────────────────────────────────
  -- HMAC secret for signature verification (generated on creation)
  secret TEXT NOT NULL,

  -- ── Event Filtering ────────────────────────────────────────────────────
  -- JSON array of event types this endpoint subscribes to
  -- Example: ["payment.paid", "payment.failed"]
  -- Empty array = all events
  enabled_events JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── Status ─────────────────────────────────────────────────────────────
  status TEXT NOT NULL DEFAULT 'active'
         CONSTRAINT webhook_endpoints_status_values
           CHECK (status IN ('active', 'disabled', 'failed')),

  -- Auto-disable after N consecutive failures
  failure_count INTEGER NOT NULL DEFAULT 0
                CONSTRAINT webhook_endpoints_failure_count_non_negative
                  CHECK (failure_count >= 0),

  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,

  -- ── Timestamps ─────────────────────────────────────────────────────────
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- ── Uniqueness ─────────────────────────────────────────────────────────
  -- One URL per application (prevent duplicate registrations)
  CONSTRAINT webhook_endpoints_unique_url_per_app
    UNIQUE (application_id, url)

);

COMMENT ON TABLE webhook_endpoints IS
  'Registered webhook URLs for developer applications. '
  'Each endpoint receives real-time payment event notifications.';

COMMENT ON COLUMN webhook_endpoints.secret IS
  'HMAC-SHA256 secret for verifying webhook signatures. '
  'Regenerated when endpoint is rotated.';

COMMENT ON COLUMN webhook_endpoints.enabled_events IS
  'Array of event types to send to this endpoint. '
  'Empty array subscribes to all events.';

-- ── Triggers ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS webhook_endpoints_set_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_set_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_application_id
  ON webhook_endpoints(application_id);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active
  ON webhook_endpoints(application_id, status)
  WHERE status = 'active';


-- ============================================================================
-- SECTION 2 — WEBHOOK EVENTS TABLE
-- ============================================================================
-- Stores events that need to be delivered to webhook endpoints

CREATE TABLE IF NOT EXISTS webhook_events (

  -- ── Identity ───────────────────────────────────────────────────────────
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Ownership ──────────────────────────────────────────────────────────
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

  -- ── Event Metadata ─────────────────────────────────────────────────────
  event_type TEXT NOT NULL
             CONSTRAINT webhook_events_type_format
               CHECK (event_type ~* '^[a-z]+\.[a-z_]+$'),

  -- Reference to the payment that triggered this event
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Full event payload (JSON)
  payload JSONB NOT NULL,

  -- ── Delivery Status ────────────────────────────────────────────────────
  status TEXT NOT NULL DEFAULT 'pending'
         CONSTRAINT webhook_events_status_values
           CHECK (status IN ('pending', 'delivered', 'failed', 'cancelled')),

  -- Number of delivery attempts made
  attempt_count INTEGER NOT NULL DEFAULT 0
                CONSTRAINT webhook_events_attempt_count_non_negative
                  CHECK (attempt_count >= 0),

  -- When to attempt next delivery (for retry scheduling)
  next_attempt_at TIMESTAMP WITH TIME ZONE,

  delivered_at TIMESTAMP WITH TIME ZONE,

  -- ── Timestamps ─────────────────────────────────────────────────────────
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()

);

COMMENT ON TABLE webhook_events IS
  'Payment events queued for webhook delivery. '
  'Each event is delivered to all matching webhook endpoints.';

COMMENT ON COLUMN webhook_events.event_type IS
  'Event type in format: resource.action (e.g. payment.paid, payment.failed)';

COMMENT ON COLUMN webhook_events.next_attempt_at IS
  'Scheduled time for next delivery attempt. '
  'Used by webhook worker to fetch pending events.';

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_events_application_id
  ON webhook_events(application_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id
  ON webhook_events(payment_id);

-- Index for webhook worker (fetch pending events ready for delivery)
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending
  ON webhook_events(next_attempt_at, status)
  WHERE status = 'pending' AND next_attempt_at IS NOT NULL;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_created
  ON webhook_events(application_id, created_at DESC);


-- ============================================================================
-- SECTION 3 — WEBHOOK ATTEMPTS TABLE
-- ============================================================================
-- Logs each delivery attempt for debugging and monitoring

CREATE TABLE IF NOT EXISTS webhook_attempts (

  -- ── Identity ───────────────────────────────────────────────────────────
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── References ─────────────────────────────────────────────────────────
  webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,

  -- ── Attempt Details ────────────────────────────────────────────────────
  attempt_number INTEGER NOT NULL
                 CONSTRAINT webhook_attempts_number_positive
                   CHECK (attempt_number > 0),

  -- ── HTTP Request/Response ──────────────────────────────────────────────
  request_headers JSONB,
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,

  -- ── Timing ─────────────────────────────────────────────────────────────
  duration_ms INTEGER, -- How long the HTTP request took

  -- ── Status ─────────────────────────────────────────────────────────────
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- ── Timestamps ─────────────────────────────────────────────────────────
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()

);

COMMENT ON TABLE webhook_attempts IS
  'Delivery attempt log for debugging webhook failures. '
  'Each row represents one HTTP POST to a webhook endpoint.';

COMMENT ON COLUMN webhook_attempts.success IS
  'true if HTTP status 200-299, false otherwise';

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_attempts_event_id
  ON webhook_attempts(webhook_event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_attempts_endpoint_id
  ON webhook_attempts(webhook_endpoint_id);

CREATE INDEX IF NOT EXISTS idx_webhook_attempts_attempted_at
  ON webhook_attempts(attempted_at DESC);


-- ============================================================================
-- SECTION 4 — HELPER FUNCTIONS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4.1  generate_webhook_secret()
--      Generates a cryptographically secure HMAC secret
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  secret TEXT;
BEGIN
  -- Generate 32 random bytes, encode as base64
  -- Remove padding (=) for cleaner secret
  secret := encode(gen_random_bytes(32), 'base64');
  secret := replace(secret, '=', '');
  RETURN 'whsec_' || secret;
END;
$$;

COMMENT ON FUNCTION generate_webhook_secret() IS
  'Generates a cryptographically secure webhook HMAC secret.';


-- ---------------------------------------------------------------------------
-- 4.2  create_webhook_event()
--      Creates a webhook event and schedules immediate delivery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_webhook_event(
  p_application_id UUID,
  p_event_type TEXT,
  p_payment_id UUID,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO webhook_events (
    application_id,
    event_type,
    payment_id,
    payload,
    status,
    next_attempt_at
  ) VALUES (
    p_application_id,
    p_event_type,
    p_payment_id,
    p_payload,
    'pending',
    NOW() -- Schedule immediate delivery
  )
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$;

COMMENT ON FUNCTION create_webhook_event(UUID, TEXT, UUID, JSONB) IS
  'Creates a new webhook event and schedules it for immediate delivery.';


-- ---------------------------------------------------------------------------
-- 4.3  get_active_webhook_endpoints()
--      Returns active endpoints that should receive a given event type
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_active_webhook_endpoints(
  p_application_id UUID,
  p_event_type TEXT
)
RETURNS TABLE (
  endpoint_id UUID,
  url TEXT,
  secret TEXT,
  enabled_events JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id AS endpoint_id,
    we.url,
    we.secret,
    we.enabled_events
  FROM webhook_endpoints we
  WHERE we.application_id = p_application_id
    AND we.status = 'active'
    AND (
      -- Empty enabled_events = all events
      jsonb_array_length(we.enabled_events) = 0
      OR
      -- Event type is in enabled_events array
      we.enabled_events ? p_event_type
    );
END;
$$;

COMMENT ON FUNCTION get_active_webhook_endpoints(UUID, TEXT) IS
  'Returns active webhook endpoints that should receive the given event type.';


-- ============================================================================
-- SECTION 5 — ROW LEVEL SECURITY
-- ============================================================================

-- ── webhook_endpoints ──────────────────────────────────────────────────────
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_endpoints_select_own" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_insert_own" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_update_own" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_delete_own" ON webhook_endpoints;

CREATE POLICY "webhook_endpoints_select_own"
  ON webhook_endpoints FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_endpoints_insert_own"
  ON webhook_endpoints FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_endpoints_update_own"
  ON webhook_endpoints FOR UPDATE
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_endpoints_delete_own"
  ON webhook_endpoints FOR DELETE
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );


-- ── webhook_events ─────────────────────────────────────────────────────────
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_select_own" ON webhook_events;

CREATE POLICY "webhook_events_select_own"
  ON webhook_events FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );


-- ── webhook_attempts ───────────────────────────────────────────────────────
ALTER TABLE webhook_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_attempts_select_own" ON webhook_attempts;

CREATE POLICY "webhook_attempts_select_own"
  ON webhook_attempts FOR SELECT
  USING (
    webhook_event_id IN (
      SELECT id FROM webhook_events WHERE application_id IN (
        SELECT id FROM applications WHERE user_id = auth.uid()
      )
    )
  );


-- ============================================================================
-- END OF MIGRATION 004
-- ============================================================================

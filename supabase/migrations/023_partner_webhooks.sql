-- ============================================================================
-- 023 — Partner webhooks (outgoing callbacks to partner portals)
--
-- Phase 2 of the partner API (migration 022): instead of polling, a partner
-- registers a URL and we POST to it the moment something happens on one of
-- their jobs — status change, tuned file ready, message from our tuners.
--
-- Delivery is a queue, not a fire-and-forget HTTP call from a trigger:
--
--   1. Database triggers on jobs / files / job_messages INSERT a row into
--      api_webhook_deliveries. Because this is a trigger, an event is captured
--      no matter what caused it — admin panel, an RPC, or a manual UPDATE in
--      the SQL editor.
--   2. The dispatcher (POST /api/v1/webhooks/dispatch) drains pending rows,
--      signs each payload with the partner's secret and POSTs it, with
--      exponential backoff on failure.
--
-- The admin panel calls the dispatcher right after every delivering action, so
-- in practice callbacks land within a second. Retries ride along on the next
-- dispatch (see API.md for the optional Vercel cron).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Registered endpoints
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    -- HMAC-SHA256 signing secret. Unlike an API key this must stay reversible
    -- (we sign every payload with it), so it is readable by the service role
    -- only — never granted to browser sessions, see the column grant below.
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY['job.status_changed', 'job.file_ready', 'job.message'],
    is_active BOOLEAN NOT NULL DEFAULT true,
    consecutive_failures INT NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_webhooks_client ON api_webhooks(client_id);

ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_webhooks_select" ON api_webhooks;
CREATE POLICY "api_webhooks_select" ON api_webhooks
    FOR SELECT USING (client_id = auth.uid() OR is_admin());

-- Registration and changes happen server-side through the API (service role).
REVOKE ALL ON api_webhooks FROM authenticated;
GRANT SELECT (
    id, client_id, url, events, is_active, consecutive_failures,
    last_success_at, last_error, created_at
) ON api_webhooks TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Delivery queue
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id UUID NOT NULL REFERENCES api_webhooks(id) ON DELETE CASCADE,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | delivered | failed
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_status INT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

-- The dispatcher's hot query: pending rows that are due.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
    ON api_webhook_deliveries (status, next_attempt_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_job
    ON api_webhook_deliveries (job_id);

ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_webhook_deliveries_select" ON api_webhook_deliveries;
CREATE POLICY "api_webhook_deliveries_select" ON api_webhook_deliveries
    FOR SELECT USING (client_id = auth.uid() OR is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Enqueue helper — one delivery row per active endpoint subscribed to the
--    event. Partners with no webhook registered simply produce no rows.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enqueue_webhook_event(
    p_client_id UUID,
    p_event TEXT,
    p_job_id UUID,
    p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO api_webhook_deliveries (webhook_id, client_id, event, job_id, payload)
    SELECT w.id, p_client_id, p_event, p_job_id, p_payload
    FROM api_webhooks w
    WHERE w.client_id = p_client_id
      AND w.is_active
      AND p_event = ANY(w.events);
END;
$$;

REVOKE EXECUTE ON FUNCTION enqueue_webhook_event(UUID, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Triggers
--
--    Payloads stay deliberately small — an id, the reference and the new
--    state. The partner calls GET /api/v1/jobs/:id for the full picture, which
--    also means a replayed or out-of-order webhook can never make them act on
--    stale data.
-- ────────────────────────────────────────────────────────────────────────────

-- 4a. Status changes
CREATE OR REPLACE FUNCTION trg_job_status_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM enqueue_webhook_event(
            NEW.client_id,
            'job.status_changed',
            NEW.id,
            jsonb_build_object(
                'job_id', NEW.id,
                'reference', NEW.reference_number,
                'external_ref', NEW.external_ref,
                'status', NEW.status,
                'previous_status', OLD.status,
                'updated_at', NEW.updated_at
            )
        );
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS job_status_webhook ON jobs;
CREATE TRIGGER job_status_webhook
    AFTER UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION trg_job_status_webhook();


-- 4b. Tuned file delivered
CREATE OR REPLACE FUNCTION trg_file_ready_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job RECORD;
BEGIN
    IF NEW.file_type <> 'modified' THEN
        RETURN NULL;
    END IF;

    SELECT client_id, reference_number, external_ref, status
      INTO v_job
    FROM jobs WHERE id = NEW.job_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    PERFORM enqueue_webhook_event(
        v_job.client_id,
        'job.file_ready',
        NEW.job_id,
        jsonb_build_object(
            'job_id', NEW.job_id,
            'reference', v_job.reference_number,
            'external_ref', v_job.external_ref,
            'status', v_job.status,
            'file_id', NEW.id,
            'file_name', NEW.original_name,
            'version', NEW.version,
            'download_path', '/api/v1/jobs/' || NEW.job_id || '/files/' || NEW.id || '/download'
        )
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS file_ready_webhook ON files;
CREATE TRIGGER file_ready_webhook
    AFTER INSERT ON files
    FOR EACH ROW EXECUTE FUNCTION trg_file_ready_webhook();


-- 4c. Message from our side (never echo the partner's own messages back)
CREATE OR REPLACE FUNCTION trg_job_message_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job RECORD;
BEGIN
    IF NEW.is_internal THEN
        RETURN NULL;
    END IF;

    SELECT client_id, reference_number, external_ref
      INTO v_job
    FROM jobs WHERE id = NEW.job_id;

    IF NOT FOUND OR NEW.sender_id = v_job.client_id THEN
        RETURN NULL;
    END IF;

    PERFORM enqueue_webhook_event(
        v_job.client_id,
        'job.message',
        NEW.job_id,
        jsonb_build_object(
            'job_id', NEW.job_id,
            'reference', v_job.reference_number,
            'external_ref', v_job.external_ref,
            'message_id', NEW.id,
            'message', left(NEW.message, 500),
            'created_at', NEW.created_at
        )
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS job_message_webhook ON job_messages;
CREATE TRIGGER job_message_webhook
    AFTER INSERT ON job_messages
    FOR EACH ROW EXECUTE FUNCTION trg_job_message_webhook();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Claim due deliveries.
--
--    Claiming and returning in one statement (with SKIP LOCKED) means two
--    dispatcher runs overlapping — an admin action and a cron, say — can never
--    both send the same delivery.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_webhook_deliveries(p_limit INT DEFAULT 20)
RETURNS TABLE (
    id BIGINT,
    webhook_id UUID,
    event TEXT,
    payload JSONB,
    attempts INT,
    url TEXT,
    secret TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    -- Only rows whose endpoint is still active are eligible. Filtering here
    -- rather than in the UPDATE matters: a row that is selected but not
    -- updated stays pending and due, so it would be picked again on every run
    -- and starve the rest of the queue behind it.
    WITH due AS (
        SELECT d.id
        FROM api_webhook_deliveries d
        JOIN api_webhooks w ON w.id = d.webhook_id AND w.is_active
        WHERE d.status = 'pending'
          AND d.next_attempt_at <= NOW()
        ORDER BY d.next_attempt_at
        LIMIT p_limit
        FOR UPDATE OF d SKIP LOCKED
    )
    UPDATE api_webhook_deliveries d
    SET attempts = d.attempts + 1,
        -- Park it out of reach while in flight; the dispatcher rewrites this
        -- with the real backoff (or marks it delivered) when it gets a result.
        next_attempt_at = NOW() + INTERVAL '5 minutes'
    FROM due, api_webhooks w
    WHERE d.id = due.id
      AND w.id = d.webhook_id
    RETURNING d.id, d.webhook_id, d.event, d.payload, d.attempts, w.url, w.secret;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_webhook_deliveries(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_webhook_deliveries(INT) TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Record the outcome of an attempt: mark the delivery, and keep a health
--    counter on the endpoint so a partner whose server is long gone gets
--    switched off instead of being retried forever.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_webhook_result(
    p_delivery_id BIGINT,
    p_ok BOOLEAN,
    p_response_status INT DEFAULT NULL,
    p_error TEXT DEFAULT NULL,
    p_max_attempts INT DEFAULT 6,
    p_backoff_seconds INT DEFAULT 60
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_webhook_id UUID;
    v_attempts INT;
BEGIN
    SELECT webhook_id, attempts INTO v_webhook_id, v_attempts
    FROM api_webhook_deliveries WHERE id = p_delivery_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF p_ok THEN
        UPDATE api_webhook_deliveries
        SET status = 'delivered',
            delivered_at = NOW(),
            response_status = p_response_status,
            last_error = NULL
        WHERE id = p_delivery_id;

        UPDATE api_webhooks
        SET consecutive_failures = 0,
            last_success_at = NOW(),
            last_error = NULL
        WHERE id = v_webhook_id;
    ELSE
        UPDATE api_webhook_deliveries
        SET status = CASE WHEN v_attempts >= p_max_attempts THEN 'failed' ELSE 'pending' END,
            next_attempt_at = NOW() + (p_backoff_seconds || ' seconds')::INTERVAL,
            response_status = p_response_status,
            last_error = left(COALESCE(p_error, 'unknown error'), 500)
        WHERE id = p_delivery_id;

        UPDATE api_webhooks
        SET consecutive_failures = consecutive_failures + 1,
            last_error = left(COALESCE(p_error, 'unknown error'), 500),
            -- 20 straight failures means nobody is home: stop knocking. The
            -- partner (or an admin) re-enables it after fixing their endpoint.
            is_active = CASE WHEN consecutive_failures + 1 >= 20 THEN false ELSE is_active END
        WHERE id = v_webhook_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_webhook_result(BIGINT, BOOLEAN, INT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_webhook_result(BIGINT, BOOLEAN, INT, TEXT, INT, INT) TO service_role;

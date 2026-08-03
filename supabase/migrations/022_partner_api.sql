-- ============================================================================
-- 022 — Partner API (server-to-server job intake)
--
-- Lets another tuning portal push its customers' jobs into this portal over
-- HTTP. A partner is an ordinary client profile: they buy credits here, and
-- every job their portal submits is charged against that balance using the
-- same master/slave pricing as the web upload flow (migration 015/019).
--
-- Auth is a bearer API key (ctf_live_…) issued per partner. Only the SHA-256
-- hash is stored, so a leaked database never yields usable keys. All API work
-- runs through the Vercel function api/v1/[...route].ts with the service-role
-- key, which is why create_api_job() below is granted to service_role only.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. API keys
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Display-only fingerprint, e.g. 'ctf_live_a1b2c3d4'. Never enough to auth.
    key_prefix TEXT NOT NULL,
    -- SHA-256 (hex) of the full key. The plaintext is shown once, at creation.
    key_hash TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rate_limit_per_min INT NOT NULL DEFAULT 60,
    last_used_at TIMESTAMPTZ,
    request_count BIGINT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- key_hash already has an index via its UNIQUE constraint, which is what the
-- per-request key lookup rides on.
CREATE INDEX IF NOT EXISTS idx_api_keys_client ON api_keys(client_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- A partner may see the metadata of their own keys (never the hash — that is
-- blocked by the column grant below); admins see all keys.
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys
    FOR SELECT USING (client_id = auth.uid() OR is_admin());

-- Issuing and revoking happens server-side (service role) through the API, so
-- no INSERT/UPDATE/DELETE policy exists for authenticated users at all.

-- Belt and braces on top of RLS: never let a browser session read the hash,
-- even if a future policy is written too loosely.
REVOKE ALL ON api_keys FROM authenticated;
GRANT SELECT (
    id, client_id, name, key_prefix, is_active, rate_limit_per_min,
    last_used_at, request_count, created_by, created_at, revoked_at
) ON api_keys TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Request log — powers per-key rate limiting and gives you an audit trail
--    of what each partner portal did.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_request_log (
    id BIGSERIAL PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INT NOT NULL,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_log_key_time
    ON api_request_log(api_key_id, created_at DESC);

ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_request_log_select" ON api_request_log;
CREATE POLICY "api_request_log_select" ON api_request_log
    FOR SELECT USING (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Job provenance
--
--    source          'portal' (web upload) or 'api' (partner portal)
--    external_ref    the partner's own job/order id — unique per client, which
--                    makes POST /jobs safely retryable
--    end_customer_ref free-text label for the partner's own customer
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS external_ref TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_customer_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_client_external_ref
    ON jobs (client_id, external_ref)
    WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. create_api_job() — the API's counterpart to create_job_with_services().
--
--    Same money path (lock the balance row, charge master/slave price, write
--    the transaction), but the client is passed in rather than taken from
--    auth.uid(), because the caller is a server holding an API key.
--
--    Differences that matter for an unattended caller:
--      * unknown/inactive service codes are an error, not a silent discount
--      * a repeated external_ref returns the original job instead of charging
--        twice, so a partner can retry a timed-out request safely
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_api_job(
    p_client_id UUID,
    p_api_key_id UUID,
    p_vehicle_brand TEXT,
    p_vehicle_model TEXT,
    p_vehicle_year TEXT,
    p_engine_type TEXT,
    p_service_codes TEXT[],
    p_ecu_type TEXT DEFAULT NULL,
    p_gearbox_type TEXT DEFAULT NULL,
    p_vin TEXT DEFAULT NULL,
    p_client_notes TEXT DEFAULT NULL,
    p_job_type TEXT DEFAULT 'ecu',
    p_file_type TEXT DEFAULT 'ecu',
    p_is_original BOOLEAN DEFAULT true,
    p_reading_tool TEXT DEFAULT NULL,
    p_tool_type TEXT DEFAULT 'master',
    p_car_notes TEXT DEFAULT NULL,
    p_external_ref TEXT DEFAULT NULL,
    p_end_customer_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job_id UUID;
    v_reference TEXT;
    v_total_price DECIMAL(10, 2) := 0;
    v_balance DECIMAL(10, 2);
    v_client_tier TEXT;
    v_matched INT;
    v_service RECORD;
BEGIN
    IF p_service_codes IS NULL OR array_length(p_service_codes, 1) IS NULL THEN
        RAISE EXCEPTION 'no_services: at least one service code is required';
    END IF;

    -- Idempotency: same partner, same external_ref → hand back the first job.
    IF p_external_ref IS NOT NULL THEN
        SELECT id, reference_number, total_price
          INTO v_job_id, v_reference, v_total_price
        FROM jobs
        WHERE client_id = p_client_id AND external_ref = p_external_ref;

        IF FOUND THEN
            SELECT credit_balance INTO v_balance FROM profiles WHERE id = p_client_id;
            RETURN jsonb_build_object(
                'result', 'existing',
                'job_id', v_job_id,
                'reference_number', v_reference,
                'total_price', v_total_price,
                'balance_after', v_balance
            );
        END IF;
    END IF;

    -- Lock the partner's balance row so parallel submissions can't overspend.
    SELECT credit_balance, tool_type INTO v_balance, v_client_tier
    FROM profiles WHERE id = p_client_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'client_not_found';
    END IF;

    -- Every requested code must exist and be active, otherwise the partner
    -- would be quietly charged for fewer services than they ordered.
    SELECT COUNT(*) INTO v_matched
    FROM services WHERE code = ANY(p_service_codes) AND is_active = true;

    IF v_matched <> array_length(p_service_codes, 1) THEN
        RAISE EXCEPTION 'unknown_service: one or more service codes are unknown or inactive';
    END IF;

    SELECT COALESCE(SUM(
        CASE WHEN v_client_tier = 'slave' THEN COALESCE(slave_price, base_price)
             ELSE base_price END
    ), 0) INTO v_total_price
    FROM services WHERE code = ANY(p_service_codes) AND is_active = true;

    IF v_balance < v_total_price THEN
        RAISE EXCEPTION 'insufficient_credits: required %, available %', v_total_price, v_balance;
    END IF;

    INSERT INTO jobs (
        client_id, vehicle_brand, vehicle_model, vehicle_year, engine_type,
        ecu_type, gearbox_type, vin, client_notes,
        total_price, credits_used,
        job_type, file_type, is_original, reading_tool, tool_type, car_notes,
        source, api_key_id, external_ref, end_customer_ref
    ) VALUES (
        p_client_id, p_vehicle_brand, p_vehicle_model, p_vehicle_year, p_engine_type,
        p_ecu_type, p_gearbox_type, p_vin, p_client_notes,
        v_total_price, v_total_price,
        COALESCE(p_job_type, 'ecu'), COALESCE(p_file_type, 'ecu'),
        COALESCE(p_is_original, true), p_reading_tool,
        COALESCE(p_tool_type, 'master'), p_car_notes,
        'api', p_api_key_id, p_external_ref, p_end_customer_ref
    ) RETURNING id, reference_number INTO v_job_id, v_reference;

    FOR v_service IN
        SELECT id, name,
            CASE WHEN v_client_tier = 'slave' THEN COALESCE(slave_price, base_price)
                 ELSE base_price END AS price
        FROM services
        WHERE code = ANY(p_service_codes) AND is_active = true
    LOOP
        INSERT INTO job_services (job_id, service_id, service_name, price)
        VALUES (v_job_id, v_service.id, v_service.name, v_service.price);
    END LOOP;

    UPDATE profiles
    SET credit_balance = credit_balance - v_total_price,
        updated_at = NOW()
    WHERE id = p_client_id;

    INSERT INTO transactions (
        user_id, type, amount, balance_before, balance_after, job_id, description
    ) VALUES (
        p_client_id, 'job_payment', -v_total_price, v_balance, v_balance - v_total_price,
        v_job_id,
        'Payment for tuning job (API' ||
            COALESCE(' · ref ' || p_external_ref, '') || ')'
    );

    RETURN jsonb_build_object(
        'result', 'created',
        'job_id', v_job_id,
        'reference_number', v_reference,
        'total_price', v_total_price,
        'balance_after', v_balance - v_total_price
    );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. touch_api_key() — bump the usage counters after a request. Kept as a
--    function because supabase-js cannot express `request_count + 1`.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_api_key(p_key_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE api_keys
    SET last_used_at = NOW(),
        request_count = request_count + 1
    WHERE id = p_key_id;
$$;

REVOKE EXECUTE ON FUNCTION touch_api_key(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION touch_api_key(UUID) TO service_role;


-- Server-to-server only: never callable with the anon/authenticated key.
REVOKE EXECUTE ON FUNCTION create_api_job(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_api_job(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

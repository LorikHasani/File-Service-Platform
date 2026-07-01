-- ============================================================================
-- 019 — Security hardening (run in Supabase SQL editor)
--
--  1. Stripe credit grants become atomic and idempotent: a unique
--     stripe_session_id on transactions + an add_stripe_credits() function
--     (service-role only) close the double-crediting race between the
--     webhook and /api/verify-session, which both did an unlocked
--     check-then-add.
--  2. Direct INSERT into jobs is removed for clients. The "Clients can create
--     jobs" policy let a client insert a job row directly (total_price = 0,
--     credits_used = 0), bypassing the credit deduction in
--     create_job_with_services(). Job creation now goes only through the RPC.
--  3. create_job_with_services() locks the profile row (FOR UPDATE) so two
--     concurrent submissions can't both pass the balance check and drive the
--     balance negative.
--  4. next_file_version() verifies the caller owns the job (or is admin).
--  5. tickets / ticket_messages / announcements were created outside the
--     migration history; their policies are dropped and recreated here so the
--     repo is the source of truth and access is provably scoped.
--  6. All SECURITY DEFINER functions get a pinned search_path (standard
--     Supabase linter hardening against search-path hijacking).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Atomic, idempotent Stripe credit grants
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Backfill from the description ("… — Stripe cs_xxx") so sessions already
-- processed before this migration can't be replayed through verify-session.
UPDATE transactions
SET stripe_session_id = substring(description FROM 'Stripe (cs_[A-Za-z0-9_]+)')
WHERE stripe_session_id IS NULL
  AND type = 'credit_purchase'
  AND description LIKE '%Stripe cs_%';

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_stripe_session
  ON transactions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION add_stripe_credits(
    p_user_id UUID,
    p_credits DECIMAL(10, 2),
    p_package_name TEXT,
    p_session_id TEXT
)
RETURNS TABLE(status TEXT, new_balance DECIMAL(10, 2))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_balance DECIMAL(10, 2);
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'Credits must be greater than zero';
    END IF;

    -- Lock the profile row: serializes the webhook and verify-session paths.
    SELECT credit_balance INTO v_balance
    FROM profiles WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- The unique index makes a second grant for the same checkout session
    -- impossible, whichever path gets there first.
    BEGIN
        INSERT INTO transactions (
            user_id, type, amount, balance_before, balance_after,
            description, stripe_session_id
        ) VALUES (
            p_user_id, 'credit_purchase', p_credits, v_balance, v_balance + p_credits,
            'Purchased ' || p_package_name || ' (' || p_credits || ' credits) — Stripe ' || p_session_id,
            p_session_id
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN QUERY SELECT 'already_processed'::TEXT, v_balance;
        RETURN;
    END;

    UPDATE profiles
    SET credit_balance = v_balance + p_credits,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN QUERY SELECT 'credits_added'::TEXT, v_balance + p_credits;
END;
$$;

-- Server-to-server only: never callable with the anon/authenticated key.
REVOKE EXECUTE ON FUNCTION add_stripe_credits(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION add_stripe_credits(UUID, DECIMAL, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION add_stripe_credits(UUID, DECIMAL, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION add_stripe_credits(UUID, DECIMAL, TEXT, TEXT) TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Jobs may only be created through create_job_with_services()
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Clients can create jobs" ON jobs;
REVOKE INSERT ON jobs FROM authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. create_job_with_services(): lock the balance row while charging
--    (same body as migration 015, plus FOR UPDATE and a pinned search_path)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_job_with_services(
    p_vehicle_brand TEXT,
    p_vehicle_model TEXT,
    p_vehicle_year TEXT,
    p_engine_type TEXT,
    p_service_codes TEXT[],
    p_engine_power_hp INT DEFAULT NULL,
    p_ecu_type TEXT DEFAULT NULL,
    p_gearbox_type TEXT DEFAULT NULL,
    p_vin TEXT DEFAULT NULL,
    p_mileage INT DEFAULT NULL,
    p_fuel_type TEXT DEFAULT NULL,
    p_client_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job_id UUID;
    v_total_price DECIMAL(10, 2) := 0;
    v_user_balance DECIMAL(10, 2);
    v_tool_type TEXT;
    v_service RECORD;
BEGIN
    -- Lock the profile row so concurrent submissions can't double-spend.
    SELECT credit_balance, tool_type INTO v_user_balance, v_tool_type
    FROM profiles WHERE id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    -- Slave clients pay slave_price (falling back to base_price when unset).
    SELECT COALESCE(SUM(
        CASE WHEN v_tool_type = 'slave' THEN COALESCE(slave_price, base_price)
             ELSE base_price END
    ), 0) INTO v_total_price
    FROM services WHERE code = ANY(p_service_codes) AND is_active = true;

    IF v_user_balance < v_total_price THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', v_total_price, v_user_balance;
    END IF;

    INSERT INTO jobs (
        client_id, vehicle_brand, vehicle_model, vehicle_year, engine_type,
        engine_power_hp, ecu_type, gearbox_type, vin, mileage, fuel_type,
        client_notes, total_price, credits_used
    ) VALUES (
        auth.uid(), p_vehicle_brand, p_vehicle_model, p_vehicle_year, p_engine_type,
        p_engine_power_hp, p_ecu_type, p_gearbox_type, p_vin, p_mileage, p_fuel_type,
        p_client_notes, v_total_price, v_total_price
    ) RETURNING id INTO v_job_id;

    FOR v_service IN
        SELECT id, name,
            CASE WHEN v_tool_type = 'slave' THEN COALESCE(slave_price, base_price)
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
    WHERE id = auth.uid();

    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, job_id, description)
    VALUES (auth.uid(), 'job_payment', -v_total_price, v_user_balance, v_user_balance - v_total_price, v_job_id, 'Payment for tuning job');

    RETURN v_job_id;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. next_file_version(): only the job owner or an admin may call it
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION next_file_version(
    p_job_id UUID,
    p_file_type file_type
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next INTEGER;
BEGIN
    IF NOT (
        is_admin()
        OR EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id AND client_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Not authorized for this job';
    END IF;

    SELECT COALESCE(MAX(version), 0) + 1
      INTO v_next
    FROM files
    WHERE job_id = p_job_id
      AND file_type = p_file_type;
    RETURN v_next;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. tickets / ticket_messages / announcements — canonical RLS policies
--    (these tables were created ad hoc; drop whatever policies exist and
--    recreate a known-good set)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('tickets', 'ticket_messages', 'announcements')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Tickets: a client sees and manages only their own; admins see all.
CREATE POLICY "tickets_select" ON tickets
    FOR SELECT USING (client_id = auth.uid() OR is_admin());

CREATE POLICY "tickets_insert" ON tickets
    FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "tickets_update" ON tickets
    FOR UPDATE
    USING (client_id = auth.uid() OR is_admin())
    WITH CHECK (client_id = auth.uid() OR is_admin());

CREATE POLICY "tickets_delete" ON tickets
    FOR DELETE USING (is_admin());

-- Ticket messages: visible to the ticket owner and admins; senders can only
-- write as themselves on tickets they participate in.
CREATE POLICY "ticket_messages_select" ON ticket_messages
    FOR SELECT USING (
        is_admin()
        OR EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_id AND tickets.client_id = auth.uid()
        )
    );

CREATE POLICY "ticket_messages_insert" ON ticket_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND (
            is_admin()
            OR EXISTS (
                SELECT 1 FROM tickets
                WHERE tickets.id = ticket_id AND tickets.client_id = auth.uid()
            )
        )
    );

CREATE POLICY "ticket_messages_delete" ON ticket_messages
    FOR DELETE USING (is_admin());

-- Announcements: everyone reads active ones; only admins manage them.
CREATE POLICY "announcements_select" ON announcements
    FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "announcements_insert" ON announcements
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "announcements_update" ON announcements
    FOR UPDATE USING (is_admin());

CREATE POLICY "announcements_delete" ON announcements
    FOR DELETE USING (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Pin search_path on the remaining SECURITY DEFINER functions
-- ────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION update_job_status(UUID, job_status, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION admin_add_credits(UUID, DECIMAL, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION request_job_revision(UUID, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION admin_refund_credits(UUID, DECIMAL, TEXT, UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION log_admin_action(TEXT, TEXT, UUID, JSONB) SET search_path = public, pg_temp;
ALTER FUNCTION admin_delete_job(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION admin_set_tool_type(UUID, TEXT) SET search_path = public, pg_temp;

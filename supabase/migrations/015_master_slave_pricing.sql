-- ============================================================================
-- Master / slave client pricing
-- Each client is classified as a "master" (full price, the default) or a
-- "slave" (own, usually different price list). Every service therefore carries
-- two prices: base_price (master) and slave_price. Slave clients are charged
-- slave_price, falling back to base_price when no slave price is configured.
-- ============================================================================

-- 1. Classify clients. Existing clients default to 'master' so nothing changes.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tool_type TEXT NOT NULL DEFAULT 'master'
  CHECK (tool_type IN ('master', 'slave'));

-- 2. Second price per service. Seed slave_price = base_price so prices are
--    unchanged until an admin edits them.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS slave_price DECIMAL(10, 2);
UPDATE services SET slave_price = base_price WHERE slave_price IS NULL;

-- 3. Recreate the authoritative job-creation RPC so it charges by the client's
--    tool_type. Signature is identical to migration 004, so CREATE OR REPLACE
--    swaps the body cleanly.
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
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_total_price DECIMAL(10, 2) := 0;
    v_user_balance DECIMAL(10, 2);
    v_tool_type TEXT;
    v_service RECORD;
BEGIN
    -- Get user's current balance and tool tier
    SELECT credit_balance, tool_type INTO v_user_balance, v_tool_type
    FROM profiles WHERE id = auth.uid();

    -- Calculate total price using the price that applies to this client.
    -- Slave clients pay slave_price (falling back to base_price when unset).
    SELECT COALESCE(SUM(
        CASE WHEN v_tool_type = 'slave' THEN COALESCE(slave_price, base_price)
             ELSE base_price END
    ), 0) INTO v_total_price
    FROM services WHERE code = ANY(p_service_codes) AND is_active = true;

    -- Check if user has enough credits
    IF v_user_balance < v_total_price THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', v_total_price, v_user_balance;
    END IF;

    -- Create job
    INSERT INTO jobs (
        client_id, vehicle_brand, vehicle_model, vehicle_year, engine_type,
        engine_power_hp, ecu_type, gearbox_type, vin, mileage, fuel_type,
        client_notes, total_price, credits_used
    ) VALUES (
        auth.uid(), p_vehicle_brand, p_vehicle_model, p_vehicle_year, p_engine_type,
        p_engine_power_hp, p_ecu_type, p_gearbox_type, p_vin, p_mileage, p_fuel_type,
        p_client_notes, v_total_price, v_total_price
    ) RETURNING id INTO v_job_id;

    -- Add services to job, recording the price actually charged
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

    -- Deduct credits
    UPDATE profiles
    SET credit_balance = credit_balance - v_total_price,
        updated_at = NOW()
    WHERE id = auth.uid();

    -- Record transaction
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, job_id, description)
    VALUES (auth.uid(), 'job_payment', -v_total_price, v_user_balance, v_user_balance - v_total_price, v_job_id, 'Payment for tuning job');

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

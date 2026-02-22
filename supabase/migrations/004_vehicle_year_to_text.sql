-- Step 1: Change vehicle_year column from INT to TEXT
ALTER TABLE jobs ALTER COLUMN vehicle_year TYPE TEXT USING vehicle_year::TEXT;

-- Step 2: Drop the old function (it has INT signature, so we must drop it first)
DROP FUNCTION IF EXISTS create_job_with_services(TEXT, TEXT, INT, TEXT, TEXT[], INT, TEXT, TEXT, TEXT, INT, TEXT, TEXT);

-- Step 3: Recreate with vehicle_year as TEXT (exact same logic, just TEXT instead of INT)
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
    v_service RECORD;
BEGIN
    -- Get user's current balance
    SELECT credit_balance INTO v_user_balance
    FROM profiles WHERE id = auth.uid();
    
    -- Calculate total price
    SELECT COALESCE(SUM(base_price), 0) INTO v_total_price
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
    
    -- Add services to job
    FOR v_service IN 
        SELECT id, name, base_price FROM services 
        WHERE code = ANY(p_service_codes) AND is_active = true
    LOOP
        INSERT INTO job_services (job_id, service_id, service_name, price)
        VALUES (v_job_id, v_service.id, v_service.name, v_service.base_price);
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

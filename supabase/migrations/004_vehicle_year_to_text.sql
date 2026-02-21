-- Change vehicle_year to text to support generation names (e.g. "E90 (2005-2012)")
ALTER TABLE jobs ALTER COLUMN vehicle_year TYPE TEXT USING vehicle_year::TEXT;

-- Recreate the RPC function with vehicle_year as TEXT
CREATE OR REPLACE FUNCTION create_job_with_services(
    p_vehicle_brand TEXT,
    p_vehicle_model TEXT,
    p_vehicle_year TEXT,
    p_engine_type TEXT,
    p_engine_power_hp INT DEFAULT NULL,
    p_ecu_type TEXT DEFAULT NULL,
    p_gearbox_type TEXT DEFAULT NULL,
    p_vin TEXT DEFAULT NULL,
    p_mileage INT DEFAULT NULL,
    p_fuel_type TEXT DEFAULT NULL,
    p_client_notes TEXT DEFAULT NULL,
    p_service_ids UUID[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_total_credits INT := 0;
    v_service_id UUID;
BEGIN
    -- Calculate total credits
    SELECT COALESCE(SUM(credit_cost), 0) INTO v_total_credits
    FROM services WHERE id = ANY(p_service_ids);

    -- Insert job
    INSERT INTO jobs (
        client_id, vehicle_brand, vehicle_model, vehicle_year, engine_type,
        engine_power_hp, ecu_type, gearbox_type, vin, mileage, fuel_type,
        client_notes, total_credits
    ) VALUES (
        auth.uid(), p_vehicle_brand, p_vehicle_model, p_vehicle_year, p_engine_type,
        p_engine_power_hp, p_ecu_type, p_gearbox_type, p_vin, p_mileage, p_fuel_type,
        p_client_notes, v_total_credits
    ) RETURNING id INTO v_job_id;

    -- Insert job services
    FOREACH v_service_id IN ARRAY p_service_ids
    LOOP
        INSERT INTO job_services (job_id, service_id)
        VALUES (v_job_id, v_service_id);
    END LOOP;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

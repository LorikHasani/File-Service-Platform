-- ============================================================================
-- ECU TUNING PLATFORM - SUPABASE SCHEMA (FIXED)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('client', 'admin', 'superadmin');
CREATE TYPE job_status AS ENUM (
    'pending',
    'in_progress', 
    'waiting_for_info',
    'completed',
    'revision_requested',
    'rejected'
);
CREATE TYPE file_type AS ENUM ('original', 'modified');
CREATE TYPE transaction_type AS ENUM ('credit_purchase', 'job_payment', 'refund', 'admin_adjustment');

-- ============================================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    company_name TEXT,
    contact_name TEXT NOT NULL,
    phone TEXT,
    country TEXT,
    credit_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    email_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, contact_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'contact_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- SERVICE CATEGORIES
-- ============================================================================

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SERVICES
-- ============================================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES service_categories(id),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    estimated_hours DECIMAL(4, 2) DEFAULT 1.00,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    icon TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- JOBS
-- ============================================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number TEXT NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES profiles(id),
    assigned_admin_id UUID REFERENCES profiles(id),
    
    -- Vehicle info
    vehicle_brand TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INT NOT NULL,
    engine_type TEXT NOT NULL,
    engine_power_hp INT,
    ecu_type TEXT,
    gearbox_type TEXT,
    vin TEXT,
    mileage INT,
    fuel_type TEXT,
    
    -- Status & pricing
    status job_status NOT NULL DEFAULT 'pending',
    priority INT DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    credits_used DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Notes
    client_notes TEXT,
    admin_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    revision_count INT DEFAULT 0
);

-- Generate reference number
CREATE OR REPLACE FUNCTION generate_job_reference()
RETURNS TRIGGER AS $$
DECLARE
    today_count INT;
BEGIN
    SELECT COUNT(*) + 1 INTO today_count
    FROM jobs
    WHERE DATE(created_at) = CURRENT_DATE;
    
    NEW.reference_number := 'TUN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(today_count::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_job_reference
    BEFORE INSERT ON jobs
    FOR EACH ROW EXECUTE FUNCTION generate_job_reference();

-- ============================================================================
-- JOB SERVICES (many-to-many)
-- ============================================================================

CREATE TABLE job_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    service_name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, service_id)
);

-- ============================================================================
-- FILES (metadata - actual files in Supabase Storage)
-- ============================================================================

CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    file_type file_type NOT NULL,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- JOB MESSAGES
-- ============================================================================

CREATE TABLE job_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRANSACTIONS
-- ============================================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    type transaction_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    balance_before DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    job_id UUID REFERENCES jobs(id),
    description TEXT,
    processed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CREDIT PACKAGES
-- ============================================================================

CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    credits DECIMAL(10, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    bonus_credits DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_type TEXT,
    link_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = 'client');

CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can update profiles"
    ON profiles FOR UPDATE
    USING (is_admin());

-- JOBS POLICIES
CREATE POLICY "Clients can view own jobs"
    ON jobs FOR SELECT
    USING (auth.uid() = client_id);

CREATE POLICY "Clients can create jobs"
    ON jobs FOR INSERT
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own jobs"
    ON jobs FOR UPDATE
    USING (auth.uid() = client_id)
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Admins can view all jobs"
    ON jobs FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can update all jobs"
    ON jobs FOR UPDATE
    USING (is_admin());

-- JOB SERVICES POLICIES
CREATE POLICY "Users can view job services for their jobs"
    ON job_services FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.client_id = auth.uid())
        OR is_admin()
    );

CREATE POLICY "Users can insert job services for their jobs"
    ON job_services FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.client_id = auth.uid())
    );

-- FILES POLICIES
CREATE POLICY "Users can view files for their jobs"
    ON files FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.client_id = auth.uid())
        OR is_admin()
    );

CREATE POLICY "Users can upload original files"
    ON files FOR INSERT
    WITH CHECK (
        auth.uid() = uploaded_by AND
        file_type = 'original' AND
        EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.client_id = auth.uid())
    );

CREATE POLICY "Admins can upload modified files"
    ON files FOR INSERT
    WITH CHECK (is_admin());

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages for their jobs"
    ON job_messages FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.client_id = auth.uid()) AND NOT is_internal)
        OR is_admin()
    );

CREATE POLICY "Users can send messages"
    ON job_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.client_id = auth.uid()) OR is_admin())
    );

-- TRANSACTIONS POLICIES
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id OR is_admin());

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- SERVICES & CATEGORIES (public read)
CREATE POLICY "Anyone can view active services"
    ON services FOR SELECT
    USING (is_active = true);

CREATE POLICY "Anyone can view active categories"
    ON service_categories FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage services"
    ON services FOR ALL
    USING (is_admin());

CREATE POLICY "Admins can manage categories"
    ON service_categories FOR ALL
    USING (is_admin());

-- CREDIT PACKAGES (public read)
CREATE POLICY "Anyone can view active packages"
    ON credit_packages FOR SELECT
    USING (is_active = true);

-- ============================================================================
-- FUNCTIONS FOR BUSINESS LOGIC (FIXED - required params first, optional last)
-- ============================================================================

-- Create job with services and deduct credits
CREATE OR REPLACE FUNCTION create_job_with_services(
    p_vehicle_brand TEXT,
    p_vehicle_model TEXT,
    p_vehicle_year INT,
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

-- Admin: Update job status
CREATE OR REPLACE FUNCTION update_job_status(
    p_job_id UUID,
    p_status job_status,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    UPDATE jobs SET
        status = p_status,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        assigned_admin_id = auth.uid(),
        started_at = CASE WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_job_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: Add credits to user
CREATE OR REPLACE FUNCTION admin_add_credits(
    p_user_id UUID,
    p_amount DECIMAL(10, 2),
    p_description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance DECIMAL(10, 2);
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    SELECT credit_balance INTO v_current_balance
    FROM profiles WHERE id = p_user_id;
    
    UPDATE profiles 
    SET credit_balance = credit_balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description, processed_by)
    VALUES (p_user_id, 'admin_adjustment', p_amount, v_current_balance, v_current_balance + p_amount, p_description, auth.uid());
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request revision
CREATE OR REPLACE FUNCTION request_job_revision(
    p_job_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verify ownership and status
    IF NOT EXISTS (
        SELECT 1 FROM jobs 
        WHERE id = p_job_id 
        AND client_id = auth.uid() 
        AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Job not found or not eligible for revision';
    END IF;
    
    UPDATE jobs SET
        status = 'revision_requested',
        revision_count = revision_count + 1,
        updated_at = NOW()
    WHERE id = p_job_id;
    
    -- Add message
    INSERT INTO job_messages (job_id, sender_id, message)
    VALUES (p_job_id, auth.uid(), 'Revision requested: ' || p_reason);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Service Categories
INSERT INTO service_categories (name, description, sort_order) VALUES
    ('Performance Tuning', 'Engine performance modifications', 1),
    ('Emissions', 'Emission system modifications', 2),
    ('Special Features', 'Additional features and customizations', 3);

-- Services
INSERT INTO services (category_id, code, name, description, base_price, estimated_hours, icon) VALUES
    ((SELECT id FROM service_categories WHERE name = 'Performance Tuning'), 'stage1', 'Stage 1', 'Safe power increase with stock hardware', 150.00, 2.0, 'zap'),
    ((SELECT id FROM service_categories WHERE name = 'Performance Tuning'), 'stage2', 'Stage 2', 'Increased power for modified intake/exhaust', 200.00, 3.0, 'rocket'),
    ((SELECT id FROM service_categories WHERE name = 'Emissions'), 'dpf_off', 'DPF OFF', 'Diesel particulate filter removal', 100.00, 1.5, 'filter'),
    ((SELECT id FROM service_categories WHERE name = 'Emissions'), 'egr_off', 'EGR OFF', 'Exhaust gas recirculation disable', 80.00, 1.0, 'wind'),
    ((SELECT id FROM service_categories WHERE name = 'Emissions'), 'adblue_off', 'AdBlue OFF', 'AdBlue/SCR system disable', 120.00, 2.0, 'droplet'),
    ((SELECT id FROM service_categories WHERE name = 'Special Features'), 'pops_bangs', 'Pops & Bangs', 'Exhaust crackle/pop sounds on deceleration', 100.00, 1.5, 'flame'),
    ((SELECT id FROM service_categories WHERE name = 'Special Features'), 'launch_control', 'Launch Control', 'Launch control activation', 80.00, 1.0, 'flag'),
    ((SELECT id FROM service_categories WHERE name = 'Special Features'), 'speed_limiter', 'Speed Limiter OFF', 'Remove electronic speed limiter', 60.00, 0.5, 'gauge');

-- Credit Packages
INSERT INTO credit_packages (name, credits, price, bonus_credits, sort_order) VALUES
    ('Starter', 100.00, 100.00, 0, 1),
    ('Professional', 250.00, 225.00, 25.00, 2),
    ('Business', 500.00, 425.00, 75.00, 3),
    ('Enterprise', 1000.00, 800.00, 200.00, 4);

-- ============================================================================
-- ADD job_type COLUMN TO service_categories + TCU SERVICES
-- ============================================================================

-- Add job_type column to service_categories
-- 'ecu' = show only for ECU files
-- 'tcu' = show only for Gearbox/TCU files
-- 'all' = show for both
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'ecu';

-- Set existing categories to 'ecu' (they are ECU services)
UPDATE service_categories SET job_type = 'ecu' WHERE job_type IS NULL OR job_type = '';

-- ============================================================================
-- TCU SERVICE CATEGORY + SERVICES
-- ============================================================================

-- Create TCU Stages category (single select, like ECU tuning stages)
INSERT INTO service_categories (name, description, sort_order, is_active, selection_type, job_type)
VALUES ('TCU Stages', 'Gearbox/TCU tuning stages', 10, true, 'single', 'tcu');

-- Insert TCU services
INSERT INTO services (category_id, code, name, description, base_price, estimated_hours, sort_order, icon) VALUES
    ((SELECT id FROM service_categories WHERE name = 'TCU Stages'), 'supercar_tcu', 'Supercar TCU', 'Supercar gearbox tuning', 150.00, 3.0, 1, 'rocket'),
    ((SELECT id FROM service_categories WHERE name = 'TCU Stages'), 'stage1_tcu', 'Stage 1 TCU', 'Stage 1 gearbox tuning', 75.00, 2.0, 2, 'zap'),
    ((SELECT id FROM service_categories WHERE name = 'TCU Stages'), 'stage2_tcu', 'Stage 2 TCU', 'Stage 2 gearbox tuning', 130.00, 2.5, 3, 'gauge');

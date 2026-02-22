-- New fields for unified upload flow
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'ecu';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_original BOOLEAN DEFAULT true;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reading_tool TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tool_type TEXT DEFAULT 'master';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS model_year TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS car_notes TEXT;

-- Category selection type: 'single' = pick one (Tuning Stage), 'multi' = pick many (Additional Options)
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS selection_type TEXT DEFAULT 'multi';

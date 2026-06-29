-- ============================================================================
-- Business hours / working schedule shown in the sidebar "Working Hours" widget
-- One row per day of the week (0 = Sunday … 6 = Saturday, matching JS getDay()).
-- Times are stored as minutes from midnight so both the open/closed status and
-- the displayed label can be derived. Admins edit these; everyone reads them.
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_hours (
  day_of_week   SMALLINT PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed     BOOLEAN  NOT NULL DEFAULT FALSE,
  open_minutes  SMALLINT NOT NULL DEFAULT 540  CHECK (open_minutes  BETWEEN 0 AND 1440), -- 9:00
  close_minutes SMALLINT NOT NULL DEFAULT 1320 CHECK (close_minutes BETWEEN 0 AND 1440), -- 22:00
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (close_minutes > open_minutes)
);

-- Seed the current schedule: Mon–Sat open 9:00–22:00, Sun closed.
INSERT INTO business_hours (day_of_week, is_closed, open_minutes, close_minutes) VALUES
  (0, TRUE,  540, 1320),
  (1, FALSE, 540, 1320),
  (2, FALSE, 540, 1320),
  (3, FALSE, 540, 1320),
  (4, FALSE, 540, 1320),
  (5, FALSE, 540, 1320),
  (6, FALSE, 540, 1320)
ON CONFLICT (day_of_week) DO NOTHING;

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- Anyone can read the schedule (the widget is shown to every logged-in user).
DROP POLICY IF EXISTS "Anyone can view business hours" ON business_hours;
CREATE POLICY "Anyone can view business hours"
  ON business_hours FOR SELECT
  USING (true);

-- Only admins can change the schedule.
DROP POLICY IF EXISTS "Admins can update business hours" ON business_hours;
CREATE POLICY "Admins can update business hours"
  ON business_hours FOR UPDATE
  USING (is_admin());

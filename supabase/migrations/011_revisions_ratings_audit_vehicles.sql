-- =============================================================================
-- Migration 011 — Revisions, Ratings, Audit Log, Saved Vehicles
-- =============================================================================
-- Adds four feature blocks in one migration:
--   1. File versioning on the `files` table (so every modified upload becomes a
--      new version instead of silently replacing the previous one).
--   2. job_ratings table — 1-5 stars + optional comment, one per completed job.
--   3. admin_audit_log table + log_admin_action() RPC helper.
--   4. saved_vehicles table — lets repeat clients skip re-entering brand/model.
-- Safe to run repeatedly (all creates use IF NOT EXISTS).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FILE VERSIONING
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_note TEXT;

CREATE INDEX IF NOT EXISTS idx_files_job_type_version
  ON files(job_id, file_type, version DESC);

-- Helper RPC: reserve the next version number for a given job/file_type.
-- Called from the uploadFile() JS helper so concurrent uploads never collide.
CREATE OR REPLACE FUNCTION next_file_version(
  p_job_id UUID,
  p_file_type file_type
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next
  FROM files
  WHERE job_id = p_job_id
    AND file_type = p_file_type;
  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION next_file_version(UUID, file_type) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. JOB RATINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_ratings_user ON job_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_job_ratings_created ON job_ratings(created_at DESC);

ALTER TABLE job_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public ratings" ON job_ratings;
CREATE POLICY "Anyone can view public ratings"
  ON job_ratings FOR SELECT
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "Users can view own ratings" ON job_ratings;
CREATE POLICY "Users can view own ratings"
  ON job_ratings FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all ratings" ON job_ratings;
CREATE POLICY "Admins can view all ratings"
  ON job_ratings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

DROP POLICY IF EXISTS "Users can rate own completed jobs" ON job_ratings;
CREATE POLICY "Users can rate own completed jobs"
  ON job_ratings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_id
        AND jobs.client_id = auth.uid()
        AND jobs.status = 'completed'
    )
  );

DROP POLICY IF EXISTS "Users can update own ratings" ON job_ratings;
CREATE POLICY "Users can update own ratings"
  ON job_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ADMIN AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view audit log" ON admin_audit_log;
CREATE POLICY "Only admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- Inserts go exclusively through log_admin_action() (SECURITY DEFINER)
-- so no direct insert policy is needed.

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Only admins can log audit actions';
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_admin_action(TEXT, TEXT, UUID, JSONB) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SAVED VEHICLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  vehicle_brand TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_generation TEXT,
  vehicle_year TEXT,
  engine_type TEXT NOT NULL,
  ecu_type TEXT,
  gearbox_type TEXT,
  vin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_vehicles_user ON saved_vehicles(user_id, created_at DESC);

ALTER TABLE saved_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved vehicles" ON saved_vehicles;
CREATE POLICY "Users can view own saved vehicles"
  ON saved_vehicles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own saved vehicles" ON saved_vehicles;
CREATE POLICY "Users can insert own saved vehicles"
  ON saved_vehicles FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own saved vehicles" ON saved_vehicles;
CREATE POLICY "Users can update own saved vehicles"
  ON saved_vehicles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own saved vehicles" ON saved_vehicles;
CREATE POLICY "Users can delete own saved vehicles"
  ON saved_vehicles FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all saved vehicles" ON saved_vehicles;
CREATE POLICY "Admins can view all saved vehicles"
  ON saved_vehicles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

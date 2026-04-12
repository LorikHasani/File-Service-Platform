-- ============================================================================
-- Admin: Delete a job and all related data
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_delete_job(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_file RECORD;
BEGIN
  -- Only admins can delete jobs
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete jobs';
  END IF;

  -- Verify job exists
  IF NOT EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id) THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Nullify job reference in transactions (preserve financial history)
  UPDATE transactions SET job_id = NULL WHERE job_id = p_job_id;

  -- Delete dependent rows (most cascade, but be explicit for safety)
  DELETE FROM notifications WHERE link_id = p_job_id;
  DELETE FROM job_ratings WHERE job_id = p_job_id;
  DELETE FROM job_messages WHERE job_id = p_job_id;
  DELETE FROM files WHERE job_id = p_job_id;
  DELETE FROM job_services WHERE job_id = p_job_id;

  -- Delete the job itself
  DELETE FROM jobs WHERE id = p_job_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

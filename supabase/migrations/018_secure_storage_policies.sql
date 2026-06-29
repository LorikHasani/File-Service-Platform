-- ============================================================================
-- Scope ecu-files storage access to the owning job (or an admin).
--
-- The default policies (storage_select/insert/update/delete) allowed ANY
-- authenticated user to read, overwrite and delete EVERY object in the bucket,
-- i.e. one client could download or destroy another client's original and
-- tuned files. File paths are `{jobId}/{fileType}/...`, so the first folder
-- segment is the job id; we match it against the jobs table.
--
-- Admin asset folders (banners/, email-images/, announcements/) are written
-- only by admins and shown to clients via signed URLs (which bypass RLS), so
-- clients never need direct SELECT on them.
-- ============================================================================

-- Remove the over-permissive default policies.
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete" ON storage.objects;

-- Read: admins see everything; a client sees only files under one of their jobs.
CREATE POLICY "ecu_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ecu-files' AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.jobs
        WHERE jobs.id::text = (storage.foldername(name))[1]
          AND jobs.client_id = auth.uid()
      )
    )
  );

-- Upload: admins anywhere (incl. tuned files + asset folders); a client only
-- into a folder belonging to one of their own jobs.
CREATE POLICY "ecu_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ecu-files' AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.jobs
        WHERE jobs.id::text = (storage.foldername(name))[1]
          AND jobs.client_id = auth.uid()
      )
    )
  );

-- Overwrite and delete are admin-only. Clients always upload new, versioned
-- paths, so they never need to update or delete existing objects.
CREATE POLICY "ecu_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ecu-files' AND public.is_admin());

CREATE POLICY "ecu_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ecu-files' AND public.is_admin());

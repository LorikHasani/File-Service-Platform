-- ============================================================================
-- 020 — Let admins update job_messages.is_read (run in Supabase SQL editor)
--
-- job_messages has had an is_read column since the initial schema, but no
-- UPDATE policy existed so nothing could ever set it. The admin UI now marks
-- a job's messages as read when an admin opens the job, powering an
-- unread-message badge on the admin jobs list.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can update job messages" ON job_messages;
CREATE POLICY "Admins can update job messages"
    ON job_messages FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

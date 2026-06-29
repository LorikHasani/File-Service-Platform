-- ============================================================================
-- Harden the jobs and job_services tables against client tampering.
--
-- Like profiles, the "Clients can update own jobs" RLS policy is row-level, so
-- a client could update ANY column on their own job (status, total_price,
-- credits_used, priority, assigned_admin_id, admin_notes) via a direct API
-- call. We restrict client UPDATE to the few columns they legitimately set
-- after upload. Admin job changes go through SECURITY DEFINER RPCs
-- (update_job_status, admin_delete_job), which run as the table owner and are
-- unaffected by these column grants.
-- ============================================================================

-- 1. Column-level UPDATE privileges on jobs. Clients keep only the file/vehicle
--    metadata they set when submitting; status, pricing, priority, assignment
--    and internal notes become admin-only (changed solely via RPCs).
REVOKE UPDATE ON jobs FROM authenticated;
GRANT UPDATE (
    file_type,
    is_original,
    reading_tool,
    tool_type,
    car_notes,
    job_type,
    client_notes,
    updated_at
) ON jobs TO authenticated;

-- 2. Remove the loose client INSERT policy on job_services. The line items are
--    written by create_job_with_services() (SECURITY DEFINER), so clients never
--    need to insert them directly — and shouldn't be able to forge them.
DROP POLICY IF EXISTS "Users can insert job services for their jobs" ON job_services;

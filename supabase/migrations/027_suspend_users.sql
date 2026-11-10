-- ============================================================================
-- Suspend client accounts.
--
-- An admin can suspend a client from Admin → Users → (client). A suspended
-- client cannot sign in; the login page shows "Your account is suspended."
--
-- Two things are set together:
--   * profiles.suspended_at  — what the portal shows and checks.
--   * auth.users.banned_until — makes Supabase Auth itself refuse sign-in and
--     token refresh, so the block does not depend on the browser.
-- The client's open sessions are ended as well.
--
-- Clients cannot lift their own suspension: profiles.suspended_at is not in
-- the column UPDATE grant from migration 016.
--
-- Run by hand in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION admin_set_user_suspended(p_user_id UUID, p_suspended BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role user_role;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can suspend accounts';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot suspend your own account';
    END IF;

    SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    IF v_role <> 'client' THEN
        RAISE EXCEPTION 'Only client accounts can be suspended';
    END IF;

    UPDATE profiles
    SET suspended_at = CASE WHEN p_suspended THEN COALESCE(suspended_at, NOW()) ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Supabase Auth refuses sign-in and token refresh while banned_until is in
    -- the future. A far-off date rather than 'infinity', which Auth cannot read.
    UPDATE auth.users
    SET banned_until = CASE WHEN p_suspended THEN NOW() + INTERVAL '100 years' ELSE NULL END
    WHERE id = p_user_id;

    -- End the client's open sessions. Best effort: the suspension above
    -- already stands if this is not permitted.
    IF p_suspended THEN
        BEGIN
            DELETE FROM auth.sessions WHERE user_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not end sessions for %: %', p_user_id, SQLERRM;
        END;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_user_suspended(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_user_suspended(UUID, BOOLEAN) TO authenticated;

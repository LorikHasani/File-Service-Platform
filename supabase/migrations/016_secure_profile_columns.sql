-- ============================================================================
-- Lock down which profile columns a client may change.
--
-- Postgres RLS is row-level, not column-level: the "Users can update own
-- profile" policy let a client update ANY column on their own row (e.g.
-- credit_balance, tool_type, stripe_customer_id) via a crafted API call.
-- We add column-level UPDATE privileges so the authenticated role can only
-- self-edit harmless contact fields. Sensitive columns are changed exclusively
-- through SECURITY DEFINER functions (admin credit/refund RPCs, job creation,
-- and admin_set_tool_type below), which run as the table owner and bypass
-- these column grants.
-- ============================================================================

-- Remove the blanket UPDATE privilege, then grant back only the safe columns.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (contact_name, company_name, phone, country, email_notifications, updated_at)
  ON profiles TO authenticated;

-- Admins change a client's master/slave tier through this function instead of a
-- direct table update (which the column grant above now blocks for everyone).
CREATE OR REPLACE FUNCTION admin_set_tool_type(p_user_id UUID, p_tool_type TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can change a client''s tool type';
    END IF;

    IF p_tool_type NOT IN ('master', 'slave') THEN
        RAISE EXCEPTION 'Invalid tool type: %', p_tool_type;
    END IF;

    UPDATE profiles
    SET tool_type = p_tool_type,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_set_tool_type(UUID, TEXT) TO authenticated;

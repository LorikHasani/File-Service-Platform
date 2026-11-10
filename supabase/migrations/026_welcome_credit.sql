-- ============================================================================
-- Welcome credit for new clients, with an admin on/off switch.
--
-- Until now the welcome credit was added by hand in the admin panel. This
-- makes it automatic: when a new client confirms their email, the amount in
-- welcome_credit is added to their balance (once), provided the switch is on.
-- The same row drives the "€20 free credit" copy on the landing, signup and
-- dashboard pages, so turning the switch off removes both the credit and the
-- promise in one step.
--
-- Run by hand in the Supabase SQL editor.
-- ============================================================================

-- 1. Single-row settings table (id is always TRUE).
CREATE TABLE IF NOT EXISTS welcome_credit (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  amount     DECIMAL(10, 2) NOT NULL DEFAULT 20.00 CHECK (amount > 0 AND amount <= 500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO welcome_credit (id, enabled, amount) VALUES (TRUE, TRUE, 20.00)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE welcome_credit ENABLE ROW LEVEL SECURITY;

-- Everyone (including logged-out visitors on the landing page) may read it.
DROP POLICY IF EXISTS "Anyone can view welcome credit" ON welcome_credit;
CREATE POLICY "Anyone can view welcome credit"
  ON welcome_credit FOR SELECT
  USING (true);

-- Only admins can switch it on/off or change the amount.
DROP POLICY IF EXISTS "Admins can update welcome credit" ON welcome_credit;
CREATE POLICY "Admins can update welcome credit"
  ON welcome_credit FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT ON welcome_credit TO anon, authenticated;
GRANT UPDATE (enabled, amount, updated_at) ON welcome_credit TO authenticated;

-- 2. Remember who already received it, so it can never be granted twice.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS welcome_credit_granted_at TIMESTAMPTZ;

-- 3. Grant the credit when a user's email becomes confirmed.
--    SECURITY DEFINER: runs as the table owner, so it may write
--    profiles.credit_balance (clients cannot — see migration 016).
--    Any failure is swallowed: a problem here must never block a signup or
--    an email confirmation.
CREATE OR REPLACE FUNCTION grant_welcome_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_enabled BOOLEAN;
    v_amount  DECIMAL(10, 2);
    v_balance DECIMAL(10, 2);
    v_role    user_role;
    v_granted TIMESTAMPTZ;
BEGIN
    SELECT enabled, amount INTO v_enabled, v_amount FROM welcome_credit WHERE id;
    IF NOT COALESCE(v_enabled, FALSE) THEN
        RETURN NEW;
    END IF;

    SELECT credit_balance, role, welcome_credit_granted_at
      INTO v_balance, v_role, v_granted
    FROM profiles
    WHERE id = NEW.id
    FOR UPDATE;

    -- No profile yet, not a client, or already granted: nothing to do.
    IF NOT FOUND OR v_role <> 'client' OR v_granted IS NOT NULL THEN
        RETURN NEW;
    END IF;

    UPDATE profiles
    SET credit_balance = v_balance + v_amount,
        welcome_credit_granted_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.id;

    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (NEW.id, 'admin_adjustment', v_amount, v_balance, v_balance + v_amount, 'Welcome credit');

    INSERT INTO notifications (user_id, title, message)
    VALUES (
        NEW.id,
        'Welcome — your free credit is ready',
        '€' || trim(to_char(v_amount, 'FM999990.00')) || ' has been added to your balance. Upload your first file to use it.'
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'grant_welcome_credit failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Fires only on the unconfirmed -> confirmed transition, so existing clients
-- and later logins are unaffected.
DROP TRIGGER IF EXISTS zz_grant_welcome_credit_on_confirm ON auth.users;
CREATE TRIGGER zz_grant_welcome_credit_on_confirm
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION grant_welcome_credit();

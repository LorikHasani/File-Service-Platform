-- ============================================================================
-- 010_refund_returns_credits.sql
-- ----------------------------------------------------------------------------
-- Fix the semantics of admin_refund_credits so that refunds ADD credits BACK
-- to the user's balance (reversing a job payment) instead of subtracting them.
--
-- Prior to this migration the refund RPC deducted the refund amount from the
-- balance and recorded the transaction with a NEGATIVE amount. That matched a
-- "Stripe purchase reversal" flow, but the admin UI actually uses refunds to
-- return credits to clients when a tuning job can't be completed — the
-- opposite direction.
--
-- After this migration:
--   * The user's credit_balance is INCREASED by p_amount
--   * The refund transaction is stored with a POSITIVE amount
--   * balance_before / balance_after reflect the increase
--
-- Existing refund rows in the transactions table are left untouched.
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_refund_credits(
    p_user_id UUID,
    p_amount DECIMAL(10, 2),
    p_reason TEXT,
    p_job_id UUID DEFAULT NULL,
    p_original_transaction_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_current_balance DECIMAL(10, 2);
    v_new_balance DECIMAL(10, 2);
    v_transaction_id UUID;
    v_description TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only admins can issue refunds';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Refund amount must be greater than zero';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Refund reason is required';
    END IF;

    SELECT credit_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Refund ADDS credits back to the user's balance
    v_new_balance := v_current_balance + p_amount;

    UPDATE profiles
    SET credit_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    v_description := 'Refund: ' || p_reason;
    IF p_original_transaction_id IS NOT NULL THEN
        v_description := v_description || ' (original tx ' || p_original_transaction_id::text || ')';
    END IF;

    -- Record the refund as a POSITIVE-amount transaction (credits returned)
    INSERT INTO transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        job_id,
        description,
        processed_by
    )
    VALUES (
        p_user_id,
        'refund',
        p_amount,
        v_current_balance,
        v_new_balance,
        p_job_id,
        v_description,
        auth.uid()
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

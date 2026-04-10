-- ============================================================================
-- Admin: Issue a proper refund
--
-- Creates a `refund` transaction, reduces the client's credit balance
-- and optionally links to the original purchase transaction and/or a job.
-- Only admins can call this function.
--
-- Returns the new transaction ID so the UI can confirm the refund.
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
    -- Only admins can issue refunds
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only admins can issue refunds';
    END IF;

    -- Amount must be a positive number (the amount being refunded)
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Refund amount must be greater than zero';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Refund reason is required';
    END IF;

    -- Load current balance (and lock the row for the duration of the tx)
    SELECT credit_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    v_new_balance := v_current_balance - p_amount;

    -- Reduce the client's balance (allow balance to go negative if necessary —
    -- the admin is explicitly refunding, they accept the consequences)
    UPDATE profiles
    SET credit_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    v_description := 'Refund: ' || p_reason;
    IF p_original_transaction_id IS NOT NULL THEN
        v_description := v_description || ' (original tx ' || p_original_transaction_id::text || ')';
    END IF;

    -- Record the refund as a negative-amount transaction of type 'refund'
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
        -p_amount,
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

-- Allow authenticated users to call the function (the function itself
-- enforces the admin check via is_admin()).
GRANT EXECUTE ON FUNCTION admin_refund_credits(UUID, DECIMAL, TEXT, UUID, UUID) TO authenticated;

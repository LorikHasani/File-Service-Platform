-- ============================================================================
-- Copy company_name and phone from signup metadata into the profile
-- ============================================================================
-- handle_new_user() only copied contact_name. The client then tried to write
-- company_name/phone itself right after signUp, but with email confirmation
-- on there is no session yet, so RLS silently dropped that update. Those
-- fields only reached the profile if the user later logged in. Copy them in
-- the trigger instead, and backfill the profiles that are missing them.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO profiles (id, email, contact_name, company_name, phone)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'contact_name'), ''), split_part(NEW.email, '@', 1)),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
    );
    RETURN NEW;
END;
$$;

-- Backfill existing profiles from the metadata stored at signup.
UPDATE profiles p
SET
    company_name = COALESCE(NULLIF(TRIM(p.company_name), ''), NULLIF(TRIM(u.raw_user_meta_data->>'company_name'), '')),
    phone        = COALESCE(NULLIF(TRIM(p.phone), ''),        NULLIF(TRIM(u.raw_user_meta_data->>'phone'), '')),
    updated_at   = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND (
        (NULLIF(TRIM(p.company_name), '') IS NULL AND NULLIF(TRIM(u.raw_user_meta_data->>'company_name'), '') IS NOT NULL)
     OR (NULLIF(TRIM(p.phone), '') IS NULL        AND NULLIF(TRIM(u.raw_user_meta_data->>'phone'), '') IS NOT NULL)
  );

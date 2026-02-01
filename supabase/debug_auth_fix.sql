-- ============================================================================
-- DEBUG & FIX SCRIPT FOR AUTH ISSUES
-- Run these in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Check if the trigger exists and is working
-- ============================================================================

-- Check existing triggers on auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- ============================================================================
-- STEP 2: Fix the profile creation trigger (safer version)
-- ============================================================================

-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create improved function that won't fail
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, contact_name, role, credit_balance)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'contact_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        'client',
        0
    )
    ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the signup
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 3: Create profiles for any existing auth users without profiles
-- ============================================================================

INSERT INTO public.profiles (id, email, contact_name, role, credit_balance)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'contact_name', split_part(au.email, '@', 1)),
    'client',
    0
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- ============================================================================
-- STEP 4: If you manually added a profile, link it to an auth user
-- ============================================================================

-- First, check what's in your profiles table:
SELECT id, email, contact_name, role FROM profiles;

-- Check what's in auth.users:
SELECT id, email FROM auth.users;

-- ============================================================================
-- STEP 5: Create an admin user properly (the right way)
-- ============================================================================

-- OPTION A: If you already have a user who registered, make them admin:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';

-- OPTION B: If you need to create a fresh admin, do it through Supabase Auth:
-- 1. Go to Authentication > Users in Supabase dashboard
-- 2. Click "Add User" 
-- 3. Enter email and password
-- 4. After user is created, run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@example.com';

-- ============================================================================
-- STEP 6: Delete any orphaned profiles (profiles without auth users)
-- ============================================================================

-- See orphaned profiles:
SELECT p.* 
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- Delete orphaned profiles (uncomment to run):
-- DELETE FROM profiles 
-- WHERE id NOT IN (SELECT id FROM auth.users);

-- ============================================================================
-- STEP 7: Add credits to test (optional)
-- ============================================================================

-- Add 500 credits to all users for testing:
-- UPDATE profiles SET credit_balance = 500;

-- Or add to specific user:
-- UPDATE profiles SET credit_balance = 500 WHERE email = 'your-email@example.com';

-- ============================================================================
-- Migration: Add Stripe Integration
-- ============================================================================
-- Adds stripe_customer_id to profiles table for linking Supabase users
-- to Stripe customers. Run this in the Supabase SQL Editor.
-- ============================================================================

-- Add stripe_customer_id column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for fast lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
  ON profiles(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

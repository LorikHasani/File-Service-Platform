-- ============================================================================
-- Migration: Add job_type to distinguish ECU vs TCU jobs
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add job_type column (defaults to 'ecu' for existing jobs)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'ecu';

-- Add tcu_type column for TCU-specific info
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tcu_type TEXT;

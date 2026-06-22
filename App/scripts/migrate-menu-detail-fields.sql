-- Migration: add detail fields to Menus table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE "Menus"
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS calories          INTEGER,
  ADD COLUMN IF NOT EXISTS ingredients       TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Menus'
  AND column_name IN ('prep_time_minutes', 'calories', 'ingredients');

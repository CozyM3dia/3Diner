-- Migration: add Google Maps review URL to Cafes
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE "Cafes"
  ADD COLUMN IF NOT EXISTS google_maps_review_url TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Cafes'
  AND column_name = 'google_maps_review_url';

-- 3Diner — Dashboard migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Adds menu availability/scheduling fields + Announcements table.

-- ── Menus: availability, discount, daypart scheduling ──
ALTER TABLE "Menus"
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS discount_pct   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS schedule_days  TEXT,   -- comma ISO weekday nums, e.g. "1,2,3,4,5" (1=Mon)
  ADD COLUMN IF NOT EXISTS schedule_start TEXT,   -- "HH:MM", e.g. "08:00"
  ADD COLUMN IF NOT EXISTS schedule_end   TEXT;   -- "HH:MM", e.g. "22:00"

-- ── Announcements: real-time banner pushed to the customer menu ──
CREATE TABLE IF NOT EXISTS public."Announcements" (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cafe_id     UUID NOT NULL REFERENCES public."Cafes"(id_cafe) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  bg_color    TEXT DEFAULT '#FD5002',
  is_active   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_cafe_idx ON public."Announcements" (cafe_id, is_active);

ALTER TABLE public."Announcements" ENABLE ROW LEVEL SECURITY;

-- Anonymous customers may read the active banner for any cafe.
DROP POLICY IF EXISTS "announcements_select_anon" ON public."Announcements";
CREATE POLICY "announcements_select_anon" ON public."Announcements"
  FOR SELECT TO anon USING (true);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Menus'
  AND column_name IN ('is_active','discount_pct','schedule_days','schedule_start','schedule_end');

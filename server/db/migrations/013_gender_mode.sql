-- Migration 013: add gender_mode to generations table
-- Stores whether the generation was requested for female or male styling.

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS gender_mode TEXT NOT NULL DEFAULT 'female'
  CHECK (gender_mode IN ('female', 'male'));

-- Sanity check
DO $$
BEGIN
  RAISE NOTICE 'Migration 013 done — gender_mode column added to generations';
END $$;

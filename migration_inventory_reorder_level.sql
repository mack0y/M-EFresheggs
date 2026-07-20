-- Migration: Add reorder_level to inventory for configurable low-stock thresholds
-- Run this in Supabase SQL Editor

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 30;

-- Set sensible defaults by egg size name
UPDATE inventory
SET reorder_level = CASE
  WHEN egg_size_id IN (SELECT id FROM egg_sizes WHERE LOWER(name) IN ('peewee', 'pullet')) THEN 50
  WHEN egg_size_id IN (SELECT id FROM egg_sizes WHERE LOWER(name) IN ('small', 'medium')) THEN 30
  WHEN egg_size_id IN (SELECT id FROM egg_sizes WHERE LOWER(name) IN ('large', 'extra large', 'jumbo')) THEN 20
  ELSE 30
END
WHERE reorder_level = 30;

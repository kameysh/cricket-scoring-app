-- Migration 017: Add man_of_series_id to tournaments
-- Run manually in Supabase SQL Editor

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS man_of_series_id uuid REFERENCES players(id);

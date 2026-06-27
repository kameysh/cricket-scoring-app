-- 040_match_date.sql
-- Adds a dedicated "played on" date to matches. Until now the UI showed created_at
-- (the row-creation timestamp = when the match was SET UP), which is wrong when a
-- match is set up on one day and played on another (e.g. a tournament set up 25 Jun,
-- played 27 Jun). `match_date` is captured client-side when the match goes live
-- (matchService.startMatch); the UI shows match_date and falls back to created_at.
alter table matches
  add column if not exists match_date date;

-- Backfill: the K7 Trophy Season 7 matches were set up 25 Jun but played 27 Jun 2026.
update matches
  set match_date = '2026-06-27'
  where tournament_id = '18311fe2-b1be-4a3d-a6e9-76e115fb7415'
    and match_date is null;

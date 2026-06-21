-- 024_match_player_active.sql
-- Adds is_active flag to match_players to support mid-match player substitutions.
-- Subbed-out players are marked is_active=false so they are excluded from
-- batting/bowling candidate lists while remaining in the match record.
alter table match_players
  add column if not exists is_active boolean not null default true;

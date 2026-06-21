-- 023_player_sub.sql
-- Adds is_substitute flag to match_players so mid-match subs are distinguishable
-- from the original squad (useful for future stats display).
alter table match_players
  add column if not exists is_substitute boolean not null default false;

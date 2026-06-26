-- 037_player_injured.sql
-- Marks a match_players row as injured when the player is subbed out due to injury
-- (tournament matches). Set on the OUTGOING player's row. Reversible: cleared on swap-back.
alter table match_players
  add column if not exists is_injured boolean not null default false;

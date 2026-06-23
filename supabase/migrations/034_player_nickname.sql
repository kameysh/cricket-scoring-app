-- 034_player_nickname.sql
-- Add optional nickname to players — shown everywhere instead of full name when set.

alter table players add column if not exists nickname text;

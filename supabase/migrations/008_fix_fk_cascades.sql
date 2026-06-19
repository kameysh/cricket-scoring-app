-- Fix FK constraints: add ON DELETE CASCADE to player stats tables
-- player_career_stats and player_tournament_stats were blocking hard-deletes of players

alter table player_career_stats
  drop constraint if exists player_career_stats_player_id_fkey;
alter table player_career_stats
  add constraint player_career_stats_player_id_fkey
  foreign key (player_id) references players(id) on delete cascade;

alter table player_tournament_stats
  drop constraint if exists player_tournament_stats_player_id_fkey;
alter table player_tournament_stats
  add constraint player_tournament_stats_player_id_fkey
  foreign key (player_id) references players(id) on delete cascade;

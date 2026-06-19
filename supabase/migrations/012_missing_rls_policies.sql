-- ============================================================
-- Fill in missing RLS DELETE policies and lock down tables
-- that still have the blanket allow_all policy from migration 001
-- ============================================================

-- venues: admin can delete
create policy "admin_delete_venues" on venues for delete using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- tournaments: admin can delete
create policy "admin_delete_tournaments" on tournaments for delete using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- innings: scorer + admin can delete (needed for match reset / undo flows)
create policy "scorer_delete_innings" on innings for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- match_players: scorer + admin can write/delete
drop policy if exists allow_all_match_players on match_players;
create policy "public_read_match_players" on match_players for select using (true);
create policy "scorer_write_match_players" on match_players for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_match_players" on match_players for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_delete_match_players" on match_players for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- batting_scorecards
drop policy if exists allow_all_batting_scorecards on batting_scorecards;
create policy "public_read_batting_scorecards" on batting_scorecards for select using (true);
create policy "scorer_write_batting_scorecards" on batting_scorecards for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_batting_scorecards" on batting_scorecards for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_delete_batting_scorecards" on batting_scorecards for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- bowling_scorecards
drop policy if exists allow_all_bowling_scorecards on bowling_scorecards;
create policy "public_read_bowling_scorecards" on bowling_scorecards for select using (true);
create policy "scorer_write_bowling_scorecards" on bowling_scorecards for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_bowling_scorecards" on bowling_scorecards for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_delete_bowling_scorecards" on bowling_scorecards for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- fielding_scorecards
drop policy if exists allow_all_fielding_scorecards on fielding_scorecards;
create policy "public_read_fielding_scorecards" on fielding_scorecards for select using (true);
create policy "scorer_write_fielding_scorecards" on fielding_scorecards for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_fielding_scorecards" on fielding_scorecards for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_delete_fielding_scorecards" on fielding_scorecards for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- match_events
drop policy if exists allow_all_match_events on match_events;
create policy "public_read_match_events" on match_events for select using (true);
create policy "scorer_write_match_events" on match_events for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_delete_match_events" on match_events for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- tournament_players: admin only (manages team rosters)
drop policy if exists allow_all_tournament_players on tournament_players;
create policy "public_read_tournament_players" on tournament_players for select using (true);
create policy "admin_write_tournament_players" on tournament_players for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);
create policy "admin_delete_tournament_players" on tournament_players for delete using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- player_career_stats: system-managed (scorers update via triggers/service, no direct user write needed)
drop policy if exists allow_all_player_career_stats on player_career_stats;
create policy "public_read_player_career_stats" on player_career_stats for select using (true);
create policy "scorer_write_player_career_stats" on player_career_stats for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_player_career_stats" on player_career_stats for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "admin_delete_player_career_stats" on player_career_stats for delete using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- player_tournament_stats
drop policy if exists allow_all_player_tournament_stats on player_tournament_stats;
create policy "public_read_player_tournament_stats" on player_tournament_stats for select using (true);
create policy "scorer_write_player_tournament_stats" on player_tournament_stats for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_player_tournament_stats" on player_tournament_stats for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "admin_delete_player_tournament_stats" on player_tournament_stats for delete using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

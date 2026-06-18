create table if not exists tournament_team_players (
  id uuid primary key default gen_random_uuid(),
  tournament_team_id uuid not null references tournament_teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz default now(),
  unique(tournament_team_id, player_id)
);

alter table tournament_team_players enable row level security;

create policy "public read tournament_team_players" on tournament_team_players
  for select using (true);

create policy "auth write tournament_team_players" on tournament_team_players
  for all using (auth.role() = 'authenticated');

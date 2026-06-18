create table if not exists tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(tournament_id, name)
);

alter table tournament_teams enable row level security;

create policy "public read tournament_teams" on tournament_teams
  for select using (true);

create policy "auth write tournament_teams" on tournament_teams
  for all using (auth.role() = 'authenticated');

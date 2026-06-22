-- Add created_at to auction_teams (missed in initial migration)
alter table auction_teams
  add column if not exists created_at timestamptz default now();

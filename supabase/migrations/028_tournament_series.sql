-- Registry of recurring tournament names (e.g. "K7 Trophy", "Office League")
-- Each season is a separate tournament row linked here via series_id.
create table tournament_series (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  constraint tournament_series_name_unique unique (name)
);

alter table tournament_series enable row level security;

create policy "series_select" on tournament_series
  for select to authenticated using (true);

create policy "series_insert" on tournament_series
  for insert to authenticated
  with check (exists (
    select 1 from app_users where id = auth.uid() and role = 'admin'
  ));

create policy "series_delete" on tournament_series
  for delete to authenticated using (exists (
    select 1 from app_users where id = auth.uid() and role = 'admin'
  ));

-- Link each tournament season to a series (null = one-off event)
alter table tournaments
  add column series_id uuid references tournament_series(id) on delete set null;

-- Tournament promo banners — admin publishes one at a time, shown on Home page
create table if not exists tournament_promos (
  id           uuid        primary key default gen_random_uuid(),
  banner_url   text        not null,
  tournament_name text,
  team1_name   text,
  captain1_name text,
  team2_name   text,
  captain2_name text,
  event_date   date,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table tournament_promos enable row level security;

-- Admin: full CRUD
create policy "promo_admin_all" on tournament_promos
  for all to authenticated
  using  (exists (select 1 from app_users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from app_users where id = auth.uid() and role = 'admin'));

-- All authenticated users: read
create policy "promo_select" on tournament_promos
  for select to authenticated using (true);

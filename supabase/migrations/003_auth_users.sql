-- ============================================================
-- App Users (linked to Supabase Auth)
-- ============================================================
create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'viewer' check (role in ('admin','scorer','captain','viewer')),
  created_at timestamptz default now()
);

alter table app_users enable row level security;

-- Users can read their own row
create policy "read_own" on app_users
  for select using (auth.uid() = id);

-- Admins can read all rows
create policy "admin_read_all" on app_users
  for select using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- Only admins can insert new users (via edge function using service role)
create policy "admin_insert" on app_users
  for insert with check (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- Only admins can update roles
create policy "admin_update" on app_users
  for update using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Tighten RLS on core tables
-- Allow public reads, restrict writes by role
-- ============================================================

-- matches: admin + scorer can write
drop policy if exists allow_all_matches on matches;
create policy "public_read_matches" on matches for select using (true);
create policy "scorer_write_matches" on matches for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_matches" on matches for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "admin_delete_matches" on matches for delete using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- innings
drop policy if exists allow_all_innings on innings;
create policy "public_read_innings" on innings for select using (true);
create policy "scorer_write_innings" on innings for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_update_innings" on innings for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- deliveries
drop policy if exists allow_all_deliveries on deliveries;
create policy "public_read_deliveries" on deliveries for select using (true);
create policy "scorer_write_deliveries" on deliveries for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);
create policy "scorer_delete_deliveries" on deliveries for delete using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','scorer'))
);

-- players: admin + captain can write
drop policy if exists allow_all_players on players;
create policy "public_read_players" on players for select using (true);
create policy "captain_write_players" on players for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','captain'))
);
create policy "captain_update_players" on players for update using (
  exists (select 1 from app_users where id = auth.uid() and role in ('admin','captain'))
);

-- venues: admin only
drop policy if exists allow_all_venues on venues;
create policy "public_read_venues" on venues for select using (true);
create policy "admin_write_venues" on venues for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);
create policy "admin_update_venues" on venues for update using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- tournaments: admin only
drop policy if exists allow_all_tournaments on tournaments;
create policy "public_read_tournaments" on tournaments for select using (true);
create policy "admin_write_tournaments" on tournaments for insert with check (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);
create policy "admin_update_tournaments" on tournaments for update using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- Add 'player' to the allowed roles in app_users
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check
  check (role in ('admin', 'scorer', 'captain', 'viewer', 'player'));

-- Link a player record to its auth user (one-to-one, optional)
alter table players add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists players_user_id_unique on players(user_id) where user_id is not null;

-- Track which player is captain in each match
alter table match_players add column if not exists is_captain boolean not null default false;

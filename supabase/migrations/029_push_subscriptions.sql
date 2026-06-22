-- Push notification subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- RLS
alter table push_subscriptions enable row level security;

-- Users can manage their own subscriptions
create policy "user_own_subscription" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin can read all (needed to send to all players in a match)
create policy "admin_read_all_subscriptions" on push_subscriptions
  for select using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

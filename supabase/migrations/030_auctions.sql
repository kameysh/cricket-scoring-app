-- ─────────────────────────────────────────────────────────────────────────────
-- 030_auctions.sql — Live Player Auction feature
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. auctions ───────────────────────────────────────────────────────────────
create table if not exists auctions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  status          text not null default 'draft'
                    check (status in ('draft','setup_complete','live','paused','completed')),
  budget_per_team integer not null check (budget_per_team > 0),
  bid_increments  integer[] not null default '{50,100,200,500,1000}',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

alter table auctions enable row level security;

create policy "auctions_select" on auctions
  for select to authenticated using (true);

create policy "auctions_insert" on auctions
  for insert to authenticated
  with check (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

create policy "auctions_update" on auctions
  for update to authenticated
  using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

create policy "auctions_delete" on auctions
  for delete to authenticated
  using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- ── 2. auction_teams ──────────────────────────────────────────────────────────
-- Scalable: supports N teams per auction (not hardcoded team1/team2)
create table if not exists auction_teams (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references auctions(id) on delete cascade,
  team_id          uuid not null references teams(id) on delete restrict,
  captain_id       uuid references auth.users(id) on delete set null,
  budget_remaining integer not null,
  players_bought   integer not null default 0,
  constraint auction_teams_unique unique (auction_id, team_id)
);

alter table auction_teams enable row level security;

create policy "auction_teams_select" on auction_teams
  for select to authenticated using (true);

create policy "auction_teams_admin_write" on auction_teams
  for all to authenticated
  using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- ── 3. auction_players ────────────────────────────────────────────────────────
create table if not exists auction_players (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references auctions(id) on delete cascade,
  player_id        uuid not null references players(id) on delete restrict,
  base_price       integer not null default 100 check (base_price >= 0),
  status           text not null default 'pool'
                     check (status in ('pool','active','held','sold','unsold')),
  current_bid      integer,
  leading_team_id  uuid references auction_teams(id) on delete set null,
  sold_to_team_id  uuid references auction_teams(id) on delete set null,
  sold_price       integer,
  held_at          timestamptz,
  pool_order       integer not null default 0,
  pass_team1       boolean not null default false,
  pass_team2       boolean not null default false,
  constraint auction_players_unique unique (auction_id, player_id)
);

create index auction_players_status_idx on auction_players(auction_id, status);

alter table auction_players enable row level security;

create policy "auction_players_select" on auction_players
  for select to authenticated using (true);

create policy "auction_players_insert" on auction_players
  for insert to authenticated
  with check (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- Admin or any captain in that auction can UPDATE (field-level restrictions enforced in service)
create policy "auction_players_update" on auction_players
  for update to authenticated
  using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
    or
    exists (
      select 1 from auction_teams
      where auction_id = auction_players.auction_id
        and captain_id = auth.uid()
    )
  );

create policy "auction_players_delete" on auction_players
  for delete to authenticated
  using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );

-- ── 4. auction_bids ───────────────────────────────────────────────────────────
create table if not exists auction_bids (
  id                uuid primary key default gen_random_uuid(),
  auction_id        uuid not null references auctions(id) on delete cascade,
  auction_player_id uuid not null references auction_players(id) on delete cascade,
  auction_team_id   uuid not null references auction_teams(id) on delete cascade,
  amount            integer not null check (amount > 0),
  bid_type          text not null default 'captain'
                      check (bid_type in ('captain','auctioneer_raise')),
  created_at        timestamptz default now()
);

create index auction_bids_player_idx on auction_bids(auction_player_id, created_at desc);

alter table auction_bids enable row level security;

create policy "auction_bids_select" on auction_bids
  for select to authenticated using (true);

-- Admin can insert any bid; captain can only insert for their own team
create policy "auction_bids_insert" on auction_bids
  for insert to authenticated
  with check (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
    or (
      bid_type = 'captain'
      and exists (
        select 1 from auction_teams
        where id = auction_team_id
          and captain_id = auth.uid()
      )
    )
  );

-- ── 5. deal_player RPC (atomic deal transaction) ──────────────────────────────
create or replace function deal_player(p_auction_player_id uuid)
returns void language plpgsql security definer as $$
declare
  v auction_players%rowtype;
begin
  select * into v from auction_players where id = p_auction_player_id;
  if v.leading_team_id is null then
    raise exception 'No leading team — cannot deal without a bid';
  end if;
  update auction_players
    set status = 'sold',
        sold_to_team_id = v.leading_team_id,
        sold_price = v.current_bid
    where id = p_auction_player_id;
  update auction_teams
    set budget_remaining = budget_remaining - v.current_bid,
        players_bought   = players_bought + 1
    where id = v.leading_team_id;
end;
$$;

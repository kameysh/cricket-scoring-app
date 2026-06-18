-- ============================================================
-- Cricket Scoring App — Initial Schema
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. players
-- ============================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  batting_style text,
  bowling_style text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. venues
-- ============================================================
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  country text not null,
  capacity int,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. tournaments
-- ============================================================
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('league','knockout','friendly')),
  venue_id uuid references venues(id),
  start_date date,
  end_date date,
  status text check (status in ('upcoming','ongoing','completed','cancelled')) default 'upcoming',
  is_deleted boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 4. tournament_players
-- ============================================================
create table tournament_players (
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  primary key (tournament_id, player_id)
);

-- ============================================================
-- 5. matches
-- ============================================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  team1_name text not null,
  team2_name text not null,
  joker_player_id uuid references players(id),
  total_overs int not null check (total_overs > 0),
  team_size int not null check (team_size >= 6 and team_size <= 11),
  max_overs_per_bowler int,
  last_man_standing boolean default false,
  venue_id uuid references venues(id),
  toss_winner text check (toss_winner in ('team1','team2')),
  toss_decision text check (toss_decision in ('bat','field')),
  status text check (status in ('upcoming','live','paused','completed','abandoned','no_result')) default 'upcoming',
  result_type text check (result_type in ('runs','wickets','tie','super_over','abandoned','no_result')),
  result_summary text,
  winning_team_name text,
  winning_margin int,
  man_of_match_id uuid references players(id),
  super_over_enabled boolean default false,
  powerplay_start int,
  powerplay_end int,
  created_at timestamptz default now()
);

-- ============================================================
-- 6. match_players
-- ============================================================
create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id),
  team int check (team in (1,2,0)),
  batting_position int,
  bowling_order int
);
create index idx_match_players_match_team on match_players(match_id, team);

-- ============================================================
-- 7. innings
-- ============================================================
create table innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  innings_number int check (innings_number in (1,2,3)),
  batting_team int check (batting_team in (1,2)),
  total_runs int default 0,
  total_wickets int default 0,
  total_legal_balls int default 0,
  target int,
  extras_wides int default 0,
  extras_no_balls int default 0,
  extras_byes int default 0,
  extras_leg_byes int default 0,
  extras_penalty_batting int default 0,
  extras_penalty_fielding int default 0,
  is_completed boolean default false,
  manually_ended boolean default false,
  end_reason text,
  created_at timestamptz default now()
);
create index idx_innings_match on innings(match_id);

-- ============================================================
-- 8. deliveries
-- ============================================================
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  over_number int not null,
  ball_number int not null,
  total_ball_sequence int not null,
  batsman_id uuid references players(id),
  bowler_id uuid references players(id),
  runs_off_bat int default 0,
  run_type text check (run_type in ('dot','one','two','three','four','five','six','other')) default 'dot',
  extra_type text check (extra_type in ('none','wide','no_ball','bye','leg_bye','penalty_batting','penalty_fielding')) default 'none',
  extra_runs int default 0,
  total_runs_on_delivery int not null,
  is_wicket boolean default false,
  wicket_type text,
  fielder_id uuid references players(id),
  batsman_out_id uuid references players(id),
  is_legal_delivery boolean default true,
  is_free_hit boolean default false,
  striker_before uuid references players(id),
  non_striker_before uuid references players(id),
  striker_after uuid references players(id),
  non_striker_after uuid references players(id),
  is_joker_batting boolean default false,
  is_joker_bowling boolean default false,
  created_at timestamptz default now()
);
create index idx_deliveries_innings_over_ball on deliveries(innings_id, over_number, ball_number);
create index idx_deliveries_batsman on deliveries(batsman_id);
create index idx_deliveries_bowler on deliveries(bowler_id);

-- ============================================================
-- 9. batting_scorecards
-- ============================================================
create table batting_scorecards (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  player_id uuid references players(id),
  team int check (team in (1,2,0)),
  runs int default 0,
  balls_faced int default 0,
  ones int default 0,
  twos int default 0,
  threes int default 0,
  fours int default 0,
  sixes int default 0,
  dot_balls int default 0,
  dismissal_type text,
  bowler_id uuid references players(id),
  fielder_id uuid references players(id),
  batting_position int,
  status text check (status in ('yet_to_bat','batting','out','not_out','retired_hurt','retired_out')) default 'yet_to_bat',
  is_joker boolean default false
);
create index idx_batting_scorecards_innings_player on batting_scorecards(innings_id, player_id);

-- ============================================================
-- 10. bowling_scorecards
-- ============================================================
create table bowling_scorecards (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  player_id uuid references players(id),
  team int check (team in (1,2,0)),
  legal_balls int default 0,
  overs_display text default '0.0',
  maidens int default 0,
  runs_conceded int default 0,
  wickets int default 0,
  wides int default 0,
  no_balls int default 0,
  is_joker boolean default false
);
create index idx_bowling_scorecards_innings_player on bowling_scorecards(innings_id, player_id);

-- ============================================================
-- 11. fielding_scorecards
-- ============================================================
create table fielding_scorecards (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  player_id uuid references players(id),
  team int check (team in (1,2,0)),
  catches int default 0,
  stumpings int default 0,
  run_outs int default 0,
  is_joker boolean default false
);
create index idx_fielding_scorecards_innings_player on fielding_scorecards(innings_id, player_id);

alter table batting_scorecards add constraint uq_batting_innings_player unique (innings_id, player_id);
alter table bowling_scorecards add constraint uq_bowling_innings_player unique (innings_id, player_id);
alter table fielding_scorecards add constraint uq_fielding_innings_player unique (innings_id, player_id);

-- ============================================================
-- 12. player_career_stats
-- ============================================================
create table player_career_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) unique,

  bat_matches int default 0,
  bat_innings int default 0,
  bat_not_outs int default 0,
  bat_runs int default 0,
  bat_balls int default 0,
  bat_highest_score int default 0,
  bat_highest_score_not_out boolean default false,
  bat_ones int default 0,
  bat_twos int default 0,
  bat_threes int default 0,
  bat_fours int default 0,
  bat_sixes int default 0,
  bat_dot_balls int default 0,
  bat_ducks int default 0,
  bat_fifties int default 0,
  bat_hundreds int default 0,

  bowl_matches int default 0,
  bowl_innings int default 0,
  bowl_legal_balls int default 0,
  bowl_runs int default 0,
  bowl_wickets int default 0,
  bowl_maidens int default 0,
  bowl_wides int default 0,
  bowl_no_balls int default 0,
  bowl_best_wickets int default 0,
  bowl_best_runs int default 0,
  bowl_four_wicket_hauls int default 0,
  bowl_five_wicket_hauls int default 0,

  field_matches int default 0,
  field_catches int default 0,
  field_stumpings int default 0,
  field_run_outs int default 0,

  updated_at timestamptz default now()
);

-- ============================================================
-- 13. player_tournament_stats
-- ============================================================
create table player_tournament_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  tournament_id uuid references tournaments(id),
  unique (player_id, tournament_id),

  bat_matches int default 0,
  bat_innings int default 0,
  bat_not_outs int default 0,
  bat_runs int default 0,
  bat_balls int default 0,
  bat_highest_score int default 0,
  bat_ones int default 0,
  bat_twos int default 0,
  bat_threes int default 0,
  bat_fours int default 0,
  bat_sixes int default 0,
  bat_dot_balls int default 0,
  bat_ducks int default 0,
  bat_fifties int default 0,
  bat_hundreds int default 0,

  bowl_matches int default 0,
  bowl_innings int default 0,
  bowl_legal_balls int default 0,
  bowl_runs int default 0,
  bowl_wickets int default 0,
  bowl_maidens int default 0,
  bowl_best_wickets int default 0,
  bowl_best_runs int default 0,
  bowl_four_wicket_hauls int default 0,
  bowl_five_wicket_hauls int default 0,

  field_catches int default 0,
  field_stumpings int default 0,
  field_run_outs int default 0,

  updated_at timestamptz default now()
);

-- ============================================================
-- 14. match_events
-- ============================================================
create table match_events (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  sequence_number int not null,
  event_type text default 'delivery',
  snapshot jsonb not null,
  delivery_id uuid references deliveries(id) on delete cascade,
  created_at timestamptz default now()
);
create index idx_match_events_innings_seq on match_events(innings_id, sequence_number desc);

-- ============================================================
-- RLS — open policies (single-tenant scorer app, no auth gating)
-- ============================================================
alter table players enable row level security;
alter table venues enable row level security;
alter table tournaments enable row level security;
alter table tournament_players enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table innings enable row level security;
alter table deliveries enable row level security;
alter table batting_scorecards enable row level security;
alter table bowling_scorecards enable row level security;
alter table fielding_scorecards enable row level security;
alter table player_career_stats enable row level security;
alter table player_tournament_stats enable row level security;
alter table match_events enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'players','venues','tournaments','tournament_players','matches','match_players',
    'innings','deliveries','batting_scorecards','bowling_scorecards','fielding_scorecards',
    'player_career_stats','player_tournament_stats','match_events'
  ])
  loop
    execute format('create policy "allow_all_%s" on %I for all using (true) with check (true);', t, t);
  end loop;
end $$;

-- ============================================================
-- RPC: record_delivery — atomic write of a single ball
-- ============================================================
create or replace function record_delivery(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_delivery_id uuid;
  v_innings_id uuid := (payload->>'innings_id')::uuid;
  v_batsman uuid := (payload->>'batsman_id')::uuid;
  v_bowler uuid := (payload->>'bowler_id')::uuid;
  v_runs_off_bat int := coalesce((payload->>'runs_off_bat')::int, 0);
  v_run_type text := coalesce(payload->>'run_type', 'dot');
  v_extra_type text := coalesce(payload->>'extra_type', 'none');
  v_extra_runs int := coalesce((payload->>'extra_runs')::int, 0);
  v_total_runs int := coalesce((payload->>'total_runs_on_delivery')::int, 0);
  v_is_legal boolean := coalesce((payload->>'is_legal_delivery')::boolean, true);
  v_is_wicket boolean := coalesce((payload->>'is_wicket')::boolean, false);
  v_team int := coalesce((payload->>'batting_team')::int, 1);
  v_bowling_team int := coalesce((payload->>'bowling_team')::int, 2);
  v_seq int;
  v_innings record;
begin
  select coalesce(max(total_ball_sequence), 0) + 1 into v_seq from deliveries where innings_id = v_innings_id;

  insert into deliveries (
    innings_id, over_number, ball_number, total_ball_sequence,
    batsman_id, bowler_id, runs_off_bat, run_type, extra_type, extra_runs,
    total_runs_on_delivery, is_wicket, wicket_type, fielder_id, batsman_out_id,
    is_legal_delivery, is_free_hit, striker_before, non_striker_before,
    striker_after, non_striker_after, is_joker_batting, is_joker_bowling
  ) values (
    v_innings_id,
    (payload->>'over_number')::int, (payload->>'ball_number')::int, v_seq,
    v_batsman, v_bowler, v_runs_off_bat, v_run_type, v_extra_type, v_extra_runs,
    v_total_runs, v_is_wicket, payload->>'wicket_type',
    (payload->>'fielder_id')::uuid, (payload->>'batsman_out_id')::uuid,
    v_is_legal, coalesce((payload->>'is_free_hit')::boolean, false),
    (payload->>'striker_before')::uuid, (payload->>'non_striker_before')::uuid,
    (payload->>'striker_after')::uuid, (payload->>'non_striker_after')::uuid,
    coalesce((payload->>'is_joker_batting')::boolean, false),
    coalesce((payload->>'is_joker_bowling')::boolean, false)
  ) returning id into v_delivery_id;

  -- update innings totals
  update innings set
    total_runs = total_runs + v_total_runs,
    total_wickets = total_wickets + (case when v_is_wicket then 1 else 0 end),
    total_legal_balls = total_legal_balls + (case when v_is_legal then 1 else 0 end),
    extras_wides = extras_wides + (case when v_extra_type = 'wide' then v_extra_runs else 0 end),
    extras_no_balls = extras_no_balls + (case when v_extra_type = 'no_ball' then v_extra_runs else 0 end),
    extras_byes = extras_byes + (case when v_extra_type = 'bye' then v_extra_runs else 0 end),
    extras_leg_byes = extras_leg_byes + (case when v_extra_type = 'leg_bye' then v_extra_runs else 0 end),
    extras_penalty_batting = extras_penalty_batting + (case when v_extra_type = 'penalty_batting' then v_extra_runs else 0 end),
    extras_penalty_fielding = extras_penalty_fielding + (case when v_extra_type = 'penalty_fielding' then v_extra_runs else 0 end)
  where id = v_innings_id;

  -- upsert batting scorecard
  insert into batting_scorecards (innings_id, player_id, team, runs, balls_faced, ones, twos, threes, fours, sixes, dot_balls, status)
  values (v_innings_id, v_batsman, v_team, v_runs_off_bat,
    (case when v_extra_type not in ('wide') then 1 else 0 end),
    (case when v_run_type = 'one' then 1 else 0 end),
    (case when v_run_type = 'two' then 1 else 0 end),
    (case when v_run_type = 'three' then 1 else 0 end),
    (case when v_run_type = 'four' then 1 else 0 end),
    (case when v_run_type = 'six' then 1 else 0 end),
    (case when v_run_type = 'dot' and v_extra_type not in ('wide') then 1 else 0 end),
    'batting')
  on conflict (innings_id, player_id) do nothing;

  update batting_scorecards set
    runs = runs + v_runs_off_bat,
    balls_faced = balls_faced + (case when v_extra_type not in ('wide') then 1 else 0 end),
    ones = ones + (case when v_run_type = 'one' then 1 else 0 end),
    twos = twos + (case when v_run_type = 'two' then 1 else 0 end),
    threes = threes + (case when v_run_type = 'three' then 1 else 0 end),
    fours = fours + (case when v_run_type = 'four' then 1 else 0 end),
    sixes = sixes + (case when v_run_type = 'six' then 1 else 0 end),
    dot_balls = dot_balls + (case when v_run_type = 'dot' and v_extra_type not in ('wide') then 1 else 0 end),
    status = 'batting'
  where innings_id = v_innings_id and player_id = v_batsman;

  if v_is_wicket then
    update batting_scorecards set
      status = case when payload->>'wicket_type' in ('retired_hurt') then 'retired_hurt'
                     when payload->>'wicket_type' = 'retired_out' then 'retired_out'
                     else 'out' end,
      dismissal_type = payload->>'wicket_type',
      bowler_id = case when (payload->>'wicket_type') in ('bowled','caught','lbw','stumped','hit_wicket') then v_bowler else bowler_id end,
      fielder_id = (payload->>'fielder_id')::uuid
    where innings_id = v_innings_id and player_id = coalesce((payload->>'batsman_out_id')::uuid, v_batsman);
  end if;

  -- upsert bowling scorecard
  insert into bowling_scorecards (innings_id, player_id, team, legal_balls, runs_conceded, wickets, wides, no_balls)
  values (v_innings_id, v_bowler, v_bowling_team,
    (case when v_is_legal then 1 else 0 end),
    v_total_runs - (case when v_extra_type in ('bye','leg_bye') then v_extra_runs else 0 end),
    (case when v_is_wicket and (payload->>'wicket_type') in ('bowled','caught','lbw','stumped','hit_wicket') then 1 else 0 end),
    (case when v_extra_type = 'wide' then v_extra_runs else 0 end),
    (case when v_extra_type = 'no_ball' then v_extra_runs else 0 end))
  on conflict (innings_id, player_id) do nothing;

  update bowling_scorecards set
    legal_balls = legal_balls + (case when v_is_legal then 1 else 0 end),
    runs_conceded = runs_conceded + (v_total_runs - (case when v_extra_type in ('bye','leg_bye') then v_extra_runs else 0 end)),
    wickets = wickets + (case when v_is_wicket and (payload->>'wicket_type') in ('bowled','caught','lbw','stumped','hit_wicket') then 1 else 0 end),
    wides = wides + (case when v_extra_type = 'wide' then v_extra_runs else 0 end),
    no_balls = no_balls + (case when v_extra_type = 'no_ball' then v_extra_runs else 0 end),
    overs_display = (legal_balls + (case when v_is_legal then 1 else 0 end)) / 6 || '.' || (legal_balls + (case when v_is_legal then 1 else 0 end)) % 6
  where innings_id = v_innings_id and player_id = v_bowler;

  -- fielding scorecard
  if v_is_wicket and (payload->>'fielder_id') is not null then
    insert into fielding_scorecards (innings_id, player_id, team, catches, stumpings, run_outs)
    values (v_innings_id, (payload->>'fielder_id')::uuid, v_bowling_team,
      (case when payload->>'wicket_type' = 'caught' then 1 else 0 end),
      (case when payload->>'wicket_type' = 'stumped' then 1 else 0 end),
      (case when payload->>'wicket_type' = 'run_out' then 1 else 0 end))
    on conflict (innings_id, player_id) do nothing;

    update fielding_scorecards set
      catches = catches + (case when payload->>'wicket_type' = 'caught' then 1 else 0 end),
      stumpings = stumpings + (case when payload->>'wicket_type' = 'stumped' then 1 else 0 end),
      run_outs = run_outs + (case when payload->>'wicket_type' = 'run_out' then 1 else 0 end)
    where innings_id = v_innings_id and player_id = (payload->>'fielder_id')::uuid;
  end if;

  -- snapshot for undo
  insert into match_events (innings_id, sequence_number, event_type, snapshot, delivery_id)
  values (v_innings_id, v_seq, 'delivery', payload, v_delivery_id);

  select * into v_innings from innings where id = v_innings_id;

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'innings', row_to_json(v_innings)
  );
end;
$$;

-- ============================================================
-- RPC: update_player_career_stats — recompute aggregates after an innings completes
-- ============================================================
create or replace function update_player_career_stats(p_innings_id uuid)
returns void
language plpgsql
as $$
declare
  v_match_id uuid;
  v_tournament_id uuid;
  b record;
  bw record;
  f record;
begin
  select match_id into v_match_id from innings where id = p_innings_id;
  select tournament_id into v_tournament_id from matches where id = v_match_id;

  for b in select * from batting_scorecards where innings_id = p_innings_id and status != 'yet_to_bat' loop
    insert into player_career_stats (player_id) values (b.player_id)
      on conflict (player_id) do nothing;

    update player_career_stats set
      bat_matches = bat_matches + 1,
      bat_innings = bat_innings + 1,
      bat_not_outs = bat_not_outs + (case when b.status in ('not_out','retired_hurt') then 1 else 0 end),
      bat_runs = bat_runs + b.runs,
      bat_balls = bat_balls + b.balls_faced,
      bat_highest_score = greatest(bat_highest_score, b.runs),
      bat_highest_score_not_out = (case when b.runs >= bat_highest_score and b.status in ('not_out','retired_hurt') then true
                                         when b.runs > bat_highest_score then false else bat_highest_score_not_out end),
      bat_ones = bat_ones + b.ones,
      bat_twos = bat_twos + b.twos,
      bat_threes = bat_threes + b.threes,
      bat_fours = bat_fours + b.fours,
      bat_sixes = bat_sixes + b.sixes,
      bat_dot_balls = bat_dot_balls + b.dot_balls,
      bat_ducks = bat_ducks + (case when b.runs = 0 and b.status = 'out' then 1 else 0 end),
      bat_fifties = bat_fifties + (case when b.runs >= 50 and b.runs < 100 then 1 else 0 end),
      bat_hundreds = bat_hundreds + (case when b.runs >= 100 then 1 else 0 end),
      updated_at = now()
    where player_id = b.player_id;

    if v_tournament_id is not null then
      insert into player_tournament_stats (player_id, tournament_id) values (b.player_id, v_tournament_id)
        on conflict (player_id, tournament_id) do nothing;
      update player_tournament_stats set
        bat_matches = bat_matches + 1,
        bat_innings = bat_innings + 1,
        bat_not_outs = bat_not_outs + (case when b.status in ('not_out','retired_hurt') then 1 else 0 end),
        bat_runs = bat_runs + b.runs,
        bat_balls = bat_balls + b.balls_faced,
        bat_highest_score = greatest(bat_highest_score, b.runs),
        bat_ones = bat_ones + b.ones,
        bat_twos = bat_twos + b.twos,
        bat_threes = bat_threes + b.threes,
        bat_fours = bat_fours + b.fours,
        bat_sixes = bat_sixes + b.sixes,
        bat_dot_balls = bat_dot_balls + b.dot_balls,
        bat_ducks = bat_ducks + (case when b.runs = 0 and b.status = 'out' then 1 else 0 end),
        bat_fifties = bat_fifties + (case when b.runs >= 50 and b.runs < 100 then 1 else 0 end),
        bat_hundreds = bat_hundreds + (case when b.runs >= 100 then 1 else 0 end),
        updated_at = now()
      where player_id = b.player_id and tournament_id = v_tournament_id;
    end if;
  end loop;

  for bw in select * from bowling_scorecards where innings_id = p_innings_id and legal_balls > 0 loop
    insert into player_career_stats (player_id) values (bw.player_id)
      on conflict (player_id) do nothing;

    update player_career_stats set
      bowl_matches = bowl_matches + 1,
      bowl_innings = bowl_innings + 1,
      bowl_legal_balls = bowl_legal_balls + bw.legal_balls,
      bowl_runs = bowl_runs + bw.runs_conceded,
      bowl_wickets = bowl_wickets + bw.wickets,
      bowl_maidens = bowl_maidens + bw.maidens,
      bowl_wides = bowl_wides + bw.wides,
      bowl_no_balls = bowl_no_balls + bw.no_balls,
      bowl_four_wicket_hauls = bowl_four_wicket_hauls + (case when bw.wickets = 4 then 1 else 0 end),
      bowl_five_wicket_hauls = bowl_five_wicket_hauls + (case when bw.wickets >= 5 then 1 else 0 end),
      bowl_best_wickets = (case when bw.wickets > bowl_best_wickets or (bw.wickets = bowl_best_wickets and bw.runs_conceded < bowl_best_runs) then bw.wickets else bowl_best_wickets end),
      bowl_best_runs = (case when bw.wickets > bowl_best_wickets or (bw.wickets = bowl_best_wickets and bw.runs_conceded < bowl_best_runs) then bw.runs_conceded else bowl_best_runs end),
      updated_at = now()
    where player_id = bw.player_id;

    if v_tournament_id is not null then
      insert into player_tournament_stats (player_id, tournament_id) values (bw.player_id, v_tournament_id)
        on conflict (player_id, tournament_id) do nothing;
      update player_tournament_stats set
        bowl_matches = bowl_matches + 1,
        bowl_innings = bowl_innings + 1,
        bowl_legal_balls = bowl_legal_balls + bw.legal_balls,
        bowl_runs = bowl_runs + bw.runs_conceded,
        bowl_wickets = bowl_wickets + bw.wickets,
        bowl_maidens = bowl_maidens + bw.maidens,
        bowl_four_wicket_hauls = bowl_four_wicket_hauls + (case when bw.wickets = 4 then 1 else 0 end),
        bowl_five_wicket_hauls = bowl_five_wicket_hauls + (case when bw.wickets >= 5 then 1 else 0 end),
        bowl_best_wickets = (case when bw.wickets > bowl_best_wickets or (bw.wickets = bowl_best_wickets and bw.runs_conceded < bowl_best_runs) then bw.wickets else bowl_best_wickets end),
        bowl_best_runs = (case when bw.wickets > bowl_best_wickets or (bw.wickets = bowl_best_wickets and bw.runs_conceded < bowl_best_runs) then bw.runs_conceded else bowl_best_runs end),
        updated_at = now()
      where player_id = bw.player_id and tournament_id = v_tournament_id;
    end if;
  end loop;

  for f in select * from fielding_scorecards where innings_id = p_innings_id and (catches + stumpings + run_outs) > 0 loop
    insert into player_career_stats (player_id) values (f.player_id)
      on conflict (player_id) do nothing;

    update player_career_stats set
      field_matches = field_matches + 1,
      field_catches = field_catches + f.catches,
      field_stumpings = field_stumpings + f.stumpings,
      field_run_outs = field_run_outs + f.run_outs,
      updated_at = now()
    where player_id = f.player_id;

    if v_tournament_id is not null then
      insert into player_tournament_stats (player_id, tournament_id) values (f.player_id, v_tournament_id)
        on conflict (player_id, tournament_id) do nothing;
      update player_tournament_stats set
        field_catches = field_catches + f.catches,
        field_stumpings = field_stumpings + f.stumpings,
        field_run_outs = field_run_outs + f.run_outs,
        updated_at = now()
      where player_id = f.player_id and tournament_id = v_tournament_id;
    end if;
  end loop;
end;
$$;

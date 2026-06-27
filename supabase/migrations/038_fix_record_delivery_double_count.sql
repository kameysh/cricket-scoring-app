-- 038_fix_record_delivery_double_count.sql
-- ROOT-CAUSE FIX for scorecard drift.
--
-- Bug: record_delivery did `INSERT ... ON CONFLICT DO NOTHING` seeding the new
-- batting/bowling/fielding row with the FIRST ball's values, then ran an
-- UNCONDITIONAL `UPDATE ... = col + value`. On a player's first ball the row was
-- both seeded AND updated, so the first ball was counted TWICE:
--   • every batsman: +1 ball_faced and + (first-ball runs)
--   • every bowler:  +1 legal_ball, + (first-ball runs_conceded), +1 wicket if first ball was a wicket
--   • every fielder: their first catch/stumping/run-out doubled
-- This is why the stored scorecards drifted from the deliveries (e.g. Viki 25/9 vs 19/8).
--
-- Fix: seed the INSERT with ZEROS so only the UPDATE counts. The deliveries log and
-- innings totals were always correct (they don't use the seed-then-update pattern).

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

  -- upsert batting scorecard — SEED WITH ZEROS, the UPDATE below does all counting
  insert into batting_scorecards (innings_id, player_id, team, runs, balls_faced, ones, twos, threes, fours, sixes, dot_balls, status)
  values (v_innings_id, v_batsman, v_team, 0, 0, 0, 0, 0, 0, 0, 0, 'batting')
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

  -- upsert bowling scorecard — SEED WITH ZEROS
  insert into bowling_scorecards (innings_id, player_id, team, legal_balls, runs_conceded, wickets, wides, no_balls)
  values (v_innings_id, v_bowler, v_bowling_team, 0, 0, 0, 0, 0)
  on conflict (innings_id, player_id) do nothing;

  update bowling_scorecards set
    legal_balls = legal_balls + (case when v_is_legal then 1 else 0 end),
    runs_conceded = runs_conceded + (v_total_runs - (case when v_extra_type in ('bye','leg_bye') then v_extra_runs else 0 end)),
    wickets = wickets + (case when v_is_wicket and (payload->>'wicket_type') in ('bowled','caught','lbw','stumped','hit_wicket') then 1 else 0 end),
    wides = wides + (case when v_extra_type = 'wide' then v_extra_runs else 0 end),
    no_balls = no_balls + (case when v_extra_type = 'no_ball' then v_extra_runs else 0 end),
    overs_display = (legal_balls + (case when v_is_legal then 1 else 0 end)) / 6 || '.' || (legal_balls + (case when v_is_legal then 1 else 0 end)) % 6
  where innings_id = v_innings_id and player_id = v_bowler;

  -- fielding scorecard — SEED WITH ZEROS
  if v_is_wicket and (payload->>'fielder_id') is not null then
    insert into fielding_scorecards (innings_id, player_id, team, catches, stumpings, run_outs)
    values (v_innings_id, (payload->>'fielder_id')::uuid, v_bowling_team, 0, 0, 0)
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

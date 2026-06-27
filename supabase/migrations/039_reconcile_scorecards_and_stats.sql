-- 039_reconcile_scorecards_and_stats.sql
-- ONE-TIME DATA CORRECTION for the double-count bug fixed in 038.
--
-- ⚠️  RUN MIGRATION 038 FIRST, and take a DB backup/snapshot before running this.
-- ⚠️  This is a deliberate one-shot reconciliation. It overwrites the stored
--     scorecard aggregates from the (correct) ball-by-ball deliveries, then fully
--     rebuilds player_career_stats / player_tournament_stats by replaying the
--     existing aggregation RPC over every completed innings. Idempotent: safe to
--     re-run (it recomputes from deliveries, never increments blindly).
--
-- Deliveries + innings totals were always correct (they never used the buggy
-- seed-then-update pattern), so they are the source of truth here.

-- ── Part 1: recompute the *_scorecards aggregates from deliveries ───────────────

-- Batting: runs/balls/boundaries/dots from the ball log (run_type mirrors the RPC's
-- counting; a wide is not a ball faced). status/dismissal/bowler/fielder are left
-- as-is (they were set correctly on the wicket ball).
update batting_scorecards bs set
  runs       = d.runs,
  balls_faced= d.balls,
  ones       = d.ones,
  twos       = d.twos,
  threes     = d.threes,
  fours      = d.fours,
  sixes      = d.sixes,
  dot_balls  = d.dots
from (
  select innings_id, batsman_id,
    sum(runs_off_bat)                                                          as runs,
    sum(case when extra_type <> 'wide' then 1 else 0 end)                      as balls,
    sum(case when run_type = 'one' then 1 else 0 end)                          as ones,
    sum(case when run_type = 'two' then 1 else 0 end)                          as twos,
    sum(case when run_type = 'three' then 1 else 0 end)                        as threes,
    sum(case when run_type = 'four' then 1 else 0 end)                         as fours,
    sum(case when run_type = 'six' then 1 else 0 end)                          as sixes,
    sum(case when run_type = 'dot' and extra_type <> 'wide' then 1 else 0 end) as dots
  from deliveries
  group by innings_id, batsman_id
) d
where bs.innings_id = d.innings_id and bs.player_id = d.batsman_id;

-- Bowling: legal balls / runs conceded (byes & leg-byes excluded) / wickets / extras
update bowling_scorecards bw set
  legal_balls   = d.legal,
  runs_conceded = d.runs,
  wickets       = d.wkts,
  wides         = d.wides,
  no_balls      = d.nb,
  overs_display = (d.legal / 6) || '.' || (d.legal % 6)
from (
  select innings_id, bowler_id,
    sum(case when is_legal_delivery then 1 else 0 end)                                                            as legal,
    sum(total_runs_on_delivery - (case when extra_type in ('bye','leg_bye') then extra_runs else 0 end))          as runs,
    sum(case when is_wicket and wicket_type in ('bowled','caught','lbw','stumped','hit_wicket') then 1 else 0 end) as wkts,
    sum(case when extra_type = 'wide'    then extra_runs else 0 end)                                              as wides,
    sum(case when extra_type = 'no_ball' then extra_runs else 0 end)                                             as nb
  from deliveries
  group by innings_id, bowler_id
) d
where bw.innings_id = d.innings_id and bw.player_id = d.bowler_id;

-- Fielding: catches / stumpings / run-outs credited to the fielder
update fielding_scorecards fs set
  catches   = d.c,
  stumpings = d.s,
  run_outs  = d.r
from (
  select innings_id, fielder_id,
    sum(case when wicket_type = 'caught'  then 1 else 0 end) as c,
    sum(case when wicket_type = 'stumped' then 1 else 0 end) as s,
    sum(case when wicket_type = 'run_out' then 1 else 0 end) as r
  from deliveries
  where is_wicket and fielder_id is not null
  group by innings_id, fielder_id
) d
where fs.innings_id = d.innings_id and fs.player_id = d.fielder_id;

-- ── Part 2: rebuild career + tournament stats from the corrected scorecards ──────
do $$
declare
  r record;
begin
  -- Preserve live-only counters the replay does not reconstruct:
  --   bowl_hat_tricks (incremented client-side during scoring)
  create temp table _preserve_ht on commit drop as
    select player_id, bowl_hat_tricks from player_career_stats where bowl_hat_tricks > 0;

  -- Wipe the aggregates (leaf tables — nothing references them)
  delete from player_tournament_stats;
  delete from player_career_stats;

  -- Replay the authoritative per-innings aggregation over every completed innings,
  -- in chronological order (so MAX-based fields like highest score rebuild correctly).
  for r in
    select i.id
    from innings i
    join matches m on m.id = i.match_id
    where i.is_completed = true
    order by i.match_id, i.innings_number
  loop
    perform update_player_career_stats(r.id);
  end loop;

  -- Squad-participation counter (one per completed match, all squad members)
  for r in select id from matches where status = 'completed' loop
    perform increment_matches_played(r.id);
  end loop;

  -- Restore preserved hat-trick counts
  update player_career_stats cs
    set bowl_hat_tricks = p.bowl_hat_tricks
    from _preserve_ht p
    where cs.player_id = p.player_id;
end $$;

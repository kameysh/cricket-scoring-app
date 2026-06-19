-- Migration 016: Add bat_thirties column and update RPC
-- Run manually in Supabase SQL Editor

ALTER TABLE player_career_stats
  ADD COLUMN IF NOT EXISTS bat_thirties int not null default 0;

ALTER TABLE player_tournament_stats
  ADD COLUMN IF NOT EXISTS bat_thirties int not null default 0;

-- Recreate RPC to also count innings of 30–49 runs
CREATE OR REPLACE FUNCTION update_player_career_stats(p_innings_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
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
      bat_matches  = bat_matches + 1,
      bat_innings  = bat_innings + 1,
      bat_not_outs = bat_not_outs + (case when b.status in ('not_out','retired_hurt') then 1 else 0 end),
      bat_runs     = bat_runs + b.runs,
      bat_balls    = bat_balls + b.balls_faced,
      bat_highest_score = greatest(bat_highest_score, b.runs),
      bat_highest_score_not_out = (case when b.runs >= bat_highest_score and b.status in ('not_out','retired_hurt') then true
                                        when b.runs > bat_highest_score then false else bat_highest_score_not_out end),
      bat_ones      = bat_ones  + b.ones,
      bat_twos      = bat_twos  + b.twos,
      bat_threes    = bat_threes + b.threes,
      bat_fours     = bat_fours + b.fours,
      bat_sixes     = bat_sixes + b.sixes,
      bat_dot_balls = bat_dot_balls + b.dot_balls,
      bat_ducks     = bat_ducks    + (case when b.runs = 0 and b.status = 'out' then 1 else 0 end),
      bat_thirties  = bat_thirties + (case when b.runs >= 30 and b.runs < 50 then 1 else 0 end),
      bat_fifties   = bat_fifties  + (case when b.runs >= 50 and b.runs < 100 then 1 else 0 end),
      bat_hundreds  = bat_hundreds + (case when b.runs >= 100 then 1 else 0 end),
      updated_at    = now()
    where player_id = b.player_id;

    if v_tournament_id is not null then
      insert into player_tournament_stats (player_id, tournament_id) values (b.player_id, v_tournament_id)
        on conflict (player_id, tournament_id) do nothing;
      update player_tournament_stats set
        bat_matches  = bat_matches + 1,
        bat_innings  = bat_innings + 1,
        bat_not_outs = bat_not_outs + (case when b.status in ('not_out','retired_hurt') then 1 else 0 end),
        bat_runs     = bat_runs + b.runs,
        bat_balls    = bat_balls + b.balls_faced,
        bat_highest_score = greatest(bat_highest_score, b.runs),
        bat_ones      = bat_ones  + b.ones,
        bat_twos      = bat_twos  + b.twos,
        bat_threes    = bat_threes + b.threes,
        bat_fours     = bat_fours + b.fours,
        bat_sixes     = bat_sixes + b.sixes,
        bat_dot_balls = bat_dot_balls + b.dot_balls,
        bat_ducks     = bat_ducks    + (case when b.runs = 0 and b.status = 'out' then 1 else 0 end),
        bat_thirties  = bat_thirties + (case when b.runs >= 30 and b.runs < 50 then 1 else 0 end),
        bat_fifties   = bat_fifties  + (case when b.runs >= 50 and b.runs < 100 then 1 else 0 end),
        bat_hundreds  = bat_hundreds + (case when b.runs >= 100 then 1 else 0 end),
        updated_at    = now()
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

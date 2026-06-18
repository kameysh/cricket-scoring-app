import { supabase } from '../lib/supabase';
import { deriveRunType, applyStrikerSwap, calcWinByRuns, calcWinByWickets } from '../lib/cricketUtils';

/**
 * Record a single delivery atomically via the record_delivery RPC.
 * params: {
 *   innings_id, over_number, ball_number, batsman_id, bowler_id,
 *   runs_off_bat, extra_type, extra_runs, is_wicket, wicket_type,
 *   fielder_id, batsman_out_id, is_free_hit,
 *   striker_before, non_striker_before, batting_team, bowling_team, end_of_over
 * }
 */
export async function recordDelivery(params) {
  const isWide = params.extra_type === 'wide';
  const isNoBall = params.extra_type === 'no_ball';
  const isLegal = !isWide && !isNoBall;
  const runsOffBat = params.runs_off_bat || 0;
  const extraRuns = params.extra_runs || 0;
  const totalRuns = runsOffBat + extraRuns;
  const runType = deriveRunType(runsOffBat);

  const swap = applyStrikerSwap(runsOffBat, params.extra_type, extraRuns, false);
  const strikerAfter = swap ? params.non_striker_before : params.striker_before;
  const nonStrikerAfter = swap ? params.striker_before : params.non_striker_before;

  const payload = {
    innings_id: params.innings_id,
    over_number: params.over_number,
    ball_number: params.ball_number,
    batsman_id: params.batsman_id,
    bowler_id: params.bowler_id,
    runs_off_bat: runsOffBat,
    run_type: runType,
    extra_type: params.extra_type || 'none',
    extra_runs: extraRuns,
    total_runs_on_delivery: totalRuns,
    is_wicket: !!params.is_wicket,
    wicket_type: params.wicket_type || null,
    fielder_id: params.fielder_id || null,
    batsman_out_id: params.batsman_out_id || params.batsman_id,
    is_legal_delivery: isLegal,
    is_free_hit: !!params.is_free_hit,
    striker_before: params.striker_before,
    non_striker_before: params.non_striker_before,
    striker_after: params.is_wicket ? params.striker_before : strikerAfter,
    non_striker_after: params.is_wicket ? params.non_striker_before : nonStrikerAfter,
    is_joker_batting: !!params.is_joker_batting,
    is_joker_bowling: !!params.is_joker_bowling,
    batting_team: params.batting_team,
    bowling_team: params.bowling_team,
  };

  const { data, error } = await supabase.rpc('record_delivery', { payload });
  if (error) throw error;
  return { ...data, swap, isLegal };
}

export async function finalizeOver(inningsId, overNumber, bowlerId) {
  const { data: balls, error } = await supabase
    .from('deliveries')
    .select('runs_off_bat, extra_type, extra_runs, is_legal_delivery')
    .eq('innings_id', inningsId)
    .eq('over_number', overNumber)
    .eq('bowler_id', bowlerId);
  if (error) throw error;

  const legalBalls = balls.filter(b => b.is_legal_delivery);
  if (legalBalls.length < 6) return false;

  const runsConcededThisOver = balls.reduce((sum, b) => {
    if (b.extra_type === 'bye' || b.extra_type === 'leg_bye') return sum;
    return sum + (b.runs_off_bat || 0) + (b.extra_type === 'wide' || b.extra_type === 'no_ball' ? b.extra_runs || 0 : 0);
  }, 0);

  const isMaiden = runsConcededThisOver === 0;
  if (isMaiden) {
    const { data: bowlerCard } = await supabase
      .from('bowling_scorecards')
      .select('id, maidens')
      .eq('innings_id', inningsId)
      .eq('player_id', bowlerId)
      .single();
    if (bowlerCard) {
      await supabase.from('bowling_scorecards').update({ maidens: (bowlerCard.maidens || 0) + 1 }).eq('id', bowlerCard.id);
    }
  }
  return isMaiden;
}

/**
 * Check win condition after a delivery is recorded.
 * Returns { won: bool, winner, margin, type, lastBall } or null.
 */
export function checkWinCondition({ inningsNumber, team1Total, team2Total, team1Name, team2Name, teamSize, wicketsFallen, ballsRemaining, isAllOut, oversCompleted }) {
  if (inningsNumber !== 2) return null;

  if (team2Total > team1Total) {
    const margin = calcWinByWickets(teamSize, wicketsFallen);
    return {
      won: true,
      winner: team2Name,
      margin,
      type: 'wickets',
      lastBall: ballsRemaining === 0,
      summary: `${team2Name} won by ${margin} wicket(s)${ballsRemaining === 0 ? ' — off the last ball!' : ''}`,
    };
  }

  if (isAllOut || oversCompleted) {
    if (team2Total < team1Total) {
      const margin = calcWinByRuns(team1Total, team2Total);
      return {
        won: true,
        winner: team1Name,
        margin,
        type: 'runs',
        summary: `${team1Name} won by ${margin} run(s)`,
      };
    }
    if (team2Total === team1Total) {
      return { won: true, winner: null, margin: 0, type: 'tie', summary: 'Match tied' };
    }
  }

  return null;
}

/**
 * Undo the most recent delivery in an innings by deleting it and
 * recomputing all scorecards/innings totals from the remaining deliveries.
 * This is more robust than inverse-arithmetic and guarantees consistency.
 */
export async function undoLastDelivery(inningsId) {
  const { data: last, error: lastErr } = await supabase
    .from('deliveries')
    .select('*')
    .eq('innings_id', inningsId)
    .order('total_ball_sequence', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw lastErr;
  if (!last) return null;

  const innings = await supabase.from('innings').select('*').eq('id', inningsId).single();
  const wasInningsCompleted = innings.data?.is_completed;

  await supabase.from('match_events').delete().eq('delivery_id', last.id);
  await supabase.from('deliveries').delete().eq('id', last.id);

  await recomputeInnings(inningsId);

  if (wasInningsCompleted) {
    await supabase.from('innings').update({ is_completed: false, manually_ended: false, end_reason: null }).eq('id', inningsId);
    await supabase.rpc('update_player_career_stats', { p_innings_id: inningsId }); // safe no-op recompute guard handled by caller resetting stats externally if needed
  }

  return last;
}

/**
 * Rebuild innings totals + batting/bowling/fielding scorecards from the
 * deliveries table. Used after undo to guarantee consistency.
 */
export async function recomputeInnings(inningsId) {
  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('innings_id', inningsId)
    .order('total_ball_sequence');
  if (error) throw error;

  await Promise.all([
    supabase.from('batting_scorecards').delete().eq('innings_id', inningsId),
    supabase.from('bowling_scorecards').delete().eq('innings_id', inningsId),
    supabase.from('fielding_scorecards').delete().eq('innings_id', inningsId),
  ]);

  const battingMap = new Map();
  const bowlingMap = new Map();
  const fieldingMap = new Map();
  let totals = {
    total_runs: 0, total_wickets: 0, total_legal_balls: 0,
    extras_wides: 0, extras_no_balls: 0, extras_byes: 0, extras_leg_byes: 0,
    extras_penalty_batting: 0, extras_penalty_fielding: 0,
  };

  const overGroups = new Map();

  for (const d of deliveries) {
    totals.total_runs += d.total_runs_on_delivery;
    if (d.is_wicket) totals.total_wickets += 1;
    if (d.is_legal_delivery) totals.total_legal_balls += 1;
    if (d.extra_type === 'wide') totals.extras_wides += d.extra_runs;
    if (d.extra_type === 'no_ball') totals.extras_no_balls += d.extra_runs;
    if (d.extra_type === 'bye') totals.extras_byes += d.extra_runs;
    if (d.extra_type === 'leg_bye') totals.extras_leg_byes += d.extra_runs;
    if (d.extra_type === 'penalty_batting') totals.extras_penalty_batting += d.extra_runs;
    if (d.extra_type === 'penalty_fielding') totals.extras_penalty_fielding += d.extra_runs;

    if (!battingMap.has(d.batsman_id)) {
      battingMap.set(d.batsman_id, {
        innings_id: inningsId, player_id: d.batsman_id, team: d.is_joker_batting ? 0 : null,
        runs: 0, balls_faced: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, dot_balls: 0,
        status: 'batting', is_joker: d.is_joker_batting, batting_position: null,
      });
    }
    const bs = battingMap.get(d.batsman_id);
    if (d.extra_type !== 'wide') {
      bs.balls_faced += 1;
      if (d.run_type === 'dot') bs.dot_balls += 1;
    }
    bs.runs += d.runs_off_bat;
    if (d.run_type === 'one') bs.ones += 1;
    if (d.run_type === 'two') bs.twos += 1;
    if (d.run_type === 'three') bs.threes += 1;
    if (d.run_type === 'four') bs.fours += 1;
    if (d.run_type === 'six') bs.sixes += 1;
    bs.status = 'batting';

    if (d.is_wicket) {
      const outId = d.batsman_out_id || d.batsman_id;
      if (!battingMap.has(outId)) {
        battingMap.set(outId, {
          innings_id: inningsId, player_id: outId, team: null,
          runs: 0, balls_faced: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, dot_balls: 0,
          status: 'out', is_joker: false, batting_position: null,
        });
      }
      const outRow = battingMap.get(outId);
      outRow.status = d.wicket_type === 'retired_hurt' ? 'retired_hurt' : d.wicket_type === 'retired_out' ? 'retired_out' : 'out';
      outRow.dismissal_type = d.wicket_type;
      if (['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type)) outRow.bowler_id = d.bowler_id;
      outRow.fielder_id = d.fielder_id;
    }

    if (!bowlingMap.has(d.bowler_id)) {
      bowlingMap.set(d.bowler_id, {
        innings_id: inningsId, player_id: d.bowler_id, team: d.is_joker_bowling ? 0 : null,
        legal_balls: 0, maidens: 0, runs_conceded: 0, wickets: 0, wides: 0, no_balls: 0, is_joker: d.is_joker_bowling,
      });
    }
    const bw = bowlingMap.get(d.bowler_id);
    if (d.is_legal_delivery) bw.legal_balls += 1;
    const bowlerRuns = (d.extra_type === 'bye' || d.extra_type === 'leg_bye') ? 0 : d.total_runs_on_delivery;
    bw.runs_conceded += bowlerRuns;
    if (d.extra_type === 'wide') bw.wides += d.extra_runs;
    if (d.extra_type === 'no_ball') bw.no_balls += d.extra_runs;
    if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type)) bw.wickets += 1;

    const overKey = `${d.bowler_id}-${d.over_number}`;
    if (!overGroups.has(overKey)) overGroups.set(overKey, []);
    overGroups.get(overKey).push(d);

    if (d.is_wicket && d.fielder_id) {
      if (!fieldingMap.has(d.fielder_id)) {
        fieldingMap.set(d.fielder_id, { innings_id: inningsId, player_id: d.fielder_id, team: null, catches: 0, stumpings: 0, run_outs: 0, is_joker: false });
      }
      const f = fieldingMap.get(d.fielder_id);
      if (d.wicket_type === 'caught') f.catches += 1;
      if (d.wicket_type === 'stumped') f.stumpings += 1;
      if (d.wicket_type === 'run_out') f.run_outs += 1;
    }
  }

  for (const [, balls] of overGroups) {
    const legal = balls.filter(b => b.is_legal_delivery);
    if (legal.length === 6) {
      const concededInOver = balls.reduce((sum, b) => {
        if (b.extra_type === 'bye' || b.extra_type === 'leg_bye') return sum;
        return sum + b.total_runs_on_delivery;
      }, 0);
      if (concededInOver === 0) {
        const bw = bowlingMap.get(balls[0].bowler_id);
        if (bw) bw.maidens += 1;
      }
    }
  }

  for (const bw of bowlingMap.values()) {
    bw.overs_display = `${Math.floor(bw.legal_balls / 6)}.${bw.legal_balls % 6}`;
  }

  if (battingMap.size) await supabase.from('batting_scorecards').insert(Array.from(battingMap.values()));
  if (bowlingMap.size) await supabase.from('bowling_scorecards').insert(Array.from(bowlingMap.values()));
  if (fieldingMap.size) await supabase.from('fielding_scorecards').insert(Array.from(fieldingMap.values()));

  await supabase.from('innings').update(totals).eq('id', inningsId);

  return totals;
}

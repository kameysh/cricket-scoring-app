import { supabase } from '../lib/supabase';

export async function listMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*, venues(name,city), tournaments(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMatch(id) {
  const { data, error } = await supabase
    .from('matches')
    .select('*, venues(name,city), tournaments(name), man_of_match:man_of_match_id(id,name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMatch(payload) {
  const { data, error } = await supabase.from('matches').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateMatch(id, payload) {
  const { data, error } = await supabase.from('matches').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setMatchPlayers(matchId, players) {
  // players: [{ player_id, team, batting_position }]
  const rows = players.map(p => ({ match_id: matchId, ...p }));
  const { error } = await supabase.from('match_players').insert(rows);
  if (error) throw error;
}

export async function getMatchPlayers(matchId) {
  const { data, error } = await supabase
    .from('match_players')
    .select('*, players(*)')
    .eq('match_id', matchId)
    .order('batting_position');
  if (error) throw error;
  return data;
}

export async function startMatch(matchId) {
  const match = await getMatch(matchId);
  if (match.tournament_id) {
    await supabase.from('tournaments').update({ status: 'ongoing' }).eq('id', match.tournament_id).eq('status', 'upcoming');
  }
  return updateMatch(matchId, { status: 'live' });
}

export async function createInnings(matchId, inningsNumber, battingTeam, target = null) {
  const { data, error } = await supabase
    .from('innings')
    .insert({ match_id: matchId, innings_number: inningsNumber, batting_team: battingTeam, target })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getInnings(matchId) {
  const { data, error } = await supabase
    .from('innings')
    .select('*')
    .eq('match_id', matchId)
    .order('innings_number');
  if (error) throw error;
  return data;
}

export async function getInningsById(inningsId) {
  const { data, error } = await supabase.from('innings').select('*').eq('id', inningsId).single();
  if (error) throw error;
  return data;
}

export async function completeInnings(inningsId, endReason = null) {
  const { data, error } = await supabase
    .from('innings')
    .update({ is_completed: true, manually_ended: !!endReason, end_reason: endReason })
    .eq('id', inningsId)
    .select()
    .single();
  if (error) throw error;
  await supabase.rpc('update_player_career_stats', { p_innings_id: inningsId });
  return data;
}

export async function getScorecards(inningsId) {
  const [batting, bowling, fielding] = await Promise.all([
    supabase.from('batting_scorecards').select('*, players(name)').eq('innings_id', inningsId).order('batting_position'),
    supabase.from('bowling_scorecards').select('*, players(name)').eq('innings_id', inningsId),
    supabase.from('fielding_scorecards').select('*, players(name)').eq('innings_id', inningsId),
  ]);
  return { batting: batting.data || [], bowling: bowling.data || [], fielding: fielding.data || [] };
}

export async function getDeliveries(inningsId) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, batsman:batsman_id(name), bowler:bowler_id(name), fielder:fielder_id(name), batsman_out:batsman_out_id(name)')
    .eq('innings_id', inningsId)
    .order('total_ball_sequence');
  if (error) throw error;
  return data;
}

export async function completeMatch(matchId, payload) {
  return updateMatch(matchId, { status: 'completed', ...payload });
}

export async function startUpcomingMatch(matchId, tossWinner, tossDecision) {
  const battingTeam =
    (tossWinner === 'team1' && tossDecision === 'bat') ||
    (tossWinner === 'team2' && tossDecision === 'field')
      ? 1 : 2;
  await updateMatch(matchId, { toss_winner: tossWinner, toss_decision: tossDecision });
  await startMatch(matchId);
  await createInnings(matchId, 1, battingTeam);
}

// FK cascades (match_players, innings -> deliveries/scorecards/match_events) clean up automatically.
export async function deleteMatch(matchId) {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw error;
}

export async function deleteAllMatches() {
  const { error } = await supabase.from('matches').delete().neq('status', 'live');
  if (error) throw error;
}

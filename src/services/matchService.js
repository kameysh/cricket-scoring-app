import { supabase } from '../lib/supabase';
import { pickMotm } from '../lib/cricketUtils';

export async function listMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*, venues(name,city), tournaments(name)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getMatchNumber(id) {
  // Returns the 1-based sequential number of this match (globally, by created_at)
  const { data: target } = await supabase.from('matches').select('created_at').eq('id', id).single();
  if (!target) return null;
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .lte('created_at', target.created_at);
  return count ?? null;
}

export async function getMatch(id) {
  const { data, error } = await supabase
    .from('matches')
    .select('*, venues(name,city), tournaments(name), man_of_match:man_of_match_id(id,name,nickname)')
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

// Add a substitute player to an existing match squad mid-match.
// subbedOutPlayerId is the match_players.id of the player being replaced.
export async function addSubPlayer(matchId, playerId, team, subbedOutPlayerId) {
  const { data, error } = await supabase
    .from('match_players')
    .insert({
      match_id: matchId,
      player_id: playerId,
      team,
      is_substitute: true,
      is_active: true,
      subbed_out_player_id: subbedOutPlayerId ?? null,
    })
    .select('*, players(*)')
    .single();
  if (error) throw error;
  return data;
}

// Toggle a match_players row active/inactive (used for sub swaps).
export async function setPlayerActive(matchPlayerId, isActive) {
  const { error } = await supabase
    .from('match_players')
    .update({ is_active: isActive })
    .eq('id', matchPlayerId);
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
  const result = await updateMatch(matchId, { status: 'live' });
  // Fire-and-forget push notification — never blocks or throws
  sendPushNotification({
    title: '🏏 Match is Live!',
    body: `${match.team1_name} vs ${match.team2_name} has started. Tap to watch.`,
    url: `/matches/${matchId}`,
    tag: `match-live-${matchId}`,
  }).catch(() => {});
  return result;
}

/** Send a push notification via the edge function (fire-and-forget safe) */
export async function sendPushNotification({ userIds, title, body, url, tag }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.functions.invoke('send-push', {
    body: { userIds, title, body, url, tag },
  });
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

export async function createSuperOverInnings(matchId, inningsNumber, battingTeam, target = null) {
  const { data, error } = await supabase
    .from('innings')
    .insert({ match_id: matchId, innings_number: inningsNumber, batting_team: battingTeam, target, is_super_over: true })
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
    supabase.from('batting_scorecards').select('*, players!player_id(name,nickname)').eq('innings_id', inningsId).order('batting_position'),
    supabase.from('bowling_scorecards').select('*, players!player_id(name,nickname)').eq('innings_id', inningsId),
    supabase.from('fielding_scorecards').select('*, players!player_id(name,nickname)').eq('innings_id', inningsId),
  ]);
  return { batting: batting.data || [], bowling: bowling.data || [], fielding: fielding.data || [] };
}

export async function getDeliveries(inningsId) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, batsman:batsman_id(name,nickname), bowler:bowler_id(name,nickname), fielder:fielder_id(name,nickname), batsman_out:batsman_out_id(name,nickname)')
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

export async function autoAssignManOfMatch(matchId) {
  try {
    const [allInnings, allPlayers] = await Promise.all([
      getInnings(matchId),
      getMatchPlayers(matchId),
    ]);
    const allBatting = [], allBowling = [], allFielding = [];
    await Promise.all(allInnings.map(async inn => {
      const cards = await getScorecards(inn.id);
      allBatting.push(...cards.batting);
      allBowling.push(...cards.bowling);
      allFielding.push(...(cards.fielding || []));
    }));
    const match = await getMatch(matchId);
    const winningTeam = match.winning_team_name === match.team1_name ? 1
      : match.winning_team_name === match.team2_name ? 2 : null;
    const playerTeams = new Map(allPlayers.map(mp => [mp.player_id, mp.team]));
    const uniqueIds = [...new Set(allPlayers.map(mp => mp.player_id))];
    const bestId = pickMotm(uniqueIds, allBatting, allBowling, allFielding, playerTeams, winningTeam);
    if (bestId) await updateMatch(matchId, { man_of_match_id: bestId });
  } catch { /* non-critical */ }
}

export async function incrementMatchesPlayed(matchId) {
  const { error } = await supabase.rpc('increment_matches_played', { p_match_id: matchId });
  if (error) throw error;
}

export async function autoAssignManOfSeries(tournamentId) {
  const { data: tourMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed');
  if (!tourMatches?.length) return;

  const allBatting = [], allBowling = [], allFielding = [];
  const allPlayerIds = new Set();

  await Promise.all(tourMatches.map(async m => {
    const [innings, mps] = await Promise.all([getInnings(m.id), getMatchPlayers(m.id)]);
    mps.forEach(mp => allPlayerIds.add(mp.player_id));
    await Promise.all(innings.map(async inn => {
      const cards = await getScorecards(inn.id);
      allBatting.push(...cards.batting);
      allBowling.push(...cards.bowling);
      allFielding.push(...(cards.fielding || []));
    }));
  }));

  const bestId = pickMotm([...allPlayerIds], allBatting, allBowling, allFielding, new Map(), null);
  if (bestId) {
    const { error } = await supabase.from('tournaments').update({ man_of_series_id: bestId }).eq('id', tournamentId);
    if (error) throw error;
  }
}

export async function getDistinctTeamNames() {
  const { data, error } = await supabase
    .from('matches')
    .select('team1_name, team2_name')
    .eq('status', 'completed');
  if (error) throw error;
  const names = new Set();
  (data || []).forEach(m => { names.add(m.team1_name); names.add(m.team2_name); });
  return [...names].filter(Boolean).sort();
}

export async function getH2HMatches(teamA, teamB) {
  // Fetch both orderings separately (Supabase .or with compound conditions requires specific syntax)
  const [r1, r2] = await Promise.all([
    supabase.from('matches').select('*, venues(name,city), innings(*)').eq('status', 'completed').eq('team1_name', teamA).eq('team2_name', teamB).order('created_at', { ascending: false }),
    supabase.from('matches').select('*, venues(name,city), innings(*)').eq('status', 'completed').eq('team1_name', teamB).eq('team2_name', teamA).order('created_at', { ascending: false }),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
  return [...(r1.data || []), ...(r2.data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getH2HTopPerformers(matchIds) {
  if (!matchIds?.length) return { topBatsmen: [], topBowlers: [] };
  const { data: inningsRows, error: iErr } = await supabase
    .from('innings').select('id').in('match_id', matchIds);
  if (iErr) throw iErr;
  const inningsIds = (inningsRows || []).map(i => i.id);
  if (!inningsIds.length) return { topBatsmen: [], topBowlers: [] };

  const [bat, bowl] = await Promise.all([
    supabase.from('batting_scorecards').select('player_id, bat_runs, players(name, nickname, photo_url)').in('innings_id', inningsIds).limit(200),
    supabase.from('bowling_scorecards').select('player_id, bowl_wickets, players(name, nickname, photo_url)').in('innings_id', inningsIds).limit(200),
  ]);

  const batMap = new Map();
  for (const r of bat.data || []) {
    const e = batMap.get(r.player_id) || { player: r.players, runs: 0 };
    e.runs += r.bat_runs || 0;
    batMap.set(r.player_id, e);
  }
  const bowlMap = new Map();
  for (const r of bowl.data || []) {
    const e = bowlMap.get(r.player_id) || { player: r.players, wickets: 0 };
    e.wickets += r.bowl_wickets || 0;
    bowlMap.set(r.player_id, e);
  }
  return {
    topBatsmen: [...batMap.values()].sort((a, b) => b.runs - a.runs).slice(0, 3),
    topBowlers: [...bowlMap.values()].sort((a, b) => b.wickets - a.wickets).slice(0, 3),
  };
}

import { supabase } from '../lib/supabase';

export async function getAllCareerStats() {
  const { data, error } = await supabase
    .from('player_career_stats')
    .select('*, players(id, name, nickname, photo_url, role)')
    .order('bat_runs', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Returns { [player_id]: totalMatchesPlayed } counted from match_players (squad participation).
// This is different from bat_matches/bowl_matches which only count matches the player batted/bowled in.
export async function getPlayerMatchCounts() {
  const { data, error } = await supabase
    .from('match_players')
    .select('player_id, match_id');
  if (error) throw error;
  const counts = {};
  for (const row of data || []) {
    if (!counts[row.player_id]) counts[row.player_id] = new Set();
    counts[row.player_id].add(row.match_id);
  }
  return Object.fromEntries(
    Object.entries(counts).map(([id, set]) => [id, set.size])
  );
}

// Returns { batInnings: { [player_id]: count }, bowlInnings: { [player_id]: count } }
// Computed live from scorecards — never drifts from actual data unlike RPC counters.
export async function getPlayerInningsCounts() {
  const [bat, bowl] = await Promise.all([
    // Push filters into DB so we don't fetch rows we immediately discard in JS
    supabase.from('batting_scorecards').select('player_id').neq('status', 'yet_to_bat'),
    supabase.from('bowling_scorecards').select('player_id').gt('legal_balls', 0),
  ]);

  const batInnings = {};
  for (const row of bat.data || []) {
    batInnings[row.player_id] = (batInnings[row.player_id] || 0) + 1;
  }

  const bowlInnings = {};
  for (const row of bowl.data || []) {
    bowlInnings[row.player_id] = (bowlInnings[row.player_id] || 0) + 1;
  }

  return { batInnings, bowlInnings };
}

export async function listPlayers({ search = '', activeOnly = false } = {}) {
  let q = supabase.from('players').select('*').order('name');
  if (activeOnly) q = q.eq('is_active', true);
  if (search) q = q.ilike('name', `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getPlayer(id) {
  const { data, error } = await supabase.from('players').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getPlayerByUserId(userId) {
  const { data, error } = await supabase.from('players').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data; // null if no player profile yet
}

export async function createPlayer(payload) {
  const { data, error } = await supabase.from('players').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id, payload) {
  const { data, error } = await supabase.from('players').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id) {
  // soft delete if player has match history
  const { count } = await supabase
    .from('match_players')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', id);
  if (count && count > 0) {
    const { error } = await supabase.from('players').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    return { softDeleted: true };
  }
  await supabase.from('player_career_stats').delete().eq('player_id', id);
  await supabase.from('player_tournament_stats').delete().eq('player_id', id);
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
  return { softDeleted: false };
}

export async function uploadPlayerPhoto(file, playerId) {
  const ext = file.name.split('.').pop();
  const path = `players/${playerId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('player-photos').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('player-photos').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Failed to get photo URL');
  return data.publicUrl;
}

export async function deleteAllPlayers() {
  // Soft-delete players that have match history (preserve stats)
  const { data: used, error: usedErr } = await supabase
    .from('match_players')
    .select('player_id');
  if (usedErr) throw usedErr;

  const usedIds = [...new Set((used || []).map(r => r.player_id))];

  if (usedIds.length > 0) {
    const { error } = await supabase.from('players').update({ is_active: false }).in('id', usedIds);
    if (error) throw error;
  }

  // Hard-delete players with no match history (clean up their stats first as safety net)
  if (usedIds.length > 0) {
    await supabase.from('player_career_stats').delete().not('player_id', 'in', usedIds);
    await supabase.from('player_tournament_stats').delete().not('player_id', 'in', usedIds);
    const { error } = await supabase.from('players').delete().not('id', 'in', usedIds);
    if (error) throw error;
  } else {
    // No players have match history — hard-delete all
    await supabase.from('player_career_stats').delete().not('player_id', 'is', null);
    await supabase.from('player_tournament_stats').delete().not('player_id', 'is', null);
    const { error } = await supabase.from('players').delete().not('id', 'is', null);
    if (error) throw error;
  }
}

export async function masterReset() {
  // Stats first (FK refs players, not matches)
  const { error: e1 } = await supabase.from('player_career_stats').delete().not('player_id', 'is', null);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('player_tournament_stats').delete().not('player_id', 'is', null);
  if (e2) throw e2;
  // Matches cascade → innings → deliveries, scorecards, match_events, match_players
  const { error: e3 } = await supabase.from('matches').delete().not('id', 'is', null);
  if (e3) throw e3;
}

export async function getCareerStats(playerId) {
  const { data, error } = await supabase
    .from('player_career_stats')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getTournamentStats(playerId, tournamentId) {
  const { data, error } = await supabase
    .from('player_tournament_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('tournament_id', tournamentId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getPlayerTournaments(playerId) {
  const { data, error } = await supabase
    .from('player_tournament_stats')
    .select('tournament_id, tournaments(id, name)')
    .eq('player_id', playerId);
  if (error) throw error;
  return data;
}

export async function getMatchHistory(playerId, limit = 50, offset = 0) {
  const { data: mpRows, error } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', playerId);
  if (error) throw error;
  const matchIds = mpRows.map(r => r.match_id);
  if (matchIds.length === 0) return [];

  // Fetch matches and innings in parallel — both depend only on matchIds
  const [matchesRes, inningsRes] = await Promise.all([
    supabase.from('matches')
      .select('*, venues(name,city), tournaments(name)')
      .in('id', matchIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase.from('innings')
      .select('id, match_id, innings_number')
      .in('match_id', matchIds),
  ]);
  if (matchesRes.error) throw matchesRes.error;

  const inningsIds = (inningsRes.data || []).map(i => i.id);

  const [batting, bowling, fielding] = await Promise.all([
    supabase.from('batting_scorecards').select('*').eq('player_id', playerId).in('innings_id', inningsIds),
    supabase.from('bowling_scorecards').select('*').eq('player_id', playerId).in('innings_id', inningsIds),
    supabase.from('fielding_scorecards').select('*').eq('player_id', playerId).in('innings_id', inningsIds),
  ]);

  // Pre-build innings lookup so match mapping is O(1) not O(n²)
  const inningsByMatch = new Map();
  for (const i of inningsRes.data || []) {
    if (!inningsByMatch.has(i.match_id)) inningsByMatch.set(i.match_id, new Set());
    inningsByMatch.get(i.match_id).add(i.id);
  }

  return (matchesRes.data || []).map(match => {
    const inningsSet = inningsByMatch.get(match.id) || new Set();
    const bat   = (batting.data  || []).find(b => inningsSet.has(b.innings_id));
    const bowl  = (bowling.data  || []).find(b => inningsSet.has(b.innings_id));
    const field = (fielding.data || []).find(b => inningsSet.has(b.innings_id));
    return { match, batting: bat, bowling: bowl, fielding: field };
  });
}

export async function getDuckHunterCount(playerId) {
  const { data: wickets, error } = await supabase
    .from('deliveries')
    .select('innings_id, batsman_out_id, batsman_id')
    .eq('bowler_id', playerId)
    .eq('is_wicket', true)
    .in('wicket_type', ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket']);
  if (error || !wickets?.length) return 0;

  const inningsIds = [...new Set(wickets.map(w => w.innings_id))];
  const batsmanIds = [...new Set(wickets.map(w => w.batsman_out_id || w.batsman_id).filter(Boolean))];

  const { data: ducks } = await supabase
    .from('batting_scorecards')
    .select('innings_id, player_id')
    .in('innings_id', inningsIds)
    .in('player_id', batsmanIds)
    .eq('bat_runs', 0);

  const duckSet = new Set((ducks || []).map(d => `${d.innings_id}:${d.player_id}`));
  return wickets.filter(w => {
    const bid = w.batsman_out_id || w.batsman_id;
    return bid && duckSet.has(`${w.innings_id}:${bid}`);
  }).length;
}

// Returns match IDs for all matches in a series (via its tournaments)
export async function getSeriesMatchIds(seriesId) {
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments').select('id').eq('series_id', seriesId);
  if (tErr) throw tErr;
  const tIds = (tournaments || []).map(t => t.id);
  if (!tIds.length) return [];
  const { data: matches, error: mErr } = await supabase
    .from('matches').select('id').in('tournament_id', tIds);
  if (mErr) throw mErr;
  return (matches || []).map(m => m.id);
}

// Aggregate player_tournament_stats for one player across all tournaments in a series
export async function getPlayerSeriesStats(playerId, seriesId) {
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments').select('id').eq('series_id', seriesId);
  if (tErr) throw tErr;
  const tIds = (tournaments || []).map(t => t.id);
  if (!tIds.length) return null;
  const { data, error } = await supabase
    .from('player_tournament_stats').select('*')
    .eq('player_id', playerId).in('tournament_id', tIds);
  if (error) throw error;
  if (!data?.length) return null;
  const agg = {
    bat_matches: 0, bat_innings: 0, bat_not_outs: 0, bat_runs: 0, bat_balls: 0,
    bat_highest_score: 0, bat_fours: 0, bat_sixes: 0, bat_ducks: 0,
    bat_thirties: 0, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 0,
    bat_ones: 0, bat_twos: 0, bat_threes: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0, bowl_wickets: 0,
    bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 0, bowl_best_runs: 999,
    field_catches: 0, field_stumpings: 0, field_run_outs: 0,
  };
  for (const row of data) {
    agg.bat_matches        += row.bat_matches        || 0;
    agg.bat_innings        += row.bat_innings        || 0;
    agg.bat_not_outs       += row.bat_not_outs       || 0;
    agg.bat_runs           += row.bat_runs           || 0;
    agg.bat_balls          += row.bat_balls          || 0;
    agg.bat_highest_score   = Math.max(agg.bat_highest_score, row.bat_highest_score || 0);
    agg.bat_fours          += row.bat_fours          || 0;
    agg.bat_sixes          += row.bat_sixes          || 0;
    agg.bat_ducks          += row.bat_ducks          || 0;
    agg.bat_thirties       += row.bat_thirties       || 0;
    agg.bat_fifties        += row.bat_fifties        || 0;
    agg.bat_hundreds       += row.bat_hundreds       || 0;
    agg.bat_dot_balls      += row.bat_dot_balls      || 0;
    agg.bat_ones           += row.bat_ones           || 0;
    agg.bat_twos           += row.bat_twos           || 0;
    agg.bat_threes         += row.bat_threes         || 0;
    agg.bowl_matches       += row.bowl_matches       || 0;
    agg.bowl_innings       += row.bowl_innings       || 0;
    agg.bowl_legal_balls   += row.bowl_legal_balls   || 0;
    agg.bowl_runs          += row.bowl_runs          || 0;
    agg.bowl_wickets       += row.bowl_wickets       || 0;
    agg.bowl_maidens       += row.bowl_maidens       || 0;
    agg.bowl_four_wicket_hauls += row.bowl_four_wicket_hauls || 0;
    agg.bowl_five_wicket_hauls += row.bowl_five_wicket_hauls || 0;
    if ((row.bowl_best_wickets || 0) > agg.bowl_best_wickets ||
        ((row.bowl_best_wickets || 0) === agg.bowl_best_wickets && (row.bowl_best_runs || 999) < agg.bowl_best_runs)) {
      agg.bowl_best_wickets = row.bowl_best_wickets || 0;
      agg.bowl_best_runs    = row.bowl_best_runs    || 0;
    }
    agg.field_catches      += row.field_catches      || 0;
    agg.field_stumpings    += row.field_stumpings    || 0;
    agg.field_run_outs     += row.field_run_outs     || 0;
  }
  if (agg.bowl_best_runs === 999) agg.bowl_best_runs = 0;
  return agg;
}

export async function getHeadToHeadAll(batsmanId, inningsIds) {
  let query = supabase
    .from('deliveries')
    .select('bowler_id, bowler:players!bowler_id(id,name,nickname), runs_off_bat, extra_type, is_wicket, wicket_type, innings_id')
    .eq('batsman_id', batsmanId);
  if (inningsIds?.length) query = query.in('innings_id', inningsIds);
  const { data, error } = await query;
  if (error) throw error;

  const bowlerMap = new Map();
  for (const d of data || []) {
    if (!d.bowler_id) continue;
    if (d.extra_type === 'wide') continue;
    if (!bowlerMap.has(d.bowler_id)) {
      bowlerMap.set(d.bowler_id, {
        bowlerId: d.bowler_id,
        bowlerName: d.bowler?.name || 'Unknown',
        balls: 0, runs: 0, dismissals: 0, dots: 0, fours: 0, sixes: 0,
      });
    }
    const e = bowlerMap.get(d.bowler_id);
    e.balls += 1;
    const r = d.runs_off_bat ?? 0;
    e.runs += r;
    if (r === 0) e.dots += 1;
    if (r === 4) e.fours += 1;
    if (r === 6) e.sixes += 1;
    if (d.is_wicket && ['bowled','caught','lbw','stumped','hit_wicket'].includes(d.wicket_type)) {
      e.dismissals += 1;
    }
  }

  return Array.from(bowlerMap.values())
    .map(e => ({ ...e, sr: e.balls > 0 ? (e.runs / e.balls) * 100 : 0, dotPct: e.balls > 0 ? (e.dots / e.balls) * 100 : 0 }))
    .sort((a, b) => b.balls - a.balls);
}

export async function getPlayerVsPlayer(p1Id, p2Id) {
  // Fetch all deliveries then filter wides in JS — Supabase .neq('extra_type','wide')
  // uses SQL != which excludes NULL rows (normal balls), same pattern as getHeadToHeadAll.
  const [r1, r2] = await Promise.all([
    supabase.from('deliveries')
      .select('runs_off_bat, extra_type, is_wicket, wicket_type, run_type')
      .eq('batsman_id', p1Id).eq('bowler_id', p2Id),
    supabase.from('deliveries')
      .select('runs_off_bat, extra_type, is_wicket, wicket_type, run_type')
      .eq('batsman_id', p2Id).eq('bowler_id', p1Id),
  ]);

  const agg = (rows) => {
    const legal = rows.filter(d => d.extra_type !== 'wide');
    const balls = legal.length;
    const runs = legal.reduce((s, d) => s + (d.runs_off_bat || 0), 0);
    const dismissed = legal.filter(d => d.is_wicket &&
      ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type)).length;
    const dots = legal.filter(d => d.run_type === 'dot').length;
    const fours = legal.filter(d => d.run_type === 'four').length;
    const sixes = legal.filter(d => d.run_type === 'six').length;
    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '—';
    const dotPct = balls > 0 ? Math.round((dots / balls) * 100) : 0;
    return { balls, runs, dismissed, sr, dotPct, fours, sixes };
  };

  return { p1AsBat: agg(r1.data || []), p2AsBat: agg(r2.data || []) };
}

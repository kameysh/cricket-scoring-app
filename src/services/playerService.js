import { supabase } from '../lib/supabase';

export async function getAllCareerStats() {
  const { data, error } = await supabase
    .from('player_career_stats')
    .select('*, players(id, name, photo_url, role)')
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

  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('*, venues(name,city), tournaments(name)')
    .in('id', matchIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (mErr) throw mErr;

  const innings = await supabase
    .from('innings')
    .select('id, match_id, innings_number')
    .in('match_id', matchIds);

  const inningsIds = (innings.data || []).map(i => i.id);

  const [batting, bowling, fielding] = await Promise.all([
    supabase.from('batting_scorecards').select('*').eq('player_id', playerId).in('innings_id', inningsIds),
    supabase.from('bowling_scorecards').select('*').eq('player_id', playerId).in('innings_id', inningsIds),
    supabase.from('fielding_scorecards').select('*').eq('player_id', playerId).in('innings_id', inningsIds),
  ]);

  return matches.map(match => {
    const matchInnings = (innings.data || []).filter(i => i.match_id === match.id).map(i => i.id);
    const bat = (batting.data || []).find(b => matchInnings.includes(b.innings_id));
    const bowl = (bowling.data || []).find(b => matchInnings.includes(b.innings_id));
    const field = (fielding.data || []).find(b => matchInnings.includes(b.innings_id));
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

export async function getHeadToHeadAll(batsmanId) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('bowler_id, bowler:players!bowler_id(id,name), runs_off_bat, extra_type, is_wicket, wicket_type')
    .eq('batsman_id', batsmanId);
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

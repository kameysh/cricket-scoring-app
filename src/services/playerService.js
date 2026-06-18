import { supabase } from '../lib/supabase';

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

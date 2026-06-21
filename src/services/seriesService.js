import { supabase } from '../lib/supabase';

export async function listSeries() {
  const { data, error } = await supabase
    .from('tournament_series')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function addSeries(name) {
  const { data, error } = await supabase
    .from('tournament_series')
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSeries(id) {
  const { error } = await supabase.from('tournament_series').delete().eq('id', id);
  if (error) throw error;
}

export async function getSeries(id) {
  const { data, error } = await supabase
    .from('tournament_series')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getSeriesTournaments(seriesId) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, status, start_date, end_date')
    .eq('series_id', seriesId)
    .order('start_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

// Aggregate player_tournament_stats across every tournament in this series.
export async function getSeriesPlayerStats(seriesId) {
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id')
    .eq('series_id', seriesId);
  if (tErr) throw tErr;

  const ids = (tournaments || []).map(t => t.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('player_tournament_stats')
    .select('*, players(id, name, photo_url, role)')
    .in('tournament_id', ids);
  if (error) throw error;

  // Aggregate rows per player across all seasons
  const map = new Map();
  for (const row of data || []) {
    const pid = row.player_id;
    if (!map.has(pid)) {
      map.set(pid, {
        player_id: pid,
        players: row.players,
        bat_runs: 0, bat_innings: 0, bat_not_outs: 0, bat_balls: 0,
        bat_fours: 0, bat_sixes: 0, bat_fifties: 0, bat_hundreds: 0, bat_thirties: 0,
        bat_highest_score: 0,
        bowl_wickets: 0, bowl_runs: 0, bowl_legal_balls: 0, bowl_maidens: 0,
        bowl_five_wicket_hauls: 0,
        field_catches: 0, field_stumpings: 0, field_run_outs: 0,
        bat_matches: 0,
      });
    }
    const s = map.get(pid);
    s.bat_runs             += row.bat_runs             || 0;
    s.bat_innings          += row.bat_innings          || 0;
    s.bat_not_outs         += row.bat_not_outs         || 0;
    s.bat_balls            += row.bat_balls            || 0;
    s.bat_fours            += row.bat_fours            || 0;
    s.bat_sixes            += row.bat_sixes            || 0;
    s.bat_fifties          += row.bat_fifties          || 0;
    s.bat_hundreds         += row.bat_hundreds         || 0;
    s.bat_thirties         += row.bat_thirties         || 0;
    s.bat_highest_score     = Math.max(s.bat_highest_score, row.bat_highest_score || 0);
    s.bowl_wickets         += row.bowl_wickets         || 0;
    s.bowl_runs            += row.bowl_runs            || 0;
    s.bowl_legal_balls     += row.bowl_legal_balls     || 0;
    s.bowl_maidens         += row.bowl_maidens         || 0;
    s.bowl_five_wicket_hauls += row.bowl_five_wicket_hauls || 0;
    s.field_catches        += row.field_catches        || 0;
    s.field_stumpings      += row.field_stumpings      || 0;
    s.field_run_outs       += row.field_run_outs       || 0;
    s.bat_matches          += row.bat_matches          || 0;
  }
  return Array.from(map.values());
}

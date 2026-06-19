import { supabase } from '../lib/supabase';

export async function listTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, is_guest')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function addTeam(name, isGuest = false) {
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: name.trim(), is_guest: isGuest })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

export async function getTeamPlayers(teamId) {
  const { data, error } = await supabase
    .from('team_players')
    .select('player_id')
    .eq('team_id', teamId);
  if (error) throw error;
  return (data || []).map(r => r.player_id);
}

export async function setTeamPlayers(teamId, playerIds) {
  const { error: delErr } = await supabase
    .from('team_players')
    .delete()
    .eq('team_id', teamId);
  if (delErr) throw delErr;
  if (playerIds.length === 0) return;
  const { error: insErr } = await supabase
    .from('team_players')
    .insert(playerIds.map(pid => ({ team_id: teamId, player_id: pid })));
  if (insErr) throw insErr;
}

import { supabase } from '../lib/supabase';

export async function listTeams() {
  const { data, error } = await supabase.from('teams').select('id, name').order('name');
  if (error) throw error;
  return data || [];
}

export async function addTeam(name) {
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

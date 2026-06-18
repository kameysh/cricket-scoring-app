import { supabase } from '../lib/supabase';

export async function listVenues() {
  const { data, error } = await supabase.from('venues').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getVenue(id) {
  const { data, error } = await supabase.from('venues').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createVenue(payload) {
  const { data, error } = await supabase.from('venues').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateVenue(id, payload) {
  const { data, error } = await supabase.from('venues').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVenue(id) {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw error;
}

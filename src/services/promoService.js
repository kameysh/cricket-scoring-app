import { supabase } from '../lib/supabase';

export async function getActivePromo() {
  const { data, error } = await supabase
    .from('tournament_promos')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // null if none active
}

export async function publishPromo({ bannerFile, tournamentName, team1Name, captain1Name, team2Name, captain2Name, eventDate }) {
  // Upload banner to player-photos bucket under promo-banners/ prefix
  const ext = bannerFile.name.split('.').pop().toLowerCase();
  const path = `promo-banners/${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('player-photos')
    .upload(path, bannerFile, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data: { publicUrl } } = supabase.storage.from('player-photos').getPublicUrl(path);

  // Deactivate all previous promos
  const { error: deactErr } = await supabase
    .from('tournament_promos').update({ is_active: false }).eq('is_active', true);
  if (deactErr) throw deactErr;

  // Insert new active promo
  const { data, error } = await supabase
    .from('tournament_promos')
    .insert({
      banner_url: publicUrl,
      tournament_name: tournamentName || null,
      team1_name: team1Name || null,
      captain1_name: captain1Name || null,
      team2_name: team2Name || null,
      captain2_name: captain2Name || null,
      event_date: eventDate || null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivatePromo(id) {
  const { error } = await supabase
    .from('tournament_promos')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

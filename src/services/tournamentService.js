import { supabase } from '../lib/supabase';

export async function listTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*, venues(name,city), tournament_teams(count)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTournament(id) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*, venues(name,city), man_of_series:man_of_series_id(id, name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createTournament(payload) {
  const { data, error } = await supabase.from('tournaments').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateTournament(id, payload) {
  const { data, error } = await supabase.from('tournaments').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTournament(id) {
  const { count } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', id)
    .eq('status', 'live');
  if (count && count > 0) throw new Error('Cannot delete tournament with a live match');
  // Remove upcoming + paused matches; keep completed/no_result/abandoned as historical record
  await supabase.from('matches').delete().eq('tournament_id', id).in('status', ['upcoming', 'paused']);
  const { error } = await supabase.from('tournaments').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
}

export async function getTournamentPlayers(tournamentId) {
  const { data, error } = await supabase
    .from('tournament_players')
    .select('player_id, players(*)')
    .eq('tournament_id', tournamentId);
  if (error) throw error;
  return data.map(d => d.players);
}

export async function setTournamentPlayers(tournamentId, playerIds) {
  await supabase.from('tournament_players').delete().eq('tournament_id', tournamentId);
  if (playerIds.length === 0) return;
  const rows = playerIds.map(player_id => ({ tournament_id: tournamentId, player_id }));
  const { error } = await supabase.from('tournament_players').insert(rows);
  if (error) throw error;
}

// --- Tournament Team Players ---

export async function getTeamPlayers(teamId) {
  const { data, error } = await supabase
    .from('tournament_team_players')
    .select('player_id, players(id, name, photo_url)')
    .eq('tournament_team_id', teamId);
  if (error) throw error;
  return data;
}

export async function setTeamPlayers(teamId, playerIds) {
  await supabase.from('tournament_team_players').delete().eq('tournament_team_id', teamId);
  if (playerIds.length === 0) return;
  const rows = playerIds.map(player_id => ({ tournament_team_id: teamId, player_id }));
  const { error } = await supabase.from('tournament_team_players').insert(rows);
  if (error) throw error;
}

export async function getTeamPlayersForTournament(tournamentId) {
  // Step 1: get all team IDs for this tournament
  const teams = await getTournamentTeams(tournamentId);
  const teamIds = teams.map(t => t.id);
  if (teamIds.length === 0) return {};

  // Step 2: get all player assignments for those teams
  const { data, error } = await supabase
    .from('tournament_team_players')
    .select('tournament_team_id, player_id')
    .in('tournament_team_id', teamIds);
  if (error) throw error;

  // Build map: { [teamId]: [playerId, ...] }
  const map = {};
  for (const row of data) {
    if (!map[row.tournament_team_id]) map[row.tournament_team_id] = [];
    map[row.tournament_team_id].push(row.player_id);
  }
  return map;
}

// --- Tournament Teams CRUD ---

export async function getTournamentTeams(tournamentId) {
  const { data, error } = await supabase
    .from('tournament_teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function addTournamentTeam(tournamentId, name) {
  const { data, error } = await supabase
    .from('tournament_teams')
    .insert({ tournament_id: tournamentId, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTournamentTeam(id, name) {
  const { data, error } = await supabase
    .from('tournament_teams')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTournamentTeam(id, tournamentId, teamName) {
  // Block delete if any match in the tournament uses this team name
  const matches = await getTournamentMatches(tournamentId);
  const inUse = matches.some(m => m.team1_name === teamName || m.team2_name === teamName);
  if (inUse) throw new Error(`"${teamName}" is used in an existing match and cannot be removed`);
  const { error } = await supabase.from('tournament_teams').delete().eq('id', id);
  if (error) throw error;
}

// --- Matches ---

export async function getTournamentMatches(tournamentId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function getLeaderboard(tournamentId, type) {
  if (type === 'batting' || type === 'bowling' || type === 'fielding') {
    const { data, error } = await supabase
      .from('player_tournament_stats')
      .select('*, players(name, photo_url)')
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return data;
  }
  return [];
}

export async function getPointsTable(tournamentId) {
  const matches = await getTournamentMatches(tournamentId);
  const completed = matches.filter(m => m.status === 'completed' || m.status === 'no_result');
  const teams = new Map();

  const ensure = name => {
    if (!teams.has(name)) teams.set(name, { team: name, played: 0, won: 0, lost: 0, tied: 0, nr: 0, points: 0 });
    return teams.get(name);
  };

  for (const m of completed) {
    const t1 = ensure(m.team1_name);
    const t2 = ensure(m.team2_name);
    t1.played++; t2.played++;
    if (m.result_type === 'no_result' || m.result_type === 'abandoned') {
      t1.nr++; t2.nr++; t1.points += 1; t2.points += 1;
    } else if (m.result_type === 'tie') {
      t1.tied++; t2.tied++; t1.points += 1; t2.points += 1;
    } else if (m.winning_team_name === m.team1_name) {
      t1.won++; t2.lost++; t1.points += 2;
    } else if (m.winning_team_name === m.team2_name) {
      t2.won++; t1.lost++; t2.points += 2;
    }
  }

  return Array.from(teams.values()).sort((a, b) => b.points - a.points);
}

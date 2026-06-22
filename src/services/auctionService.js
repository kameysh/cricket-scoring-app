import { supabase } from '../lib/supabase';

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function createAuction({ name, budget_per_team, bid_increments }) {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from('auctions')
    .insert({ name, budget_per_team, bid_increments, created_by: session?.user?.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAuctions() {
  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAuction(id) {
  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateAuctionStatus(id, status) {
  const extra = {};
  if (status === 'live') extra.started_at = new Date().toISOString();
  if (status === 'completed') extra.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('auctions')
    .update({ status, ...extra })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAuction(id) {
  const { error } = await supabase.from('auctions').delete().eq('id', id);
  if (error) throw error;
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function addAuctionTeam(auctionId, teamId, captainUserId) {
  const auction = await getAuction(auctionId);
  const { data, error } = await supabase
    .from('auction_teams')
    .insert({
      auction_id: auctionId,
      team_id: teamId,
      captain_id: captainUserId || null,
      budget_remaining: auction.budget_per_team,
    })
    .select('*, team:team_id(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function listAuctionTeams(auctionId) {
  const { data, error } = await supabase
    .from('auction_teams')
    .select('*, team:team_id(id, name)')
    .eq('auction_id', auctionId)
    .order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateAuctionTeamCaptain(auctionTeamId, captainUserId) {
  const { data, error } = await supabase
    .from('auction_teams')
    .update({ captain_id: captainUserId })
    .eq('id', auctionTeamId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeAuctionTeam(auctionTeamId) {
  const { error } = await supabase.from('auction_teams').delete().eq('id', auctionTeamId);
  if (error) throw error;
}

// ── Player Pool ───────────────────────────────────────────────────────────────

export async function addPlayerToPool(auctionId, playerId, basePrice = 100) {
  // Assign a random pool_order so randomisation is pre-computed
  const pool_order = Math.floor(Math.random() * 1_000_000);
  const { data, error } = await supabase
    .from('auction_players')
    .insert({ auction_id: auctionId, player_id: playerId, base_price: basePrice, pool_order })
    .select('*, player:player_id(id, name, role, photo_url)')
    .single();
  if (error) throw error;
  return data;
}

export async function removePlayerFromPool(auctionPlayerRowId) {
  // Only allowed when status = 'pool'
  const { data: row } = await supabase
    .from('auction_players').select('status').eq('id', auctionPlayerRowId).single();
  if (row?.status !== 'pool') throw new Error('Can only remove players in pool status');
  const { error } = await supabase.from('auction_players').delete().eq('id', auctionPlayerRowId);
  if (error) throw error;
}

export async function updatePlayerBasePrice(auctionPlayerRowId, basePrice) {
  const { data, error } = await supabase
    .from('auction_players')
    .update({ base_price: basePrice })
    .eq('id', auctionPlayerRowId)
    .eq('status', 'pool')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAuctionPlayers(auctionId) {
  const { data, error } = await supabase
    .from('auction_players')
    .select('*, player:player_id(id, name, role, photo_url)')
    .eq('auction_id', auctionId)
    .order('pool_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── Live Controls (auctioneer) ────────────────────────────────────────────────

async function activatePlayer(auctionPlayerRowId) {
  const { data, error } = await supabase
    .from('auction_players')
    .update({
      status: 'active',
      current_bid: null,
      leading_team_id: null,
      pass_team1: false,
      pass_team2: false,
      held_at: null,
    })
    .eq('id', auctionPlayerRowId)
    .select('*, player:player_id(id, name, role, photo_url)')
    .single();
  if (error) throw error;
  return data;
}

export async function drawNextPlayer(auctionId) {
  // 1. Try random pool player
  const { data: poolPlayers } = await supabase
    .from('auction_players')
    .select('id')
    .eq('auction_id', auctionId)
    .eq('status', 'pool');

  if (poolPlayers && poolPlayers.length > 0) {
    const pick = poolPlayers[Math.floor(Math.random() * poolPlayers.length)];
    return activatePlayer(pick.id);
  }

  // 2. Fall back to held queue (FIFO by held_at)
  const { data: heldPlayers } = await supabase
    .from('auction_players')
    .select('id')
    .eq('auction_id', auctionId)
    .eq('status', 'held')
    .order('held_at', { ascending: true })
    .limit(1);

  if (heldPlayers && heldPlayers.length > 0) {
    return activatePlayer(heldPlayers[0].id);
  }

  // 3. Both queues empty — complete auction
  await updateAuctionStatus(auctionId, 'completed');
  return null;
}

export async function dealPlayer(auctionPlayerRowId) {
  const { error } = await supabase.rpc('deal_player', {
    p_auction_player_id: auctionPlayerRowId,
  });
  if (error) throw error;
}

export async function holdPlayer(auctionPlayerRowId) {
  const { data, error } = await supabase
    .from('auction_players')
    .update({ status: 'held', held_at: new Date().toISOString() })
    .eq('id', auctionPlayerRowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markUnsold(auctionPlayerRowId) {
  const { data, error } = await supabase
    .from('auction_players')
    .update({ status: 'unsold' })
    .eq('id', auctionPlayerRowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function raiseAuctioneerBid(auctionPlayerRowId, auctionTeamId, newAmount) {
  // Insert a raise bid, then update current_bid on the player row
  const { data: player } = await supabase
    .from('auction_players')
    .select('auction_id')
    .eq('id', auctionPlayerRowId)
    .single();

  const { error: bidError } = await supabase
    .from('auction_bids')
    .insert({
      auction_id: player.auction_id,
      auction_player_id: auctionPlayerRowId,
      auction_team_id: auctionTeamId,
      amount: newAmount,
      bid_type: 'auctioneer_raise',
    });
  if (bidError) throw bidError;

  const { data, error } = await supabase
    .from('auction_players')
    .update({ current_bid: newAmount, leading_team_id: auctionTeamId })
    .eq('id', auctionPlayerRowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Captain Actions ───────────────────────────────────────────────────────────

export async function placeBid(auctionPlayerRowId, auctionTeamId, amount) {
  // Budget guardrail: reject if amount exceeds budget_remaining
  const { data: team } = await supabase
    .from('auction_teams')
    .select('budget_remaining, auction_id')
    .eq('id', auctionTeamId)
    .single();
  if (!team) throw new Error('Team not found');
  if (amount > team.budget_remaining) {
    throw new Error(`Bid ₹${amount} exceeds remaining budget ₹${team.budget_remaining}`);
  }

  // Insert bid record
  const { error: bidError } = await supabase
    .from('auction_bids')
    .insert({
      auction_id: team.auction_id,
      auction_player_id: auctionPlayerRowId,
      auction_team_id: auctionTeamId,
      amount,
      bid_type: 'captain',
    });
  if (bidError) throw bidError;

  // Update player's current bid + reset pass signals
  const { data, error } = await supabase
    .from('auction_players')
    .update({
      current_bid: amount,
      leading_team_id: auctionTeamId,
      pass_team1: false,
      pass_team2: false,
    })
    .eq('id', auctionPlayerRowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function signalPass(auctionPlayerRowId, passColumn) {
  if (passColumn !== 'pass_team1' && passColumn !== 'pass_team2') {
    throw new Error('passColumn must be pass_team1 or pass_team2');
  }
  const { data, error } = await supabase
    .from('auction_players')
    .update({ [passColumn]: true })
    .eq('id', auctionPlayerRowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Bid Log ───────────────────────────────────────────────────────────────────

export async function getBidsForPlayer(auctionPlayerRowId, limit = 20) {
  const { data, error } = await supabase
    .from('auction_bids')
    .select('*, auction_team:auction_team_id(id, team:team_id(name))')
    .eq('auction_player_id', auctionPlayerRowId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

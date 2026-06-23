import { supabase } from '../lib/supabase';
import { addTeam, setTeamPlayers } from './teamService';

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

// teamName is a plain string — auction teams are standalone bidding entities,
// not tied to the global teams registry.
export async function addAuctionTeam(auctionId, teamName, captainUserId) {
  const auction = await getAuction(auctionId);
  const { data, error } = await supabase
    .from('auction_teams')
    .insert({
      auction_id: auctionId,
      name: teamName,
      captain_id: captainUserId || null,
      budget_remaining: auction.budget_per_team,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAuctionTeams(auctionId) {
  const { data, error } = await supabase
    .from('auction_teams')
    .select('*')
    .eq('auction_id', auctionId)
    .order('id', { ascending: true });
  if (error) throw error;
  // Normalise: if name missing (legacy row), fall back to team_id string so UI never shows blank
  return (data ?? []).map(t => ({ ...t, name: t.name || t.team_id || 'Team' }));
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
    .select('*, player:player_id(id, name, role, photo_url, user_id)')
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
    .select('*, player:player_id(id, name, role, photo_url, user_id)')
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
    .select('*, player:player_id(id, name, role, photo_url, user_id)')
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

// Auto-sell each team's captain to their own team at base price.
// Called once when the auction transitions from draft → live.
// Skips gracefully if a team has no captain, the captain has no player profile,
// or the captain's player is not in the auction pool.
export async function autosellCaptains(auctionId) {
  const teams = await listAuctionTeams(auctionId);
  const sold = [];

  for (const team of teams) {
    if (!team.captain_id) continue;

    // Resolve captain user → player profile
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', team.captain_id)
      .maybeSingle();
    if (!player) continue;

    // Find their auction_player row — any status (may already be held/sold from a retry)
    let { data: ap } = await supabase
      .from('auction_players')
      .select('id, base_price, status, player:player_id(name)')
      .eq('auction_id', auctionId)
      .eq('player_id', player.id)
      .maybeSingle();

    // Captain wasn't added to the pool yet — add them automatically at base_price 100
    if (!ap) {
      const pool_order = Math.floor(Math.random() * 1_000_000);
      const { data: inserted, error: insertErr } = await supabase
        .from('auction_players')
        .insert({ auction_id: auctionId, player_id: player.id, base_price: 100, pool_order })
        .select('id, base_price, status, player:player_id(name)')
        .single();
      if (insertErr) throw insertErr;
      ap = inserted;
    }

    // Already sold (e.g. autosell called twice) — skip gracefully
    if (ap.status === 'sold') continue;

    const price = ap.base_price ?? 100;

    // Mark sold
    const { error: sellErr } = await supabase
      .from('auction_players')
      .update({
        status: 'sold',
        sold_to_team_id: team.id,
        sold_price: price,
        current_bid: price,
        leading_team_id: team.id,
      })
      .eq('id', ap.id);
    if (sellErr) throw sellErr;

    // Deduct from team purse
    const { error: budgetErr } = await supabase
      .from('auction_teams')
      .update({ budget_remaining: Math.max(0, (team.budget_remaining ?? 0) - price) })
      .eq('id', team.id);
    if (budgetErr) throw budgetErr;

    // Log it in bid history so the UI shows a record
    await supabase.from('auction_bids').insert({
      auction_id: auctionId,
      auction_player_id: ap.id,
      auction_team_id: team.id,
      amount: price,
      bid_type: 'captain_autosell',
    });

    sold.push({ teamName: team.name, playerName: ap.player?.name, price });
  }

  return sold;
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

export async function returnToPool(auctionPlayerRowId) {
  const { data, error } = await supabase
    .from('auction_players')
    .update({ status: 'pool', held_at: null })
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
  // Budget + reserve guardrail (same rule as captain placeBid)
  const { data: team } = await supabase
    .from('auction_teams')
    .select('budget_remaining, auction_id')
    .eq('id', auctionTeamId)
    .single();
  if (!team) throw new Error('Team not found');
  if (newAmount > team.budget_remaining) {
    throw new Error(`Bid ₹${newAmount.toLocaleString()} exceeds remaining budget ₹${team.budget_remaining.toLocaleString()}`);
  }
  const minReserve = await computeMinReserve(team.auction_id, auctionTeamId, auctionPlayerRowId);
  const maxBid = team.budget_remaining - minReserve;
  if (newAmount > maxBid) {
    throw new Error(`Bid ₹${newAmount.toLocaleString()} would leave insufficient purse to complete squad. Max allowed: ₹${maxBid.toLocaleString()}`);
  }

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

// ── Purse Reserve ─────────────────────────────────────────────────────────────

const SQUAD_SIZE = 9;

/**
 * Computes the minimum purse a team must keep in reserve so they can still
 * complete their squad. Formula: sum of top-N base prices from the remaining
 * unpicked pool, where N = SQUAD_SIZE - picked_so_far - 1 (the -1 accounts
 * for the current player being bid on — they count as the next pick if won).
 *
 * Returns 0 when the team has already filled SQUAD_SIZE - 1 slots (only one
 * pick left, so no additional reserve is needed after winning this player).
 */
export async function computeMinReserve(auctionId, teamId, activePlayerId) {
  // Count how many players this team has already won
  const { data: soldRows, error: soldErr } = await supabase
    .from('auction_players')
    .select('id')
    .eq('auction_id', auctionId)
    .eq('sold_to_team_id', teamId)
    .eq('status', 'sold');
  if (soldErr) throw soldErr;

  const pickedCount = soldRows?.length ?? 0;
  const slotsAfterThisOne = SQUAD_SIZE - pickedCount - 1;

  if (slotsAfterThisOne <= 0) return 0;

  // Pickable players remaining (pool + held only; unsold/active excluded) except current
  const { data: unpicked, error: poolErr } = await supabase
    .from('auction_players')
    .select('base_price')
    .eq('auction_id', auctionId)
    .in('status', ['pool', 'held'])
    .neq('id', activePlayerId)
    .order('base_price', { ascending: false });
  if (poolErr) throw poolErr;

  const topPrices = (unpicked ?? []).slice(0, slotsAfterThisOne).map(p => p.base_price ?? 0);
  return topPrices.reduce((sum, p) => sum + p, 0);
}

// ── Captain Actions ───────────────────────────────────────────────────────────

export async function placeBid(auctionPlayerRowId, auctionTeamId, amount) {
  // Budget + reserve guardrail
  const { data: team } = await supabase
    .from('auction_teams')
    .select('budget_remaining, auction_id')
    .eq('id', auctionTeamId)
    .single();
  if (!team) throw new Error('Team not found');
  if (amount > team.budget_remaining) {
    throw new Error(`Bid ₹${amount.toLocaleString()} exceeds remaining budget ₹${team.budget_remaining.toLocaleString()}`);
  }
  const minReserve = await computeMinReserve(team.auction_id, auctionTeamId, auctionPlayerRowId);
  const maxBid = team.budget_remaining - minReserve;
  if (amount > maxBid) {
    throw new Error(`Bid ₹${amount.toLocaleString()} would leave insufficient purse to complete your squad. Max allowed: ₹${maxBid.toLocaleString()}`);
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

// Undo the last bid for the active player.
// Deletes the most recent auction_bids row and rolls auction_players back to
// the previous bid (or base_price / null if it was the only bid).
export async function undoLastBid(auctionPlayerRowId) {
  // Fetch all bids newest-first
  const { data: bids, error: fetchErr } = await supabase
    .from('auction_bids')
    .select('id, amount, auction_team_id')
    .eq('auction_player_id', auctionPlayerRowId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (fetchErr) throw fetchErr;
  if (!bids || bids.length === 0) throw new Error('No bids to undo');

  const [latest, prev] = bids;

  // Delete the last bid — use .select() so we can detect RLS silent no-ops
  const { data: deleted, error: delErr } = await supabase
    .from('auction_bids')
    .delete()
    .eq('id', latest.id)
    .select('id');
  if (delErr) throw delErr;
  if (!deleted?.length) throw new Error('Could not delete bid — check RLS policies on auction_bids');

  // Roll the player row back: if there was a previous bid use it, else clear
  const update = prev
    ? { current_bid: prev.amount, leading_team_id: prev.auction_team_id }
    : { current_bid: null, leading_team_id: null };

  const { data, error } = await supabase
    .from('auction_players')
    .update(update)
    .eq('id', auctionPlayerRowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Team creation ─────────────────────────────────────────────────────────────

// Called when an auction is completed. Creates a global team (in the `teams`
// table) for each auction_team, populates its roster with sold players, and
// links it back to this auction via source_auction_id.
export async function createTeamsFromAuction(auctionId) {
  const [{ data: auctionTeams, error: te }, { data: auctionPlayers, error: pe }] = await Promise.all([
    supabase.from('auction_teams').select('id, name').eq('auction_id', auctionId),
    supabase.from('auction_players').select('player_id, sold_to_team_id').eq('auction_id', auctionId).eq('status', 'sold'),
  ]);
  if (te) throw te;
  if (pe) throw pe;

  const soldByTeam = {};
  for (const ap of auctionPlayers ?? []) {
    if (!ap.sold_to_team_id) continue;
    if (!soldByTeam[ap.sold_to_team_id]) soldByTeam[ap.sold_to_team_id] = [];
    soldByTeam[ap.sold_to_team_id].push(ap.player_id);
  }

  const created = [];
  for (const at of auctionTeams ?? []) {
    const team = await addTeam(at.name, false, auctionId);
    const playerIds = soldByTeam[at.id] ?? [];
    if (playerIds.length > 0) await setTeamPlayers(team.id, playerIds);
    created.push(team);
  }
  return created;
}

// ── Bid Log ───────────────────────────────────────────────────────────────────

export async function getBidsForPlayer(auctionPlayerRowId, limit = 20) {
  const { data, error } = await supabase
    .from('auction_bids')
    .select('*, auction_team:auction_team_id(id, name)')
    .eq('auction_player_id', auctionPlayerRowId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

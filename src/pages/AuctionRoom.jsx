import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuctionStore } from '../stores/auctionStore';
import { useAuctionRoom } from '../hooks/useAuctionRoom';
import { useRole } from '../hooks/useRole';
import * as auctionService from '../services/auctionService';
import * as playerService from '../services/playerService';
import ActivePlayerSpotlight from '../components/auction/ActivePlayerSpotlight';
import BudgetBars from '../components/auction/BudgetBars';
import BidLog from '../components/auction/BidLog';
import AuctioneerControls from '../components/auction/AuctioneerControls';
import CaptainControls from '../components/auction/CaptainControls';
import PassIndicator from '../components/auction/PassIndicator';
import HeldQueue from '../components/auction/HeldQueue';
import BottomSheet from '../components/shared/BottomSheet';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import PlayerAvatar from '../components/player/PlayerAvatar';

function BidLogStrip({ bids, teams }) {
  if (!bids?.length) return null;
  return (
    <div className="px-4 pb-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider shrink-0">Bids</span>
        {bids.map((bid, i) => {
          const teamName = bid.auction_team?.name
            ?? teams?.find(t => t.id === bid.auction_team_id)?.name
            ?? '—';
          return (
            <div key={bid.id ?? i} className="shrink-0 flex items-center gap-1 bg-white dark:bg-ink-800 border border-ink-100 dark:border-white/10 rounded-full px-2.5 py-1">
              <span className="text-[11px] font-semibold text-ink-600 dark:text-ink-300">{teamName}</span>
              <span className="text-[11px] font-bold text-brand-green tabular-nums">₹{bid.amount?.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuctionRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, userId } = useRole();
  const [actionLoading, setActionLoading] = useState(false);
  const [heldSheetOpen, setHeldSheetOpen] = useState(false);
  const [poolSheetOpen, setPoolSheetOpen] = useState(false);
  const [soldSheetOpen, setSoldSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeCareerStats, setActiveCareerStats] = useState(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);

  useAuctionRoom(id);

  const { auction, teams, players, bids, isLoading, error, reset, _patchPlayer, _appendBid, loadAuction } = useAuctionStore();

  // Clear stale auction data when leaving the room
  useEffect(() => () => reset(), []);

  // Lock body scroll for auctioneer — the fixed-height layout must not page-scroll
  useEffect(() => {
    if (!isAdmin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isAdmin]);

  const activePlayer = players.find(p => p.status === 'active') ?? null;
  const poolPlayers  = players.filter(p => p.status === 'pool');
  const heldPlayers  = players.filter(p => p.status === 'held').sort((a, b) => new Date(a.held_at) - new Date(b.held_at));
  const soldPlayers  = players.filter(p => p.status === 'sold');

  // Fetch career stats whenever a new player becomes active
  useEffect(() => {
    if (!activePlayer?.player_id) { setActiveCareerStats(null); return; }
    playerService.getCareerStats(activePlayer.player_id)
      .then(setActiveCareerStats)
      .catch(() => setActiveCareerStats(null));
  }, [activePlayer?.player_id]);

  // Determine role in this auction
  const myAuctionTeam = teams.find(t => t.captain_id === userId);
  const isAuctioneer = isAdmin;
  const isCaptain = !!myAuctionTeam && !isAdmin;

  // Pass state for captain's own team
  const myPassColumn = useMemo(() => {
    if (!myAuctionTeam || !activePlayer) return null;
    const idx = teams.findIndex(t => t.id === myAuctionTeam.id);
    return idx === 0 ? 'pass_team1' : 'pass_team2';
  }, [myAuctionTeam, teams, activePlayer]);

  const hasPassed = activePlayer && myPassColumn ? !!activePlayer[myPassColumn] : false;
  const bothPassing = !!(activePlayer?.pass_team1 && activePlayer?.pass_team2);
  const leadingTeam = activePlayer?.leading_team_id ? teams.find(t => t.id === activePlayer.leading_team_id) : null;
  const teamNames = teams.map(t => t.name ?? '—');

  // Sold players grouped by team
  const soldByTeam = useMemo(() => {
    const map = {};
    for (const ap of soldPlayers) {
      const tid = ap.sold_to_team_id ?? 'unknown';
      if (!map[tid]) map[tid] = [];
      map[tid].push(ap);
    }
    return map;
  }, [soldPlayers]);

  // Refresh bids for active player
  async function refreshBids(playerRowId) {
    try {
      const fresh = await auctionService.getBidsForPlayer(playerRowId);
      // Replace bids in store
      useAuctionStore.setState({ bids: fresh });
    } catch {}
  }

  // ── Auctioneer handlers ────────────────────────────────────────────────────

  async function handleNextPlayer() {
    setActionLoading(true);
    try {
      const drawn = await auctionService.drawNextPlayer(id);
      if (drawn) {
        _patchPlayer(drawn);
        // New player, no bids yet
        useAuctionStore.setState({ bids: [] });
      } else {
        toast('Auction complete!', { icon: '🏆' });
        loadAuction(id);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  // teamId now passed from AuctioneerControls team selector
  async function handleRaise(amount, teamId) {
    if (!activePlayer) return;
    const targetTeamId = teamId || activePlayer.leading_team_id || teams[0]?.id;
    if (!targetTeamId) return;

    // Budget guard
    const team = teams.find(t => t.id === targetTeamId);
    if (team && amount > team.budget_remaining) {
      toast.error(`Exceeds ${team.name} purse (₹${team.budget_remaining?.toLocaleString()})`);
      return;
    }

    setActionLoading(true);
    try {
      const updated = await auctionService.raiseAuctioneerBid(activePlayer.id, targetTeamId, amount);
      _patchPlayer(updated);
      await refreshBids(activePlayer.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeal() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      await auctionService.dealPlayer(activePlayer.id);
      toast.success(`${activePlayer.player?.name ?? 'Player'} sold! 🔨`);
      loadAuction(id); // refresh budgets + all player statuses
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleHold() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.holdPlayer(activePlayer.id);
      _patchPlayer(updated);
      useAuctionStore.setState({ bids: [] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndoBid() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.undoLastBid(activePlayer.id);
      _patchPlayer(updated);
      await refreshBids(activePlayer.id);
      toast('Last bid undone', { icon: '↩' });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnsold() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.markUnsold(activePlayer.id);
      _patchPlayer(updated);
      useAuctionStore.setState({ bids: [] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    try {
      const updated = await auctionService.updateAuctionStatus(id, 'paused');
      useAuctionStore.getState()._onAuctionUpdate(updated);
    } catch (e) { toast.error(e.message); }
  }

  async function handleResume() {
    try {
      const updated = await auctionService.updateAuctionStatus(id, 'live');
      useAuctionStore.getState()._onAuctionUpdate(updated);
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await auctionService.deleteAuction(id);
      navigate('/auctions', { replace: true });
    } catch (e) {
      toast.error(e.message);
      setDeleting(false);
    }
  }

  // ── Captain handlers ───────────────────────────────────────────────────────

  async function handleBid(amount) {
    if (!activePlayer || !myAuctionTeam) return;

    // Budget guard
    if (amount > (myAuctionTeam.budget_remaining ?? 0)) {
      toast.error('Bid exceeds your remaining purse');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await auctionService.placeBid(activePlayer.id, myAuctionTeam.id, amount);
      _patchPlayer(updated);
      await refreshBids(activePlayer.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePass() {
    if (!activePlayer || !myPassColumn) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.signalPass(activePlayer.id, myPassColumn);
      _patchPlayer(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="page-container pt-safe"><p className="text-center py-12 text-ink-400">Loading…</p></div>;
  }

  if (error || !auction) {
    return (
      <div className="page-container pt-safe space-y-4">
        <button onClick={() => navigate('/auctions')} className="flex items-center gap-2 text-sm text-ink-500">
          <ArrowLeft size={16} /> Back to Auctions
        </button>
        <div className="card p-6 text-center space-y-2">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-ink-700 dark:text-ink-200">{error ?? 'Auction not found'}</p>
          <p className="text-xs text-ink-400">
            {error?.includes('relation') || error?.includes('does not exist')
              ? 'Run migration 030_auctions.sql in Supabase SQL Editor first.'
              : "The auction may have been deleted or you don't have access."}
          </p>
        </div>
      </div>
    );
  }

  // ── Shared pieces ──────────────────────────────────────────────────────────

  const header = (
    <div className="flex items-center gap-3 px-4 pt-safe pt-3 pb-2">
      <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10 shrink-0">
        <ArrowLeft size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink-900 dark:text-white truncate text-sm">{auction.name}</p>
      </div>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${auction.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-ink-100 text-ink-400'}`}>
        {auction.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />}
        {auction.status.toUpperCase()}
      </span>
      {isAdmin && (
        <button onClick={() => setDeleteConfirmOpen(true)} className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 shrink-0">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  const counterRow = (
    <div className="flex gap-2 px-4">
      {[
        { label: 'Pool', count: poolPlayers.length, onClick: () => setPoolSheetOpen(true) },
        { label: 'Held', count: heldPlayers.length, onClick: () => setHeldSheetOpen(true) },
        { label: 'Sold', count: soldPlayers.length, onClick: () => setSoldSheetOpen(true) },
      ].map(({ label, count, onClick }) => (
        <button key={label} onClick={onClick}
          className="flex-1 card py-2 flex flex-col items-center gap-0.5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
          <span className="text-base font-extrabold text-ink-900 dark:text-white tabular-nums">{count}</span>
          <span className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">{label}</span>
        </button>
      ))}
    </div>
  );

  // ── AUCTIONEER layout: compact no-scroll design ─────────────────────────────
  if (isAuctioneer) {
    const p = activePlayer?.player;
    const hasBid = activePlayer?.current_bid != null;
    const bidAmount = activePlayer?.current_bid ?? activePlayer?.base_price;

    return (
      <div className="flex flex-col h-screen bg-ink-50 dark:bg-ink-950 overflow-hidden">
        {/* Header */}
        {header}

        {/* Budget bars */}
        <div className="px-4 pb-3">
          <BudgetBars teams={teams} budgetPerTeam={auction.budget_per_team} />
        </div>

        {/* Compact player banner — tap to open full card in sheet */}
        <div className="px-4 pb-3">
          {activePlayer ? (
            <button
              onClick={() => setPlayerSheetOpen(true)}
              className="w-full card px-3 py-2.5 flex items-center gap-3 text-left"
            >
              {/* Thumbnail photo */}
              <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 52, height: 64 }}>
                {p?.photo_url ? (
                  <img src={p.photo_url} alt={p?.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white font-extrabold text-sm">
                    {(p?.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                )}
              </div>

              {/* Player info */}
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-ink-900 dark:text-white text-sm leading-tight truncate">{p?.name ?? '—'}</p>
                <p className="text-[11px] text-ink-400 capitalize mt-0.5">{p?.role ?? ''}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-ink-400 uppercase tracking-wider">{hasBid ? 'Bid' : 'Base'}</span>
                  <span className="text-sm font-extrabold text-brand-green tabular-nums">₹{bidAmount?.toLocaleString()}</span>
                  {leadingTeam && (
                    <span className="text-[10px] text-ink-500 truncate">· {leadingTeam.name}</span>
                  )}
                </div>
              </div>

              {/* Tap hint */}
              <div className="shrink-0 text-[10px] text-ink-300 font-semibold">
                Tap<br/>card
              </div>
            </button>
          ) : (
            <div className="card px-4 py-3 text-center">
              <p className="text-sm text-ink-400">🎲 Tap "Next Player" to begin</p>
            </div>
          )}
        </div>

        {/* Pass indicator */}
        {activePlayer && (
          <div className="px-4 pb-2">
            <PassIndicator passTeam1={activePlayer.pass_team1} passTeam2={activePlayer.pass_team2} teamNames={teamNames} />
          </div>
        )}

        {/* Bid log — horizontal scroll strip */}
        <BidLogStrip bids={bids} teams={teams} />

        {/* Auctioneer controls */}
        <div className="px-4 pt-3">
          <AuctioneerControls
            auctionId={id}
            activePlayer={activePlayer}
            bothPassing={bothPassing}
            onNextPlayer={handleNextPlayer}
            onRaise={handleRaise}
            onUndoBid={handleUndoBid}
            onDeal={handleDeal}
            onHold={handleHold}
            onUnsold={handleUnsold}
            onPause={handlePause}
            onResume={handleResume}
            auctionStatus={auction.status}
            bidIncrements={auction.bid_increments ?? [50, 100, 200, 500, 1000]}
            teams={teams}
            loading={actionLoading}
          />
        </div>

        {/* Counter row */}
        <div className="px-4 pt-3 pb-3">
          {counterRow}
        </div>

        {/* Player full card sheet */}
        <BottomSheet open={playerSheetOpen} onClose={() => setPlayerSheetOpen(false)} title={p?.name ?? 'Player'}>
          <ActivePlayerSpotlight
            player={activePlayer}
            leadingTeam={leadingTeam}
            careerStats={activeCareerStats}
            onViewProfile={activePlayer?.player_id ? () => { setPlayerSheetOpen(false); navigate(`/players/${activePlayer.player_id}`); } : null}
          />
        </BottomSheet>

        {/* Held / Pool / Sold sheets */}
        <BottomSheet open={heldSheetOpen} onClose={() => setHeldSheetOpen(false)} title="Held Queue">
          <HeldQueue heldPlayers={heldPlayers} isAdmin={isAdmin} />
        </BottomSheet>
        <BottomSheet open={poolSheetOpen} onClose={() => setPoolSheetOpen(false)} title="Player Pool">
          <div className="space-y-1.5">
            {poolPlayers.length === 0
              ? <p className="text-sm text-ink-400 text-center py-4">Pool is empty</p>
              : poolPlayers.map(ap => (
                <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-50 dark:bg-white/5">
                  <PlayerAvatar player={ap.player} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                    <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                  </div>
                  <span className="text-xs tabular-nums text-ink-500">₹{ap.base_price?.toLocaleString()}</span>
                </div>
              ))
            }
          </div>
        </BottomSheet>
        <BottomSheet open={soldSheetOpen} onClose={() => setSoldSheetOpen(false)} title="Sold Players">
          {soldPlayers.length === 0
            ? <p className="text-sm text-ink-400 text-center py-4">No players sold yet</p>
            : (
              <div className="space-y-4">
                {teams.map(t => {
                  const teamSold = soldByTeam[t.id] ?? [];
                  const spent = teamSold.reduce((s, ap) => s + (ap.sold_price ?? 0), 0);
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">{t.name}</p>
                        <span className="text-xs tabular-nums text-ink-400">{teamSold.length} players · ₹{spent.toLocaleString()} spent</span>
                      </div>
                      {teamSold.length === 0
                        ? <p className="text-xs text-ink-300 py-1 px-2">None yet</p>
                        : teamSold.map(ap => (
                          <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 mb-1">
                            <PlayerAvatar player={ap.player} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                              <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                            </div>
                            <span className="text-sm font-bold text-brand-green tabular-nums">₹{ap.sold_price?.toLocaleString()}</span>
                          </div>
                        ))
                      }
                    </div>
                  );
                })}
              </div>
            )
          }
        </BottomSheet>
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete Auction"
          message={`Permanently delete "${auction.name}"? All bids and player data will be lost.`}
          confirmLabel="Delete"
          danger
          disabled={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      </div>
    );
  }

  // ── CAPTAIN / VIEWER layout: full card ─────────────────────────────────────
  return (
    <div className="page-container pt-safe pb-safe space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink-900 dark:text-white truncate">{auction.name}</p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${auction.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-ink-100 text-ink-400'}`}>
          {auction.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />}
          {auction.status.toUpperCase()}
        </span>
      </div>

      {/* Budget bars */}
      <BudgetBars teams={teams} budgetPerTeam={auction.budget_per_team} />

      {/* Active player spotlight */}
      <ActivePlayerSpotlight
        player={activePlayer}
        leadingTeam={leadingTeam}
        careerStats={activeCareerStats}
        onViewProfile={activePlayer?.player_id ? () => navigate(`/players/${activePlayer.player_id}`) : null}
      />

      {/* Pass indicator */}
      {activePlayer && <PassIndicator passTeam1={activePlayer.pass_team1} passTeam2={activePlayer.pass_team2} teamNames={teamNames} />}

      {isCaptain && (
        <CaptainControls
          auctionTeamId={myAuctionTeam?.id}
          activePlayer={activePlayer}
          bidIncrements={auction.bid_increments ?? [50, 100, 200, 500, 1000]}
          budgetRemaining={myAuctionTeam?.budget_remaining ?? 0}
          hasPassed={hasPassed}
          onBid={handleBid}
          onPass={handlePass}
          loading={actionLoading}
        />
      )}

      {/* Bid log */}
      <BidLog bids={bids} teams={teams} />

      {/* Pool / Held / Sold counters */}
      <div className="flex gap-2">
        {[
          { label: 'Pool', count: poolPlayers.length, onClick: () => setPoolSheetOpen(true) },
          { label: 'Held', count: heldPlayers.length, onClick: () => setHeldSheetOpen(true) },
          { label: 'Sold', count: soldPlayers.length, onClick: () => setSoldSheetOpen(true) },
        ].map(({ label, count, onClick }) => (
          <button key={label} onClick={onClick}
            className="flex-1 card py-2 flex flex-col items-center gap-0.5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
            <span className="text-base font-extrabold text-ink-900 dark:text-white tabular-nums">{count}</span>
            <span className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {/* Held Queue sheet */}
      <BottomSheet open={heldSheetOpen} onClose={() => setHeldSheetOpen(false)} title="Held Queue">
        <HeldQueue heldPlayers={heldPlayers} isAdmin={isAdmin} />
      </BottomSheet>

      {/* Pool sheet */}
      <BottomSheet open={poolSheetOpen} onClose={() => setPoolSheetOpen(false)} title="Player Pool">
        <div className="space-y-1.5">
          {poolPlayers.length === 0
            ? <p className="text-sm text-ink-400 text-center py-4">Pool is empty</p>
            : poolPlayers.map(ap => (
              <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-50 dark:bg-white/5">
                <PlayerAvatar player={ap.player} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                  <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                </div>
                <span className="text-xs tabular-nums text-ink-500">₹{ap.base_price?.toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      </BottomSheet>

      {/* Sold sheet — grouped by team */}
      <BottomSheet open={soldSheetOpen} onClose={() => setSoldSheetOpen(false)} title="Sold Players">
        {soldPlayers.length === 0
          ? <p className="text-sm text-ink-400 text-center py-4">No players sold yet</p>
          : (
            <div className="space-y-4">
              {teams.map(t => {
                const teamSold = soldByTeam[t.id] ?? [];
                const spent = teamSold.reduce((s, ap) => s + (ap.sold_price ?? 0), 0);
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">{t.name}</p>
                      <span className="text-xs tabular-nums text-ink-400">{teamSold.length} players · ₹{spent.toLocaleString()} spent</span>
                    </div>
                    {teamSold.length === 0
                      ? <p className="text-xs text-ink-300 py-1 px-2">None yet</p>
                      : teamSold.map(ap => (
                        <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 mb-1">
                          <PlayerAvatar player={ap.player} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                            <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                          </div>
                          <span className="text-sm font-bold text-brand-green tabular-nums">₹{ap.sold_price?.toLocaleString()}</span>
                        </div>
                      ))
                    }
                  </div>
                );
              })}
            </div>
          )
        }
      </BottomSheet>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Auction"
        message={`Permanently delete "${auction.name}"? All bids and player data will be lost.`}
        confirmLabel="Delete"
        danger
        disabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

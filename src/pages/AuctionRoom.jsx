import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuctionStore } from '../stores/auctionStore';
import { useAuctionRoom } from '../hooks/useAuctionRoom';
import { useRole } from '../hooks/useRole';
import * as auctionService from '../services/auctionService';
import ActivePlayerSpotlight from '../components/auction/ActivePlayerSpotlight';
import BudgetBars from '../components/auction/BudgetBars';
import BidLog from '../components/auction/BidLog';
import AuctioneerControls from '../components/auction/AuctioneerControls';
import CaptainControls from '../components/auction/CaptainControls';
import PassIndicator from '../components/auction/PassIndicator';
import HeldQueue from '../components/auction/HeldQueue';
import BottomSheet from '../components/shared/BottomSheet';

export default function AuctionRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, userId } = useRole();
  const [actionLoading, setActionLoading] = useState(false);
  const [heldSheetOpen, setHeldSheetOpen] = useState(false);
  const [poolSheetOpen, setPoolSheetOpen] = useState(false);
  const [soldSheetOpen, setSoldSheetOpen] = useState(false);

  useAuctionRoom(id);

  const { auction, teams, players, bids, isLoading, error, reset, _patchPlayer, _patchTeam, _appendBid, loadAuction } = useAuctionStore();

  // Clear stale auction data when leaving the room
  useEffect(() => () => reset(), []);

  const activePlayer = players.find(p => p.status === 'active') ?? null;
  const poolPlayers  = players.filter(p => p.status === 'pool');
  const heldPlayers  = players.filter(p => p.status === 'held').sort((a, b) => new Date(a.held_at) - new Date(b.held_at));
  const soldPlayers  = players.filter(p => p.status === 'sold');

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

  const hasPassed = activePlayer && myPassColumn
    ? !!activePlayer[myPassColumn]
    : false;

  const bothPassing = !!(activePlayer?.pass_team1 && activePlayer?.pass_team2);

  const leadingTeam = activePlayer?.leading_team_id
    ? teams.find(t => t.id === activePlayer.leading_team_id)
    : null;

  // Team names for PassIndicator — ordered by team slot
  const teamNames = teams.map(t => t.team?.name ?? '—');

  // ── Auctioneer handlers ───────────────────────────────────────────────────

  async function handleNextPlayer() {
    setActionLoading(true);
    try {
      const drawn = await auctionService.drawNextPlayer(id);
      if (drawn) {
        _patchPlayer(drawn);
      } else {
        toast('Auction complete!', { icon: '🏆' });
        loadAuction(id); // refresh auction status
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRaise(amount) {
    if (!activePlayer || !teams[0]) return;
    const targetTeamId = activePlayer.leading_team_id ?? teams[0]?.id;
    setActionLoading(true);
    try {
      const updated = await auctionService.raiseAuctioneerBid(activePlayer.id, targetTeamId, amount);
      _patchPlayer(updated);
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
      loadAuction(id); // refresh budgets + player statuses after deal
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

  // ── Captain handlers ───────────────────────────────────────────────────────

  async function handleBid(amount) {
    if (!activePlayer || !myAuctionTeam) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.placeBid(activePlayer.id, myAuctionTeam.id, amount);
      _patchPlayer(updated);
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
          <p className="font-semibold text-ink-700 dark:text-ink-200">
            {error ?? 'Auction not found'}
          </p>
          <p className="text-xs text-ink-400">
            {error?.includes('relation') || error?.includes('does not exist')
              ? 'Run migration 030_auctions.sql in Supabase SQL Editor first.'
              : 'The auction may have been deleted or you don\'t have access.'}
          </p>
        </div>
      </div>
    );
  }

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
      <ActivePlayerSpotlight player={activePlayer} leadingTeam={leadingTeam} />

      {/* Pass indicator */}
      {activePlayer && <PassIndicator passTeam1={activePlayer.pass_team1} passTeam2={activePlayer.pass_team2} teamNames={teamNames} />}

      {/* Role-gated controls */}
      {isAuctioneer && (
        <AuctioneerControls
          auctionId={id}
          activePlayer={activePlayer}
          bothPassing={bothPassing}
          onNextPlayer={handleNextPlayer}
          onRaise={handleRaise}
          onDeal={handleDeal}
          onHold={handleHold}
          onUnsold={handleUnsold}
          onPause={handlePause}
          onResume={handleResume}
          auctionStatus={auction.status}
          bidIncrements={auction.bid_increments ?? [50, 100, 200, 500, 1000]}
          loading={actionLoading}
        />
      )}

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
          <button
            key={label}
            onClick={onClick}
            className="flex-1 card py-3 flex flex-col items-center gap-0.5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-xl font-extrabold text-ink-900 dark:text-white tabular-nums">{count}</span>
            <span className="text-[11px] text-ink-400 uppercase tracking-wider font-semibold">{label}</span>
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
              <div key={ap.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-ink-50 dark:bg-white/5">
                <div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{ap.player?.name}</p>
                  <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                </div>
                <span className="text-xs tabular-nums text-ink-500">Base ₹{ap.base_price?.toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      </BottomSheet>

      {/* Sold sheet */}
      <BottomSheet open={soldSheetOpen} onClose={() => setSoldSheetOpen(false)} title="Sold Players">
        <div className="space-y-1.5">
          {soldPlayers.length === 0
            ? <p className="text-sm text-ink-400 text-center py-4">No players sold yet</p>
            : soldPlayers.map(ap => {
              const buyer = teams.find(t => t.id === ap.sold_to_team_id);
              return (
                <div key={ap.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10">
                  <div>
                    <p className="text-sm font-semibold text-ink-900 dark:text-white">{ap.player?.name}</p>
                    <p className="text-[11px] text-brand-green">{buyer?.team?.name ?? '—'}</p>
                  </div>
                  <span className="text-sm font-bold text-brand-green tabular-nums">₹{ap.sold_price?.toLocaleString()}</span>
                </div>
              );
            })
          }
        </div>
      </BottomSheet>
    </div>
  );
}

import { create } from 'zustand';
import * as auctionService from '../services/auctionService';

export const useAuctionStore = create((set, get) => ({
  auction: null,
  teams: [],
  players: [],
  bids: [],
  isLoading: false,
  error: null,

  // Live relay state — shared across all viewers via realtime transitions
  viewerDraw: null,   // { pool: AuctionPlayer[], winner: AuctionPlayer } | null
  soldFlash: null,    // { player, teamName, soldPrice } | null
  viewerCount: 0,

  async loadAuction(id) {
    set({ isLoading: true, error: null });
    try {
      const [auction, teams, players] = await Promise.all([
        auctionService.getAuction(id),
        auctionService.listAuctionTeams(id),
        auctionService.listAuctionPlayers(id),
      ]);
      const active = players.find(p => p.status === 'active');
      const bids = active ? await auctionService.getBidsForPlayer(active.id) : [];
      set({ auction, teams, players, bids, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  _onAuctionUpdate(row) {
    set({ auction: row });
  },

  _patchPlayer(updatedRow) {
    set(state => {
      const existing = state.players.find(p => p.id === updatedRow.id);
      // Preserve joined player data — realtime payloads don't carry joins
      const merged = { ...(existing ?? {}), ...updatedRow };

      // pool/held → active: trigger draw animation for all viewers
      // Only set if not already set (auctioneer may have called _startViewerDraw first)
      let viewerDraw = state.viewerDraw;
      if (updatedRow.status === 'active' && existing?.status !== 'active' && !state.viewerDraw) {
        const pool = state.players.filter(p => p.status === 'pool');
        viewerDraw = { pool: pool.length > 0 ? pool : [merged], winner: merged };
      }

      // active → sold: trigger SOLD! overlay for all viewers
      let soldFlash = state.soldFlash;
      if (updatedRow.status === 'sold' && existing?.status === 'active') {
        const soldTeam = state.teams.find(t => t.id === updatedRow.sold_to_team_id);
        soldFlash = {
          player: merged.player ?? null,
          teamName: soldTeam?.name ?? '—',
          soldPrice: updatedRow.sold_price ?? 0,
        };
      }

      const players = existing
        ? state.players.map(p => p.id === updatedRow.id ? merged : p)
        : [...state.players, merged];

      return { players, viewerDraw, soldFlash };
    });
    if (updatedRow.status === 'active') set({ bids: [] });
  },

  // Called by auctioneer before the DB round-trip completes so animation starts immediately
  _startViewerDraw(pool, winner) {
    set({ viewerDraw: { pool, winner } });
  },

  _clearViewerDraw() { set({ viewerDraw: null }); },
  _clearSoldFlash() { set({ soldFlash: null }); },
  _setViewerCount(count) { set({ viewerCount: count }); },

  _appendBid(bid) {
    set(state => ({ bids: [bid, ...state.bids].slice(0, 20) }));
  },

  _removeBid(bidId) {
    set(state => ({ bids: state.bids.filter(b => b.id !== bidId) }));
  },

  _patchTeam(updatedRow) {
    set(state => ({
      teams: state.teams.map(t => t.id === updatedRow.id ? { ...t, ...updatedRow } : t),
    }));
  },

  reset() {
    set({
      auction: null, teams: [], players: [], bids: [],
      isLoading: false, error: null,
      viewerDraw: null, soldFlash: null, viewerCount: 0,
    });
  },
}));

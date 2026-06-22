import { create } from 'zustand';
import * as auctionService from '../services/auctionService';

export const useAuctionStore = create((set, get) => ({
  auction: null,
  teams: [],
  players: [],
  bids: [],
  isLoading: false,
  error: null,

  async loadAuction(id) {
    set({ isLoading: true, error: null });
    try {
      const [auction, teams, players] = await Promise.all([
        auctionService.getAuction(id),
        auctionService.listAuctionTeams(id),
        auctionService.listAuctionPlayers(id),
      ]);
      // Load bids for current active player if any
      const active = players.find(p => p.status === 'active');
      const bids = active ? await auctionService.getBidsForPlayer(active.id) : [];
      set({ auction, teams, players, bids, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // Realtime patch handlers — called from useAuctionRoom hook
  _onAuctionUpdate(row) {
    set({ auction: row });
  },

  _patchPlayer(updatedRow) {
    set(state => {
      const exists = state.players.find(p => p.id === updatedRow.id);
      if (exists) {
        return { players: state.players.map(p => p.id === updatedRow.id ? { ...p, ...updatedRow } : p) };
      }
      // INSERT — new player added during setup
      return { players: [...state.players, updatedRow] };
    });
    // If the updated player is now active, clear bids (new player up for auction)
    if (updatedRow.status === 'active') {
      set({ bids: [] });
    }
  },

  _appendBid(bid) {
    set(state => ({ bids: [bid, ...state.bids].slice(0, 20) }));
  },

  _patchTeam(updatedRow) {
    set(state => ({
      teams: state.teams.map(t => t.id === updatedRow.id ? { ...t, ...updatedRow } : t),
    }));
  },

  reset() {
    set({ auction: null, teams: [], players: [], bids: [], isLoading: false, error: null });
  },
}));

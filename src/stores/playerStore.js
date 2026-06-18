import { create } from 'zustand';
import * as playerService from '../services/playerService';

export const usePlayerStore = create((set, get) => ({
  players: [],
  loading: false,

  async fetchPlayers(opts) {
    set({ loading: true });
    try {
      const players = await playerService.listPlayers(opts);
      set({ players, loading: false });
      return players;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  async addPlayer(payload) {
    const player = await playerService.createPlayer(payload);
    set({ players: [...get().players, player].sort((a, b) => a.name.localeCompare(b.name)) });
    return player;
  },

  async editPlayer(id, payload) {
    const player = await playerService.updatePlayer(id, payload);
    set({ players: get().players.map(p => (p.id === id ? player : p)) });
    return player;
  },

  async removePlayer(id) {
    const result = await playerService.deletePlayer(id);
    if (result.softDeleted) {
      set({ players: get().players.map(p => (p.id === id ? { ...p, is_active: false } : p)) });
    } else {
      set({ players: get().players.filter(p => p.id !== id) });
    }
    return result;
  },
}));

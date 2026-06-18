import { create } from 'zustand';
import * as tournamentService from '../services/tournamentService';

export const useTournamentStore = create((set, get) => ({
  tournaments: [],
  loading: false,

  async fetchTournaments() {
    set({ loading: true });
    const tournaments = await tournamentService.listTournaments();
    set({ tournaments, loading: false });
    return tournaments;
  },

  async addTournament(payload) {
    const t = await tournamentService.createTournament(payload);
    set({ tournaments: [t, ...get().tournaments] });
    return t;
  },

  async editTournament(id, payload) {
    const t = await tournamentService.updateTournament(id, payload);
    set({ tournaments: get().tournaments.map(x => (x.id === id ? t : x)) });
    return t;
  },

  async removeTournament(id) {
    await tournamentService.deleteTournament(id);
    set({ tournaments: get().tournaments.filter(t => t.id !== id) });
  },
}));

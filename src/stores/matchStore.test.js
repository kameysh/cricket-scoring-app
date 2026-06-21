import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock matchService before the store imports it ─────────────────────────────
vi.mock('../services/matchService', () => ({
  addSubPlayer: vi.fn(),
  setPlayerActive: vi.fn(),
  // stub everything else the store references at module level
  getMatch: vi.fn(),
  getMatchPlayers: vi.fn(),
  getInnings: vi.fn(),
  listMatches: vi.fn(),
  updateMatch: vi.fn(),
  createInnings: vi.fn(),
  deleteMatch: vi.fn(),
  autoAssignManOfMatch: vi.fn(),
  incrementMatchesPlayed: vi.fn(),
}));

// Zustand's `create` uses React internals — provide a minimal shim
vi.mock('zustand', async () => {
  const actual = await vi.importActual('zustand');
  return actual;
});

import * as matchService from '../services/matchService';
import { useMatchStore } from './matchStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function seedStore({ match, matchPlayers }) {
  // Directly mutate Zustand state via setState
  useMatchStore.setState({ match, matchPlayers });
}

const MATCH = { id: 'match-1', team1_name: 'A', team2_name: 'B' };

// ── swapPlayer ────────────────────────────────────────────────────────────────

describe('matchStore.swapPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedStore({
      match: MATCH,
      matchPlayers: [
        { id: 'mp-out', player_id: 'p-out', team: 1, is_active: true, players: { id: 'p-out', name: 'Outgoing' } },
        { id: 'mp-stay', player_id: 'p-stay', team: 1, is_active: true, players: { id: 'p-stay', name: 'Stays' } },
      ],
    });
  });

  it('inserts sub before deactivating outgoing (sequential order)', async () => {
    const calls = [];
    const newMp = { id: 'mp-sub', player_id: 'p-in', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out', players: { id: 'p-in', name: 'Sub' } };
    matchService.addSubPlayer.mockImplementation(async () => { calls.push('insert'); return newMp; });
    matchService.setPlayerActive.mockImplementation(async () => { calls.push('deactivate'); });

    await useMatchStore.getState().swapPlayer('mp-out', 'p-in', 1);

    expect(calls).toEqual(['insert', 'deactivate']);
  });

  it('does NOT call setPlayerActive if addSubPlayer throws', async () => {
    matchService.addSubPlayer.mockRejectedValue(new Error('DB error'));

    await expect(useMatchStore.getState().swapPlayer('mp-out', 'p-in', 1))
      .rejects.toThrow('DB error');

    expect(matchService.setPlayerActive).not.toHaveBeenCalled();
  });

  it('passes outMatchPlayerId as subbedOutPlayerId to addSubPlayer', async () => {
    const newMp = { id: 'mp-sub', player_id: 'p-in', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out' };
    matchService.addSubPlayer.mockResolvedValue(newMp);
    matchService.setPlayerActive.mockResolvedValue();

    await useMatchStore.getState().swapPlayer('mp-out', 'p-in', 1);

    expect(matchService.addSubPlayer).toHaveBeenCalledWith('match-1', 'p-in', 1, 'mp-out');
  });

  it('marks outgoing player inactive and appends sub in store state', async () => {
    const newMp = { id: 'mp-sub', player_id: 'p-in', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out' };
    matchService.addSubPlayer.mockResolvedValue(newMp);
    matchService.setPlayerActive.mockResolvedValue();

    await useMatchStore.getState().swapPlayer('mp-out', 'p-in', 1);

    const { matchPlayers } = useMatchStore.getState();
    expect(matchPlayers.find(mp => mp.id === 'mp-out').is_active).toBe(false);
    expect(matchPlayers.find(mp => mp.id === 'mp-stay').is_active).toBe(true);
    expect(matchPlayers.find(mp => mp.id === 'mp-sub')).toBeTruthy();
  });
});

// ── swapBack ──────────────────────────────────────────────────────────────────

describe('matchStore.swapBack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchService.setPlayerActive.mockResolvedValue();
  });

  it('finds the linked sub via subbed_out_player_id — not any active sub', async () => {
    seedStore({
      match: MATCH,
      matchPlayers: [
        { id: 'mp-orig-A', player_id: 'p-A', team: 1, is_active: false },
        { id: 'mp-orig-B', player_id: 'p-B', team: 1, is_active: false },
        { id: 'mp-sub-A', player_id: 'p-subA', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-orig-A' },
        { id: 'mp-sub-B', player_id: 'p-subB', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-orig-B' },
      ],
    });

    // Swap back player A — should deactivate sub-A, not sub-B
    await useMatchStore.getState().swapBack('mp-orig-A');

    const calls = matchService.setPlayerActive.mock.calls;
    expect(calls).toContainEqual(['mp-sub-A', false]);
    expect(calls).toContainEqual(['mp-orig-A', true]);
    // sub-B must NOT be touched
    expect(calls.map(c => c[0])).not.toContain('mp-sub-B');
  });

  it('throws if no active linked sub exists for the benched player', async () => {
    seedStore({
      match: MATCH,
      matchPlayers: [
        { id: 'mp-orig', player_id: 'p-orig', team: 1, is_active: false },
        // sub already deactivated (is_active: false)
        { id: 'mp-sub', player_id: 'p-sub', team: 1, is_substitute: true, is_active: false, subbed_out_player_id: 'mp-orig' },
      ],
    });

    await expect(useMatchStore.getState().swapBack('mp-orig'))
      .rejects.toThrow('No active sub found for this player');
  });

  it('updates store state correctly after swap back', async () => {
    seedStore({
      match: MATCH,
      matchPlayers: [
        { id: 'mp-orig', player_id: 'p-orig', team: 1, is_active: false },
        { id: 'mp-sub', player_id: 'p-sub', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-orig' },
      ],
    });

    await useMatchStore.getState().swapBack('mp-orig');

    const { matchPlayers } = useMatchStore.getState();
    expect(matchPlayers.find(mp => mp.id === 'mp-orig').is_active).toBe(true);
    expect(matchPlayers.find(mp => mp.id === 'mp-sub').is_active).toBe(false);
  });
});

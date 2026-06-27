import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock matchService before the store imports it ─────────────────────────────
vi.mock('../services/matchService', () => ({
  addSubPlayer: vi.fn(),
  setPlayerActive: vi.fn(),
  setPlayerInjured: vi.fn(),
  createSuperOverInnings: vi.fn(),
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

  it('does NOT mark injured for a plain tactical swap (injured omitted)', async () => {
    const newMp = { id: 'mp-sub', player_id: 'p-in', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out' };
    matchService.addSubPlayer.mockResolvedValue(newMp);
    matchService.setPlayerActive.mockResolvedValue();

    await useMatchStore.getState().swapPlayer('mp-out', 'p-in', 1);

    expect(matchService.setPlayerInjured).not.toHaveBeenCalled();
    expect(useMatchStore.getState().matchPlayers.find(mp => mp.id === 'mp-out').is_injured).toBeFalsy();
  });

  it('marks outgoing player injured when { injured: true } is passed', async () => {
    const newMp = { id: 'mp-sub', player_id: 'p-in', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out' };
    matchService.addSubPlayer.mockResolvedValue(newMp);
    matchService.setPlayerActive.mockResolvedValue();
    matchService.setPlayerInjured.mockResolvedValue();

    await useMatchStore.getState().swapPlayer('mp-out', 'p-in', 1, { injured: true });

    expect(matchService.setPlayerInjured).toHaveBeenCalledWith('mp-out', true);
    expect(useMatchStore.getState().matchPlayers.find(mp => mp.id === 'mp-out').is_injured).toBe(true);
  });
});

// ── swapBack ──────────────────────────────────────────────────────────────────

describe('matchStore.swapBack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchService.setPlayerActive.mockResolvedValue();
    matchService.setPlayerInjured.mockResolvedValue();
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

  it('clears the injured flag when an injured player is swapped back in', async () => {
    seedStore({
      match: MATCH,
      matchPlayers: [
        { id: 'mp-orig', player_id: 'p-orig', team: 1, is_active: false, is_injured: true },
        { id: 'mp-sub', player_id: 'p-sub', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-orig' },
      ],
    });

    await useMatchStore.getState().swapBack('mp-orig');

    expect(matchService.setPlayerInjured).toHaveBeenCalledWith('mp-orig', false);
    expect(useMatchStore.getState().matchPlayers.find(mp => mp.id === 'mp-orig').is_injured).toBe(false);
  });

  it('does NOT call setPlayerInjured for a tactical (non-injured) swap-back', async () => {
    seedStore({
      match: MATCH,
      matchPlayers: [
        { id: 'mp-orig', player_id: 'p-orig', team: 1, is_active: false }, // never injured
        { id: 'mp-sub', player_id: 'p-sub', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-orig' },
      ],
    });

    await useMatchStore.getState().swapBack('mp-orig');

    expect(matchService.setPlayerInjured).not.toHaveBeenCalled();
  });
});

// ── startSuperOverInnings ─────────────────────────────────────────────────────

describe('matchStore.startSuperOverInnings', () => {
  const MATCH_SO = { id: 'match-so', team1_name: 'A', team2_name: 'B' };
  const KEEPER_MP = { id: 'mp-k', player_id: 'k1', players: { id: 'k1', name: 'Keeper' }, is_keeper: true, team: 2 };

  function seedForSO(extraMatchPlayers = []) {
    useMatchStore.setState({
      match: MATCH_SO,
      innings: [
        { id: 'i1', innings_number: 1, is_completed: true },
        { id: 'i2', innings_number: 2, is_completed: true },
      ],
      matchPlayers: [KEEPER_MP, ...extraMatchPlayers],
      striker: 'old-p1',
      nonStriker: 'old-p2',
      bowler: 'old-b',
      deliveries: [{ id: 'd1' }],
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    const SO_INN = { id: 'i3', innings_number: 3, batting_team: 2, is_super_over: true, target: null,
      total_runs: 0, total_wickets: 0, total_legal_balls: 0, is_completed: false };
    matchService.createSuperOverInnings.mockResolvedValue(SO_INN);
  });

  it('calls createSuperOverInnings with correct innings number, batting team and no target', async () => {
    seedForSO();
    await useMatchStore.getState().startSuperOverInnings(2, null);
    expect(matchService.createSuperOverInnings).toHaveBeenCalledWith('match-so', 3, 2, null);
  });

  it('passes target to createSuperOverInnings for second SO innings', async () => {
    useMatchStore.setState({
      match: MATCH_SO,
      innings: [
        { id: 'i1', innings_number: 1, is_completed: true },
        { id: 'i2', innings_number: 2, is_completed: true },
        { id: 'i3', innings_number: 3, is_completed: true },
      ],
      matchPlayers: [KEEPER_MP],
    });
    const SO_INN4 = { id: 'i4', innings_number: 4, batting_team: 1, is_super_over: true, target: 13,
      total_runs: 0, total_wickets: 0, total_legal_balls: 0, is_completed: false };
    matchService.createSuperOverInnings.mockResolvedValue(SO_INN4);

    await useMatchStore.getState().startSuperOverInnings(1, 13);
    expect(matchService.createSuperOverInnings).toHaveBeenCalledWith('match-so', 4, 1, 13);
  });

  it('resets striker, nonStriker, bowler and deliveries in store', async () => {
    seedForSO();
    await useMatchStore.getState().startSuperOverInnings(2, null);
    const state = useMatchStore.getState();
    expect(state.striker).toBeNull();
    expect(state.nonStriker).toBeNull();
    expect(state.bowler).toBeNull();
    expect(state.deliveries).toEqual([]);
  });

  it('sets currentInnings to the newly created SO innings', async () => {
    seedForSO();
    await useMatchStore.getState().startSuperOverInnings(2, null);
    const { currentInnings } = useMatchStore.getState();
    expect(currentInnings.id).toBe('i3');
    expect(currentInnings.is_super_over).toBe(true);
  });

  it('appends new SO innings to the innings array', async () => {
    seedForSO();
    await useMatchStore.getState().startSuperOverInnings(2, null);
    const { innings } = useMatchStore.getState();
    expect(innings).toHaveLength(3);
    expect(innings[2].id).toBe('i3');
  });

  it('auto-sets keeper from matchPlayers for the bowling team', async () => {
    // batting_team=2, so bowling_team=1; keeper on team=2 should NOT be picked
    // Use keeper on team=1 (bowling team)
    const keeperTeam1 = { id: 'mp-k1', player_id: 'k-team1', players: { id: 'k-team1' }, is_keeper: true, team: 1 };
    useMatchStore.setState({
      match: MATCH_SO,
      innings: [{ id: 'i1', is_completed: true }, { id: 'i2', is_completed: true }],
      matchPlayers: [KEEPER_MP, keeperTeam1],
    });
    await useMatchStore.getState().startSuperOverInnings(2, null); // team 2 bats → team 1 bowls
    expect(useMatchStore.getState().keeper).toBe('k-team1');
  });
});

// ── setTotalOvers ───────────────────────────────────────────────────────────────

describe('matchStore.setTotalOvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchService.updateMatch.mockImplementation(async (_id, payload) => ({ ...MATCH, total_overs: 8, ...payload }));
  });

  function seed(total_legal_balls, extra = {}) {
    useMatchStore.setState({
      match: { ...MATCH, total_overs: 8 },
      currentInnings: { id: 'i1', total_legal_balls, is_super_over: false, ...extra },
    });
  }

  it('increases overs and updates the store match', async () => {
    seed(30); // 5.0 bowled
    const updated = await useMatchStore.getState().setTotalOvers(10);
    expect(matchService.updateMatch).toHaveBeenCalledWith('match-1', { total_overs: 10 });
    expect(updated.total_overs).toBe(10);
    expect(useMatchStore.getState().match.total_overs).toBe(10);
  });

  it('allows reducing to exactly the completed-over count (balls = N*6)', async () => {
    seed(30); // exactly 5.0 → minimum 5 overs
    await useMatchStore.getState().setTotalOvers(5);
    expect(matchService.updateMatch).toHaveBeenCalledWith('match-1', { total_overs: 5 });
  });

  it('rejects reducing below the over already in progress (5.1 → 5)', async () => {
    seed(31); // 5.1 bowled → minimum 6 overs
    await expect(useMatchStore.getState().setTotalOvers(5)).rejects.toMatchObject({ code: 'OVERS_TOO_LOW', minOvers: 6 });
    expect(matchService.updateMatch).not.toHaveBeenCalled();
  });

  it('refuses to change overs during a super over', async () => {
    seed(0, { is_super_over: true });
    await expect(useMatchStore.getState().setTotalOvers(2)).rejects.toThrow(/super over/i);
    expect(matchService.updateMatch).not.toHaveBeenCalled();
  });

  it('rejects non-integer / less-than-1 values', async () => {
    seed(0);
    await expect(useMatchStore.getState().setTotalOvers(0)).rejects.toThrow();
    await expect(useMatchStore.getState().setTotalOvers(3.5)).rejects.toThrow();
    expect(matchService.updateMatch).not.toHaveBeenCalled();
  });
});

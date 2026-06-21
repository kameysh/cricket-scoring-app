import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWinCondition } from './useWinCondition';

const BASE_MATCH = {
  team_size: 6,
  total_overs: 5,
  team1_name: 'Team A',
  team2_name: 'Team B',
  last_man_standing: false,
  super_over_enabled: true,
};

const INN1 = { id: 'i1', innings_number: 1, batting_team: 1, total_runs: 50, is_super_over: false };
const INN2_CHASING = { id: 'i2', innings_number: 2, batting_team: 2, total_runs: 0, total_wickets: 0, total_legal_balls: 0, is_super_over: false, target: 51 };

// Super over innings
const INN3 = { id: 'i3', innings_number: 3, batting_team: 2, total_runs: 12, is_super_over: true };
const INN4_CHASING = (runs, wickets, balls) => ({
  id: 'i4', innings_number: 4, batting_team: 1, total_runs: runs,
  total_wickets: wickets, total_legal_balls: balls, is_super_over: true, target: 13,
});

describe('useWinCondition — early returns / guard clauses', () => {
  it('returns null when match is null', () => {
    const { result } = renderHook(() =>
      useWinCondition({ match: null, currentInnings: INN1, innings: [INN1] })
    );
    expect(result.current).toBeNull();
  });

  it('returns null when currentInnings is null', () => {
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: null, innings: [] })
    );
    expect(result.current).toBeNull();
  });

  it('returns null for innings 1 (regular first innings)', () => {
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: INN1, innings: [INN1] })
    );
    expect(result.current).toBeNull();
  });

  it('returns null for SO innings 3 (first super over innings — odd)', () => {
    const soInn3 = { id: 'i3', innings_number: 3, batting_team: 2, total_runs: 0,
      total_wickets: 0, total_legal_balls: 0, is_super_over: true, target: null };
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: soInn3, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, soInn3] })
    );
    expect(result.current).toBeNull();
  });
});

describe('useWinCondition — regular innings 2', () => {
  it('returns null when currentInnings is innings 1', () => {
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: INN1, innings: [INN1] })
    );
    expect(result.current).toBeNull();
  });

  it('returns null when innings 2 not yet won', () => {
    const inn2 = { ...INN2_CHASING, total_runs: 10, total_wickets: 0, total_legal_balls: 6 };
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn2, innings: [INN1, inn2] })
    );
    expect(result.current).toBeNull();
  });

  it('detects win by wickets when team 2 passes target', () => {
    const inn2 = { ...INN2_CHASING, total_runs: 51, total_wickets: 1, total_legal_balls: 12 };
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn2, innings: [INN1, inn2] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team B');
    expect(result.current?.type).toBe('wickets');
  });

  it('detects last-ball win — ballsRemaining=0', () => {
    const inn2 = { ...INN2_CHASING, total_runs: 51, total_wickets: 0, total_legal_balls: 30 }; // all 30 balls used
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn2, innings: [INN1, inn2] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.lastBall).toBe(true);
  });

  it('detects win by runs when innings 2 is all-out with fewer runs', () => {
    const inn2 = { ...INN2_CHASING, total_runs: 30, total_wickets: 5, total_legal_balls: 20, is_super_over: false };
    // isAllOut = team_size-1 = 5 wickets
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn2, innings: [INN1, inn2] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team A'); // INN1 batting_team=1 = Team A
    expect(result.current?.type).toBe('runs');
  });

  it('detects tie when innings 2 is all-out with equal runs', () => {
    const inn2 = { ...INN2_CHASING, total_runs: 50, total_wickets: 5, total_legal_balls: 20 };
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn2, innings: [INN1, inn2] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.type).toBe('tie');
    expect(result.current?.winner).toBeNull();
  });

  it('correctly identifies team names from batting_team field (not match position)', () => {
    // team2 batted FIRST (batting_team=2), team1 chasing
    const inn1Team2 = { ...INN1, batting_team: 2, total_runs: 50 };
    const inn2Team1 = { ...INN2_CHASING, batting_team: 1, total_runs: 51, total_wickets: 0, total_legal_balls: 12 };
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn2Team1, innings: [inn1Team2, inn2Team1] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team A'); // batting_team=1 → team1_name
  });
});

describe('useWinCondition — super over', () => {
  it('returns null when currentInnings is super over innings 3 (not the second SO innings)', () => {
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: INN3, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3] })
    );
    expect(result.current).toBeNull();
  });

  it('detects win by wickets when SO innings 4 passes target', () => {
    const inn4 = INN4_CHASING(14, 0, 3);
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn4, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, inn4] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team A'); // batting_team=1 = Team A
    expect(result.current?.type).toBe('super_over');
  });

  it('detects win by runs when SO innings 4 is all out (2 wickets) with fewer runs', () => {
    const inn4 = INN4_CHASING(8, 2, 4); // all out at 2 wickets
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn4, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, inn4] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team B'); // SO innings 3 batting_team=2
    expect(result.current?.type).toBe('super_over');
  });

  it('uses 6 balls as the over limit for super over', () => {
    const inn4 = INN4_CHASING(8, 0, 6); // overs complete, team B wins
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn4, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, inn4] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team B');
  });

  it('returns tie result type if SO is also tied — triggering another SO', () => {
    const inn4 = INN4_CHASING(12, 0, 6); // same as INN3 runs at overs complete
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn4, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, inn4] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.type).toBe('tie');
  });

  it('tags SO win with type=super_over (not wickets/runs)', () => {
    const inn4 = INN4_CHASING(14, 0, 3);
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn4, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, inn4] })
    );
    expect(result.current?.type).toBe('super_over');
    expect(result.current?.summary).toMatch(/won Super Over by/);
  });

  it('SO win by runs (all-out, fewer runs) also tagged super_over', () => {
    const inn4 = INN4_CHASING(8, 2, 4); // 2 wickets = all out in SO
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn4, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, inn4] })
    );
    expect(result.current?.type).toBe('super_over');
  });

  it('handles successive SO (innings 6) — win by wickets', () => {
    // SO2: innings 5 (batting_team 1) and innings 6 (batting_team 2, target 9)
    const inn5 = { id: 'i5', innings_number: 5, batting_team: 1, total_runs: 8, is_super_over: true };
    const inn6 = { id: 'i6', innings_number: 6, batting_team: 2, total_runs: 9, total_wickets: 1, total_legal_balls: 4, is_super_over: true, target: 9 };
    const { result } = renderHook(() =>
      useWinCondition({ match: BASE_MATCH, currentInnings: inn6, innings: [INN1, { ...INN2_CHASING, total_runs: 50 }, INN3, INN4_CHASING(12, 0, 6), inn5, inn6] })
    );
    expect(result.current?.won).toBe(true);
    expect(result.current?.winner).toBe('Team B'); // batting_team=2
    expect(result.current?.type).toBe('super_over');
  });
});

import { describe, it, expect } from 'vitest';
import { checkWinCondition } from './scoringService';

const base = {
  inningsNumber: 2,
  teamSize: 11,
  team1Name: 'Team A',
  team2Name: 'Team B',
  wicketsFallen: 2,
  ballsRemaining: 6,
  isAllOut: false,
  oversCompleted: false,
};

describe('checkWinCondition', () => {
  it('returns null during first innings', () => {
    expect(checkWinCondition({ ...base, inningsNumber: 1, team1Total: 100, team2Total: 0 })).toBeNull();
  });

  it('team2 wins by wickets when they pass team1 total', () => {
    const result = checkWinCondition({ ...base, team1Total: 80, team2Total: 81 });
    expect(result.won).toBe(true);
    expect(result.winner).toBe('Team B');
    expect(result.type).toBe('wickets');
    expect(result.margin).toBe(8); // 11 - 1 - 2 = 8
  });

  it('summary includes "off the last ball!" when ballsRemaining is 0', () => {
    const result = checkWinCondition({ ...base, team1Total: 80, team2Total: 81, ballsRemaining: 0 });
    expect(result.summary).toContain('off the last ball!');
  });

  it('team1 wins by runs when team2 all out below team1 total', () => {
    const result = checkWinCondition({ ...base, team1Total: 100, team2Total: 87, isAllOut: true });
    expect(result.won).toBe(true);
    expect(result.winner).toBe('Team A');
    expect(result.type).toBe('runs');
    expect(result.margin).toBe(13);
  });

  it('team1 wins by runs when overs complete and team2 behind', () => {
    const result = checkWinCondition({ ...base, team1Total: 100, team2Total: 90, oversCompleted: true });
    expect(result.won).toBe(true);
    expect(result.winner).toBe('Team A');
    expect(result.type).toBe('runs');
  });

  it('tie when scores are equal and team2 all out', () => {
    const result = checkWinCondition({ ...base, team1Total: 80, team2Total: 80, isAllOut: true });
    expect(result.won).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.type).toBe('tie');
    expect(result.margin).toBe(0);
  });

  it('returns null when team2 is behind but innings still active', () => {
    const result = checkWinCondition({ ...base, team1Total: 100, team2Total: 70, ballsRemaining: 6 });
    expect(result).toBeNull();
  });

  it('team2 wins by 0 wickets (all 10 fallen) when scores pass exactly', () => {
    const result = checkWinCondition({ ...base, team1Total: 100, team2Total: 101, wicketsFallen: 10 });
    expect(result.margin).toBe(0);
    expect(result.winner).toBe('Team B');
  });
});

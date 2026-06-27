import { describe, it, expect, vi } from 'vitest';

// Mock supabase before importing playerService
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { getPlayerMatchCounts, getPlayerInningsCounts, getPlayerSeriesStats, getSeriesMatchIds } from './playerService';
import { supabase } from '../lib/supabase';

function mockFrom(data) {
  const chain = { select: vi.fn().mockResolvedValue({ data, error: null }) };
  supabase.from.mockReturnValue(chain);
  return chain;
}

describe('getPlayerMatchCounts', () => {
  it('counts distinct matches per player correctly', async () => {
    mockFrom([
      { player_id: 'p1', match_id: 'm1' },
      { player_id: 'p1', match_id: 'm2' },
      { player_id: 'p2', match_id: 'm1' },
    ]);
    const result = await getPlayerMatchCounts();
    expect(result['p1']).toBe(2);
    expect(result['p2']).toBe(1);
  });

  it('does not double-count the same match for a player', async () => {
    mockFrom([
      { player_id: 'p1', match_id: 'm1' },
      { player_id: 'p1', match_id: 'm1' }, // duplicate row
    ]);
    const result = await getPlayerMatchCounts();
    expect(result['p1']).toBe(1);
  });

  it('returns empty object when no match_players rows exist', async () => {
    mockFrom([]);
    const result = await getPlayerMatchCounts();
    expect(result).toEqual({});
  });

  it('handles null data gracefully', async () => {
    const chain = { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    supabase.from.mockReturnValue(chain);
    const result = await getPlayerMatchCounts();
    expect(result).toEqual({});
  });

  it('each player is independently counted', async () => {
    mockFrom([
      { player_id: 'a', match_id: 'x' },
      { player_id: 'b', match_id: 'x' },
      { player_id: 'b', match_id: 'y' },
      { player_id: 'c', match_id: 'y' },
      { player_id: 'c', match_id: 'z' },
    ]);
    const result = await getPlayerMatchCounts();
    expect(result['a']).toBe(1);
    expect(result['b']).toBe(2);
    expect(result['c']).toBe(2);
  });
});

// Fluent chain where every filter method returns `this`, resolved via .then()
function makeFluentChain(data, error = null) {
  const c = {};
  ['select', 'neq', 'gt', 'in', 'eq', 'order', 'limit'].forEach(m => { c[m] = vi.fn().mockReturnValue(c); });
  c.then = (resolve) => Promise.resolve({ data, error }).then(resolve);
  c.single = vi.fn().mockResolvedValue({ data, error });
  c.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return c;
}

describe('getPlayerInningsCounts', () => {
  it('counts batting innings excluding yet_to_bat rows', async () => {
    // DB filters yet_to_bat via .neq() — mock returns pre-filtered rows
    supabase.from.mockImplementation(table =>
      makeFluentChain(
        table === 'batting_scorecards'
          ? [{ player_id: 'p1' }, { player_id: 'p1' }, { player_id: 'p2' }]
          : []
      )
    );
    const { batInnings } = await getPlayerInningsCounts();
    expect(batInnings['p1']).toBe(2);
    expect(batInnings['p2']).toBe(1);
  });

  it('counts bowling innings excluding rows with 0 legal balls', async () => {
    // DB filters 0-ball rows via .gt() — mock returns pre-filtered rows
    supabase.from.mockImplementation(table =>
      makeFluentChain(
        table === 'bowling_scorecards'
          ? [{ player_id: 'p1' }, { player_id: 'p2' }]
          : []
      )
    );
    const { bowlInnings } = await getPlayerInningsCounts();
    expect(bowlInnings['p1']).toBe(1);
    expect(bowlInnings['p2']).toBe(1);
  });

  it('returns empty objects when no scorecard rows exist', async () => {
    supabase.from.mockImplementation(() => makeFluentChain([]));
    const { batInnings, bowlInnings } = await getPlayerInningsCounts();
    expect(batInnings).toEqual({});
    expect(bowlInnings).toEqual({});
  });

  it('handles null data from both tables', async () => {
    supabase.from.mockImplementation(() => makeFluentChain(null));
    const { batInnings, bowlInnings } = await getPlayerInningsCounts();
    expect(batInnings).toEqual({});
    expect(bowlInnings).toEqual({});
  });
});

describe('getSeriesMatchIds', () => {
  it('returns empty array when series has no tournaments', async () => {
    supabase.from.mockImplementation(table => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      if (table === 'tournaments') chain.then = (r) => Promise.resolve({ data: [], error: null }).then(r);
      return chain;
    });
    const result = await getSeriesMatchIds('s1');
    expect(result).toEqual([]);
  });

  it('returns match IDs from all series tournaments', async () => {
    supabase.from.mockImplementation(table => {
      const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn() };
      if (table === 'tournaments') {
        chain.then = (r) => Promise.resolve({ data: [{ id: 't1' }, { id: 't2' }], error: null }).then(r);
      } else {
        chain.select = vi.fn().mockReturnThis();
        chain.in = vi.fn().mockResolvedValue({ data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], error: null });
      }
      return chain;
    });
    const result = await getSeriesMatchIds('s1');
    expect(result).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('getPlayerSeriesStats', () => {
  it('returns null when player has no stats in series tournaments', async () => {
    supabase.from.mockImplementation(table => {
      const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn() };
      if (table === 'tournaments') {
        chain.then = (r) => Promise.resolve({ data: [{ id: 't1' }], error: null }).then(r);
      } else {
        chain.select = vi.fn().mockReturnThis();
        chain.eq = vi.fn().mockReturnThis();
        chain.in = vi.fn().mockResolvedValue({ data: [], error: null });
      }
      return chain;
    });
    const result = await getPlayerSeriesStats('p1', 's1');
    expect(result).toBeNull();
  });

  it('aggregates stats across multiple tournament rows', async () => {
    supabase.from.mockImplementation(table => {
      const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn() };
      if (table === 'tournaments') {
        chain.then = (r) => Promise.resolve({ data: [{ id: 't1' }, { id: 't2' }], error: null }).then(r);
      } else {
        chain.select = vi.fn().mockReturnThis();
        chain.eq = vi.fn().mockReturnThis();
        chain.in = vi.fn().mockResolvedValue({
          data: [
            { bat_runs: 40, bat_innings: 2, bat_not_outs: 0, bat_balls: 50, bat_highest_score: 25, bat_fours: 3, bat_sixes: 1, bat_ducks: 0, bat_thirties: 1, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 10, bat_ones: 5, bat_twos: 2, bat_threes: 0, bat_matches: 1, bowl_wickets: 2, bowl_runs: 30, bowl_legal_balls: 18, bowl_maidens: 1, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0, bowl_best_wickets: 2, bowl_best_runs: 15, bowl_matches: 1, bowl_innings: 1, field_catches: 1, field_stumpings: 0, field_run_outs: 0 },
            { bat_runs: 60, bat_innings: 2, bat_not_outs: 1, bat_balls: 45, bat_highest_score: 55, bat_fours: 4, bat_sixes: 2, bat_ducks: 1, bat_thirties: 0, bat_fifties: 1, bat_hundreds: 0, bat_dot_balls: 8, bat_ones: 6, bat_twos: 1, bat_threes: 0, bat_matches: 1, bowl_wickets: 3, bowl_runs: 20, bowl_legal_balls: 12, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0, bowl_best_wickets: 3, bowl_best_runs: 12, bowl_matches: 1, bowl_innings: 1, field_catches: 2, field_stumpings: 0, field_run_outs: 1 },
          ],
          error: null,
        });
      }
      return chain;
    });
    const result = await getPlayerSeriesStats('p1', 's1');
    expect(result).not.toBeNull();
    expect(result.bat_runs).toBe(100);
    expect(result.bat_innings).toBe(4);
    expect(result.bat_not_outs).toBe(1);
    expect(result.bat_highest_score).toBe(55); // max
    expect(result.bat_fifties).toBe(1);
    expect(result.bowl_wickets).toBe(5);
    expect(result.bowl_best_wickets).toBe(3); // better figures
    expect(result.field_catches).toBe(3);
  });
});

describe('getBowlingHeadToHeadAll', () => {
  function mockDeliveries(rows, capture) {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn((col, val) => { capture && capture.push([col, val]); return chain; }),
      then: (r) => Promise.resolve({ data: rows, error: null }).then(r),
    };
    supabase.from.mockReturnValue(chain);
  }

  it('aggregates wickets/runs/balls per batsman from the bowler side', async () => {
    const { getBowlingHeadToHeadAll } = await import('./playerService');
    mockDeliveries([
      { batsman_id: 'naveen', batsman: { name: 'Naveen' }, runs_off_bat: 0, extra_type: 'none', total_runs_on_delivery: 0, is_wicket: true,  wicket_type: 'bowled', is_legal_delivery: true },
      { batsman_id: 'naveen', batsman: { name: 'Naveen' }, runs_off_bat: 4, extra_type: 'none', total_runs_on_delivery: 4, is_wicket: false, wicket_type: null,     is_legal_delivery: true },
      { batsman_id: 'naveen', batsman: { name: 'Naveen' }, runs_off_bat: 0, extra_type: 'wide', extra_runs: 1, total_runs_on_delivery: 1, is_wicket: false, is_legal_delivery: false }, // wide: +1 run, not a ball
      { batsman_id: 'sarath', batsman: { name: 'Sarath' }, runs_off_bat: 1, extra_type: 'none', total_runs_on_delivery: 1, is_wicket: true,  wicket_type: 'caught', is_legal_delivery: true },
    ]);
    const res = await getBowlingHeadToHeadAll('santosh', null);
    const naveen = res.find(r => r.batsmanId === 'naveen');
    const sarath = res.find(r => r.batsmanId === 'sarath');
    expect(naveen).toMatchObject({ batsmanName: 'Naveen', balls: 2, runs: 5, wickets: 1 }); // 2 legal, 0+4+1(wide)=5, 1 wkt
    expect(sarath).toMatchObject({ batsmanName: 'Sarath', balls: 1, runs: 1, wickets: 1 });
    expect(res[0].batsmanId).toBe('naveen'); // tie on wickets → more balls first
  });

  it('excludes byes/leg-byes from runs conceded', async () => {
    const { getBowlingHeadToHeadAll } = await import('./playerService');
    mockDeliveries([
      { batsman_id: 'b1', batsman: { name: 'B1' }, runs_off_bat: 0, extra_type: 'bye', extra_runs: 4, total_runs_on_delivery: 4, is_wicket: false, is_legal_delivery: true },
    ]);
    const res = await getBowlingHeadToHeadAll('x', null);
    expect(res[0].runs).toBe(0); // 4 byes do not count against the bowler
  });

  it('filters by inningsIds when provided', async () => {
    const { getBowlingHeadToHeadAll } = await import('./playerService');
    const calls = [];
    mockDeliveries([], calls);
    await getBowlingHeadToHeadAll('x', ['i1', 'i2']);
    expect(calls).toContainEqual(['innings_id', ['i1', 'i2']]);
  });
});

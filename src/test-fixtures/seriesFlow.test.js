/**
 * End-to-end series flow test.
 *
 * Uses realistic fixture data (cricketFixtures.js) to verify:
 *  1. getSeriesPlayerStats aggregates both seasons correctly
 *  2. getPlayerSeriesStats aggregates one player's stats across seasons
 *  3. getSeriesMatchIds returns match IDs from all series tournaments
 *  4. getHeadToHeadAll scoped to series innings only (no cross-series bleed)
 *  5. Leaderboard batting/bowling ordering is correct for series-filtered data
 *  6. Expected computed batting avg / bowling avg / SR / economy are correct
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IDS,
  SERIES,
  TOURNAMENTS,
  MATCHES,
  INNINGS,
  ALL_TOURNAMENT_STATS,
  TOURNAMENT_STATS_S1,
  TOURNAMENT_STATS_S2,
  ALL_DELIVERIES,
  DELIVERIES_S1_INN1,
  EXPECTED_SERIES_STATS,
  EXPECTED_BAT_RANK,
  EXPECTED_BOWL_RANK,
} from './cricketFixtures.js';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
import { supabase } from '../lib/supabase';

import {
  getSeriesPlayerStats,
} from '../services/seriesService.js';

import {
  getHeadToHeadAll,
  getPlayerSeriesStats,
  getSeriesMatchIds,
} from '../services/playerService.js';

import {
  calcBattingAverage,
  calcStrikeRate,
  calcBowlingAverage,
  calcEconomy,
  fmt,
} from '../lib/cricketUtils.js';

// Chainable Supabase query builder that returns result at the end of the chain.
function makeChain(result) {
  const c = {};
  ['select','insert','delete','update','eq','neq','in','order','limit','maybeSingle','single'].forEach(m => {
    c[m] = vi.fn(() => c);
  });
  c.then = (res, rej) => Promise.resolve(result).then(res, rej);
  c.single = vi.fn(() => Promise.resolve(result));
  c.maybeSingle = vi.fn(() => Promise.resolve(result));
  return c;
}

// Multi-table mock — returns different data per table name.
function mockTables(tableMap) {
  supabase.from.mockImplementation(table => {
    const result = tableMap[table] ?? { data: [], error: null };
    return makeChain(result);
  });
}

beforeEach(() => { vi.clearAllMocks(); });

// ── 1. getSeriesPlayerStats ───────────────────────────────────────────────────

describe('getSeriesPlayerStats — full season aggregation', () => {
  function setupMock() {
    supabase.from.mockImplementation(table => {
      if (table === 'tournaments') return makeChain({ data: TOURNAMENTS, error: null });
      if (table === 'player_tournament_stats') return makeChain({ data: ALL_TOURNAMENT_STATS, error: null });
      return makeChain({ data: [], error: null });
    });
  }

  it('returns one row per player (4 players across 2 seasons)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    expect(result).toHaveLength(4);
  });

  it('Kamesh: sums bat_runs across both seasons (45 + 60 = 105)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const kamesh = result.find(r => r.player_id === IDS.kamesh);
    expect(kamesh.bat_runs).toBe(105);
  });

  it('Kamesh: bat_highest_score is MAX not sum (max of 45 and 60 = 60)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const kamesh = result.find(r => r.player_id === IDS.kamesh);
    expect(kamesh.bat_highest_score).toBe(60);
  });

  it('Kamesh: sums bowling wickets (1 + 2 = 3)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const kamesh = result.find(r => r.player_id === IDS.kamesh);
    expect(kamesh.bowl_wickets).toBe(3);
  });

  it('Arjun: sums bat_runs across both seasons (30 + 50 = 80)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const arjun = result.find(r => r.player_id === IDS.arjun);
    expect(arjun.bat_runs).toBe(80);
  });

  it('Arjun: sums bowling wickets (2 + 3 = 5)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const arjun = result.find(r => r.player_id === IDS.arjun);
    expect(arjun.bowl_wickets).toBe(5);
  });

  it('Arjun: bat_highest_score is MAX (max of 30 and 50 = 50)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const arjun = result.find(r => r.player_id === IDS.arjun);
    expect(arjun.bat_highest_score).toBe(50);
  });

  it('Divya: sums bat_runs across both seasons (20 + 8 = 28)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const divya = result.find(r => r.player_id === IDS.divya);
    expect(divya.bat_runs).toBe(28);
  });

  it('Divya: sums bat_not_outs (1 not out + 0 not outs = 1)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const divya = result.find(r => r.player_id === IDS.divya);
    expect(divya.bat_not_outs).toBe(1);
  });

  it('Ravi: sums bat_runs (40 + 15 = 55)', async () => {
    setupMock();
    const result = await getSeriesPlayerStats(IDS.series);
    const ravi = result.find(r => r.player_id === IDS.ravi);
    expect(ravi.bat_runs).toBe(55);
  });

  it('returns empty array when series has no tournaments', async () => {
    supabase.from.mockImplementation(() => makeChain({ data: [], error: null }));
    const result = await getSeriesPlayerStats('nonexistent');
    expect(result).toEqual([]);
  });
});

// ── 2. getPlayerSeriesStats ───────────────────────────────────────────────────

describe('getPlayerSeriesStats — single player across series', () => {
  function setupMock() {
    supabase.from.mockImplementation(table => {
      if (table === 'tournaments') return makeChain({ data: TOURNAMENTS, error: null });
      if (table === 'player_tournament_stats') {
        const kameshRows = ALL_TOURNAMENT_STATS.filter(r => r.player_id === IDS.kamesh);
        return makeChain({ data: kameshRows, error: null });
      }
      return makeChain({ data: [], error: null });
    });
  }

  it('returns non-null stats for Kamesh', async () => {
    setupMock();
    const result = await getPlayerSeriesStats(IDS.kamesh, IDS.series);
    expect(result).not.toBeNull();
  });

  it('Kamesh: bat_runs = 105', async () => {
    setupMock();
    const result = await getPlayerSeriesStats(IDS.kamesh, IDS.series);
    expect(result.bat_runs).toBe(105);
  });

  it('Kamesh: bat_highest_score = 60 (MAX)', async () => {
    setupMock();
    const result = await getPlayerSeriesStats(IDS.kamesh, IDS.series);
    expect(result.bat_highest_score).toBe(60);
  });

  it('Kamesh: bowl_best_wickets = 2 (best figures across seasons)', async () => {
    setupMock();
    const result = await getPlayerSeriesStats(IDS.kamesh, IDS.series);
    expect(result.bowl_best_wickets).toBe(2);
  });

  it('Kamesh: bat_fifties = 1 (only season 2 had a fifty)', async () => {
    setupMock();
    const result = await getPlayerSeriesStats(IDS.kamesh, IDS.series);
    expect(result.bat_fifties).toBe(1);
  });

  it('returns null when player has no stats in the series', async () => {
    supabase.from.mockImplementation(table => {
      if (table === 'tournaments') return makeChain({ data: TOURNAMENTS, error: null });
      return makeChain({ data: [], error: null });
    });
    const result = await getPlayerSeriesStats('player-unknown', IDS.series);
    expect(result).toBeNull();
  });
});

// ── 3. getSeriesMatchIds ──────────────────────────────────────────────────────

describe('getSeriesMatchIds', () => {
  it('returns both match IDs for a 2-tournament series', async () => {
    supabase.from.mockImplementation(table => {
      if (table === 'tournaments') return makeChain({ data: TOURNAMENTS, error: null });
      if (table === 'matches') return makeChain({ data: MATCHES, error: null });
      return makeChain({ data: [], error: null });
    });
    const result = await getSeriesMatchIds(IDS.series);
    expect(result).toHaveLength(2);
    expect(result).toContain(IDS.match1);
    expect(result).toContain(IDS.match2);
  });

  it('returns empty array when series has no tournaments', async () => {
    supabase.from.mockImplementation(() => makeChain({ data: [], error: null }));
    const result = await getSeriesMatchIds('no-series');
    expect(result).toEqual([]);
  });
});

// ── 4. H2H filtered by series innings ────────────────────────────────────────

// Smart mock that actually applies innings_id filter like real Supabase would.
function makeFilteringDeliveryMock(allDeliveries) {
  supabase.from.mockImplementation(() => {
    const state = { inningsFilter: null };
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn((col, vals) => { if (col === 'innings_id') state.inningsFilter = vals; return chain; }),
      then: (res, rej) => {
        const data = state.inningsFilter
          ? allDeliveries.filter(d => state.inningsFilter.includes(d.innings_id))
          : allDeliveries;
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    return chain;
  });
}

describe('getHeadToHeadAll — series innings filter', () => {
  const seriesInningsIds = [IDS.inn_s1_1, IDS.inn_s1_2, IDS.inn_s2_1, IDS.inn_s2_2];

  it('shows Arjun when scoped to series innings (Arjun bowled to Kamesh in both seasons)', async () => {
    makeFilteringDeliveryMock(ALL_DELIVERIES);
    const result = await getHeadToHeadAll(IDS.kamesh, seriesInningsIds);
    const arjunEntry = result.find(e => e.bowlerId === IDS.arjun);
    expect(arjunEntry).toBeDefined();
  });

  it('H2H totals: Kamesh faced 9 legal balls from Arjun across both seasons', async () => {
    makeFilteringDeliveryMock(ALL_DELIVERIES);
    const result = await getHeadToHeadAll(IDS.kamesh, seriesInningsIds);
    const arjunEntry = result.find(e => e.bowlerId === IDS.arjun);
    // 6 balls (season 1) + 3 balls (season 2) = 9
    expect(arjunEntry.balls).toBe(9);
  });

  it('H2H: Kamesh dismissed twice by Arjun across the series (bowled S1 + caught S2)', async () => {
    makeFilteringDeliveryMock(ALL_DELIVERIES);
    const result = await getHeadToHeadAll(IDS.kamesh, seriesInningsIds);
    const arjunEntry = result.find(e => e.bowlerId === IDS.arjun);
    expect(arjunEntry.dismissals).toBe(2);
  });

  it('when scoped to season-1 innings only, shows 6 balls and 1 dismissal (not 9/2)', async () => {
    makeFilteringDeliveryMock(ALL_DELIVERIES);
    const s1InningsOnly = [IDS.inn_s1_1, IDS.inn_s1_2];
    const result = await getHeadToHeadAll(IDS.kamesh, s1InningsOnly);
    const arjunEntry = result.find(e => e.bowlerId === IDS.arjun);
    expect(arjunEntry?.balls).toBe(6);
    expect(arjunEntry?.dismissals).toBe(1);
  });

  it('when no inningsIds filter (null) — returns all-time data without filtering', async () => {
    makeFilteringDeliveryMock(ALL_DELIVERIES);
    const result = await getHeadToHeadAll(IDS.kamesh, null);
    const arjunEntry = result.find(e => e.bowlerId === IDS.arjun);
    expect(arjunEntry?.balls).toBe(9); // all 9 balls included
  });
});

// ── 5. Leaderboard ordering ───────────────────────────────────────────────────

describe('Leaderboard ordering with series-aggregated data', () => {
  let seriesStats;

  beforeEach(async () => {
    supabase.from.mockImplementation(table => {
      if (table === 'tournaments') return makeChain({ data: TOURNAMENTS, error: null });
      if (table === 'player_tournament_stats') return makeChain({ data: ALL_TOURNAMENT_STATS, error: null });
      return makeChain({ data: [], error: null });
    });
    seriesStats = await getSeriesPlayerStats(IDS.series);
  });

  it('batting order: Kamesh(105) > Arjun(80) > Ravi(55) > Divya(28)', () => {
    const ranked = [...seriesStats]
      .filter(s => s.bat_innings > 0)
      .sort((a, b) => b.bat_runs - a.bat_runs)
      .map(r => r.player_id);
    expect(ranked).toEqual(EXPECTED_BAT_RANK);
  });

  it('bowling order: Arjun(5 wkts) > Kamesh(3 wkts)', () => {
    const ranked = [...seriesStats]
      .filter(s => s.bowl_legal_balls > 0)
      .sort((a, b) => b.bowl_wickets - a.bowl_wickets)
      .map(r => r.player_id);
    expect(ranked[0]).toBe(IDS.arjun);
    expect(ranked[1]).toBe(IDS.kamesh);
  });
});

// ── 6. Computed stat accuracy (avg / SR / economy) ───────────────────────────

describe('Computed stats from series aggregates', () => {
  let seriesStats;

  beforeEach(async () => {
    supabase.from.mockImplementation(table => {
      if (table === 'tournaments') return makeChain({ data: TOURNAMENTS, error: null });
      if (table === 'player_tournament_stats') return makeChain({ data: ALL_TOURNAMENT_STATS, error: null });
      return makeChain({ data: [], error: null });
    });
    seriesStats = await getSeriesPlayerStats(IDS.series);
  });

  it('Kamesh batting avg = 52.50 (105 runs / 2 outs)', () => {
    const k = seriesStats.find(r => r.player_id === IDS.kamesh);
    const avg = calcBattingAverage(k.bat_runs, k.bat_innings, k.bat_not_outs);
    expect(fmt(avg)).toBe('52.50');
  });

  it('Kamesh batting SR = 150.00 (105 runs off 70 balls)', () => {
    const k = seriesStats.find(r => r.player_id === IDS.kamesh);
    const sr = calcStrikeRate(k.bat_runs, k.bat_balls);
    expect(fmt(sr)).toBe('150.00');
  });

  it('Kamesh bowling avg = 18.33 (55 runs / 3 wickets)', () => {
    const k = seriesStats.find(r => r.player_id === IDS.kamesh);
    const avg = calcBowlingAverage(k.bowl_runs, k.bowl_wickets);
    expect(fmt(avg)).toBe('18.33');
  });

  it('Kamesh bowling economy = 5.50 (55 runs off 60 balls = 10 overs)', () => {
    const k = seriesStats.find(r => r.player_id === IDS.kamesh);
    const econ = calcEconomy(k.bowl_runs, k.bowl_legal_balls);
    expect(fmt(econ)).toBe('5.50');
  });

  it('Arjun batting avg = 80.00 (80 runs / 1 out, since 2 inn 1 NO)', () => {
    const a = seriesStats.find(r => r.player_id === IDS.arjun);
    const avg = calcBattingAverage(a.bat_runs, a.bat_innings, a.bat_not_outs);
    expect(fmt(avg)).toBe('80.00');
  });

  it('Arjun bowling economy = 4.58 (55 runs off 72 balls = 12 overs)', () => {
    const a = seriesStats.find(r => r.player_id === IDS.arjun);
    const econ = calcEconomy(a.bowl_runs, a.bowl_legal_balls);
    expect(fmt(econ)).toBe('4.58');
  });

  it('Divya batting avg = 28.00 (28 runs / 1 out, since 2 inn 1 NO)', () => {
    const d = seriesStats.find(r => r.player_id === IDS.divya);
    const avg = calcBattingAverage(d.bat_runs, d.bat_innings, d.bat_not_outs);
    expect(fmt(avg)).toBe('28.00');
  });

  it('Ravi batting avg = 55.00 (55 runs / 1 out, since 2 inn 1 NO)', () => {
    const r = seriesStats.find(r => r.player_id === IDS.ravi);
    const avg = calcBattingAverage(r.bat_runs, r.bat_innings, r.bat_not_outs);
    expect(fmt(avg)).toBe('55.00');
  });
});

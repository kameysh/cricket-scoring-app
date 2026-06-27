import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as seriesService from './seriesService';

const mockFrom = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { from: (...args) => mockFrom(...args) } }));

function makeChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  };
  return chain;
}

describe('seriesService', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('listSeries', () => {
    it('returns sorted series', async () => {
      const rows = [{ id: 's1', name: 'K7 Trophy' }];
      mockFrom.mockReturnValue(makeChain({ data: rows, error: null }));
      const result = await seriesService.listSeries();
      expect(result).toEqual(rows);
    });

    it('throws on error', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: new Error('DB fail') }));
      await expect(seriesService.listSeries()).rejects.toThrow('DB fail');
    });
  });

  describe('addSeries', () => {
    it('returns the new series row', async () => {
      const row = { id: 's2', name: 'City League' };
      mockFrom.mockReturnValue(makeChain({ data: row, error: null }));
      const result = await seriesService.addSeries('City League');
      expect(result).toEqual(row);
    });

    it('throws on unique constraint', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: new Error('unique') }));
      await expect(seriesService.addSeries('K7 Trophy')).rejects.toThrow('unique');
    });
  });

  describe('deleteSeries', () => {
    it('resolves without error', async () => {
      mockFrom.mockReturnValue(makeChain({ error: null }));
      await expect(seriesService.deleteSeries('s1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      mockFrom.mockReturnValue(makeChain({ error: new Error('FK') }));
      await expect(seriesService.deleteSeries('s1')).rejects.toThrow('FK');
    });
  });

  describe('getSeriesTournaments', () => {
    it('excludes soft-deleted tournaments (filters is_deleted = false)', async () => {
      const eqCalls = [];
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((col, val) => { eqCalls.push([col, val]); return chain; }),
        order: vi.fn(() => chain),
        then: (res) => Promise.resolve({ data: [{ id: 't1', name: 'Season 7' }], error: null }).then(res),
      };
      mockFrom.mockReturnValue(chain);

      const result = await seriesService.getSeriesTournaments('s1');
      expect(result).toEqual([{ id: 't1', name: 'Season 7' }]);
      expect(eqCalls).toContainEqual(['series_id', 's1']);
      expect(eqCalls).toContainEqual(['is_deleted', false]); // the fix
    });
  });

  describe('getSeriesPlayerStats', () => {
    it('returns empty when no tournaments in series', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
      const result = await seriesService.getSeriesPlayerStats('s1');
      expect(result).toEqual([]);
    });

    it('filters out soft-deleted tournaments when collecting tournament ids', async () => {
      const eqCalls = [];
      mockFrom.mockImplementation(() => ({
        select: vi.fn(function () { return this; }),
        eq: vi.fn(function (col, val) { eqCalls.push([col, val]); return this; }),
        in: vi.fn(function () { return this; }),
        then: (res) => Promise.resolve({ data: [], error: null }).then(res),
      }));
      await seriesService.getSeriesPlayerStats('s1');
      expect(eqCalls).toContainEqual(['is_deleted', false]);
    });

    it('aggregates stats from multiple tournament rows for same player', async () => {
      const calls = [];
      mockFrom.mockImplementation(table => {
        const chain = makeChain(null);
        calls.push({ table, chain });
        chain.select = vi.fn(() => chain);
        chain.insert = vi.fn(() => chain);
        chain.delete = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.in = vi.fn(() => chain);
        chain.order = vi.fn(() => chain);
        chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
        // configure per-call
        chain.then = (res, rej) => {
          const t = calls.find(c => c.chain === chain);
          let result;
          if (t.table === 'tournaments') {
            result = { data: [{ id: 't1' }, { id: 't2' }], error: null };
          } else {
            result = {
              data: [
                { player_id: 'p1', players: { id: 'p1', name: 'Kamesh' }, bat_runs: 40, bat_innings: 2, bat_not_outs: 0, bat_balls: 50, bat_fours: 5, bat_sixes: 1, bat_fifties: 0, bat_hundreds: 0, bat_thirties: 1, bat_highest_score: 25, bowl_wickets: 2, bowl_runs: 30, bowl_legal_balls: 18, bowl_maidens: 1, bowl_five_wicket_hauls: 0, bowl_matches: 1, bowl_best_wickets: 2, bowl_best_runs: 15, field_catches: 1, field_stumpings: 0, field_run_outs: 0, bat_matches: 1 },
                { player_id: 'p1', players: { id: 'p1', name: 'Kamesh' }, bat_runs: 60, bat_innings: 2, bat_not_outs: 1, bat_balls: 45, bat_fours: 4, bat_sixes: 2, bat_fifties: 1, bat_hundreds: 0, bat_thirties: 0, bat_highest_score: 55, bowl_wickets: 3, bowl_runs: 20, bowl_legal_balls: 12, bowl_maidens: 0, bowl_five_wicket_hauls: 0, bowl_matches: 1, bowl_best_wickets: 3, bowl_best_runs: 12, field_catches: 2, field_stumpings: 0, field_run_outs: 1, bat_matches: 1 },
              ],
              error: null,
            };
          }
          return Promise.resolve(result).then(res, rej);
        };
        return chain;
      });

      const result = await seriesService.getSeriesPlayerStats('s1');
      expect(result).toHaveLength(1);
      const p = result[0];
      expect(p.player_id).toBe('p1');
      expect(p.bat_runs).toBe(100);
      expect(p.bat_innings).toBe(4);
      expect(p.bat_not_outs).toBe(1);
      expect(p.bat_highest_score).toBe(55); // max
      expect(p.bat_fifties).toBe(1);
      expect(p.bowl_wickets).toBe(5);
      expect(p.bowl_matches).toBe(2);
      expect(p.bowl_best_wickets).toBe(3); // best across the series (3/12 beats 2/15)
      expect(p.bowl_best_runs).toBe(12);
      expect(p.field_catches).toBe(3);
      expect(p.bat_matches).toBe(2);
    });
  });
});

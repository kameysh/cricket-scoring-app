import { describe, it, expect } from 'vitest';
import { computePartnerships } from './partnershipService';

const D = (overrides) => ({
  batsman_id: 'p1',
  non_striker_before: 'p2',
  striker_after: 'p1',
  is_wicket: false,
  batsman_out_id: null,
  total_runs_on_delivery: 1,
  extra_type: 'none',
  ...overrides,
});

describe('computePartnerships', () => {
  it('returns empty for empty deliveries', () => {
    expect(computePartnerships([])).toEqual([]);
  });

  it('single unbroken partnership', () => {
    const dels = [D({ total_runs_on_delivery: 4 }), D({ total_runs_on_delivery: 6 })];
    const result = computePartnerships(dels);
    expect(result).toHaveLength(1);
    expect(result[0].runs).toBe(10);
    expect(result[0].balls).toBe(2);
    expect(result[0].broken).toBe(false);
  });

  it('wide does not count as a ball', () => {
    const dels = [
      D({ extra_type: 'wide', total_runs_on_delivery: 1 }),
      D({ total_runs_on_delivery: 2 }),
    ];
    const result = computePartnerships(dels);
    expect(result[0].balls).toBe(1);
    expect(result[0].runs).toBe(3);
  });

  it('records broken partnership on wicket', () => {
    const dels = [
      D({ total_runs_on_delivery: 3 }),
      D({ is_wicket: true, batsman_out_id: 'p1', total_runs_on_delivery: 0, striker_after: 'p3' }),
      D({ batsman_id: 'p3', non_striker_before: 'p2', total_runs_on_delivery: 2 }),
    ];
    const result = computePartnerships(dels);
    expect(result).toHaveLength(2);
    const broken = result.find(p => p.broken);
    expect(broken).toBeTruthy();
    expect(broken.runs).toBe(3);
  });

  it('sorts by runs descending', () => {
    const dels = [
      D({ total_runs_on_delivery: 1 }),
      D({ is_wicket: true, batsman_out_id: 'p1', total_runs_on_delivery: 0 }),
      D({ batsman_id: 'p3', non_striker_before: 'p2', total_runs_on_delivery: 10 }),
      D({ batsman_id: 'p3', non_striker_before: 'p2', total_runs_on_delivery: 10 }),
    ];
    const result = computePartnerships(dels);
    expect(result[0].runs).toBeGreaterThan(result[result.length - 1].runs);
  });

  it('captures the incoming batsman after a wicket (no "Unrecorded" partner)', () => {
    const dels = [
      // Opening stand: p1 & p2
      D({ batsman_id: 'p1', non_striker_before: 'p2', total_runs_on_delivery: 4 }),
      // p1 out → p3 comes in
      D({ batsman_id: 'p1', non_striker_before: 'p2', is_wicket: true, batsman_out_id: 'p1', total_runs_on_delivery: 0 }),
      // New stand: survivor p2 + incoming p3
      D({ batsman_id: 'p3', non_striker_before: 'p2', total_runs_on_delivery: 6 }),
      D({ batsman_id: 'p3', non_striker_before: 'p2', total_runs_on_delivery: 2 }),
    ];
    const result = computePartnerships(dels);
    const second = result.find(p => !p.broken); // the unbroken p2/p3 stand
    expect(second).toBeTruthy();
    expect(second.batsman2Id).not.toBeNull();           // partner IS recorded now
    expect(new Set([second.batsman1Id, second.batsman2Id])).toEqual(new Set(['p2', 'p3']));
  });

  it('multiple wickets produce multiple partnerships', () => {
    const dels = [
      D({ total_runs_on_delivery: 5 }),
      D({ is_wicket: true, batsman_out_id: 'p1', total_runs_on_delivery: 0 }),
      D({ batsman_id: 'p3', total_runs_on_delivery: 8 }),
      D({ batsman_id: 'p3', is_wicket: true, batsman_out_id: 'p3', total_runs_on_delivery: 0 }),
      D({ batsman_id: 'p4', total_runs_on_delivery: 2 }),
    ];
    const result = computePartnerships(dels);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

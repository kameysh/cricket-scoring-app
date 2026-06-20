import { describe, it, expect, vi } from 'vitest';

// Mock supabase before importing playerService
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { getPlayerMatchCounts } from './playerService';
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

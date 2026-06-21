import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { incrementMatchesPlayed, addSubPlayer } from './matchService';
import { supabase } from '../lib/supabase';

describe('incrementMatchesPlayed', () => {
  it('calls the increment_matches_played RPC with the correct match id', async () => {
    supabase.rpc.mockResolvedValue({ error: null });
    await incrementMatchesPlayed('match-123');
    expect(supabase.rpc).toHaveBeenCalledWith('increment_matches_played', { p_match_id: 'match-123' });
  });

  it('throws when the RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'DB error' } });
    await expect(incrementMatchesPlayed('match-456')).rejects.toMatchObject({ message: 'DB error' });
  });
});

describe('addSubPlayer', () => {
  function mockChain(result) {
    const single = vi.fn().mockResolvedValue(result);
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });
    return { insert, select, single };
  }

  it('inserts into match_players with is_substitute=true and subbed_out_player_id', async () => {
    const row = { id: 'mp2', match_id: 'm1', player_id: 'p1', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out', players: { id: 'p1', name: 'Balaji' } };
    const { insert, select, single } = mockChain({ data: row, error: null });

    const result = await addSubPlayer('m1', 'p1', 1, 'mp-out');

    expect(supabase.from).toHaveBeenCalledWith('match_players');
    expect(insert).toHaveBeenCalledWith({ match_id: 'm1', player_id: 'p1', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: 'mp-out' });
    expect(select).toHaveBeenCalledWith('*, players(*)');
    expect(single).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it('passes null for subbed_out_player_id when not provided', async () => {
    const row = { id: 'mp3', match_id: 'm1', player_id: 'p1', team: 1, is_substitute: true, is_active: true, subbed_out_player_id: null };
    const { insert } = mockChain({ data: row, error: null });
    await addSubPlayer('m1', 'p1', 1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ subbed_out_player_id: null }));
  });

  it('throws when supabase returns an error', async () => {
    mockChain({ data: null, error: { message: 'constraint violation' } });
    await expect(addSubPlayer('m1', 'p1', 1)).rejects.toMatchObject({ message: 'constraint violation' });
  });
});

describe('setPlayerActive', () => {
  function mockUpdate(result) {
    const eq = vi.fn().mockResolvedValue(result);
    const update = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ update });
    return { update, eq };
  }

  it('updates is_active on the given match_players row', async () => {
    const { update, eq } = mockUpdate({ error: null });
    const { setPlayerActive } = await import('./matchService');
    await setPlayerActive('mp-1', false);
    expect(supabase.from).toHaveBeenCalledWith('match_players');
    expect(update).toHaveBeenCalledWith({ is_active: false });
    expect(eq).toHaveBeenCalledWith('id', 'mp-1');
  });

  it('throws when supabase returns an error', async () => {
    mockUpdate({ error: { message: 'update failed' } });
    const { setPlayerActive } = await import('./matchService');
    await expect(setPlayerActive('mp-1', true)).rejects.toMatchObject({ message: 'update failed' });
  });
});

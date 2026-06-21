import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { getAllTeamPlayers } from './teamService';
import { supabase } from '../lib/supabase';

describe('getAllTeamPlayers', () => {
  it('selects team_id + player_id from team_players and returns the rows', async () => {
    const rows = [
      { team_id: 't1', player_id: 'p1' },
      { team_id: 't1', player_id: 'p2' },
      { team_id: 't2', player_id: 'p3' },
    ];
    const select = vi.fn().mockResolvedValue({ data: rows, error: null });
    supabase.from.mockReturnValue({ select });

    const result = await getAllTeamPlayers();

    expect(supabase.from).toHaveBeenCalledWith('team_players');
    expect(select).toHaveBeenCalledWith('team_id, player_id');
    expect(result).toEqual(rows);
  });

  it('returns an empty array when there are no rows', async () => {
    supabase.from.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: null, error: null }) });
    const result = await getAllTeamPlayers();
    expect(result).toEqual([]);
  });

  it('throws when supabase returns an error', async () => {
    supabase.from.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) });
    await expect(getAllTeamPlayers()).rejects.toMatchObject({ message: 'boom' });
  });
});

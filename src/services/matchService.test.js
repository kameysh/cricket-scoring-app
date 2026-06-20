import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { incrementMatchesPlayed } from './matchService';
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

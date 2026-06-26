import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn().mockResolvedValue({}) },
  },
}));

import { incrementMatchesPlayed, addSubPlayer, getMatchNumber, createSuperOverInnings, startUpcomingMatch } from './matchService';
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

describe('getMatchNumber', () => {
  function mockFromChain({ singleData, countResult }) {
    // First call: .from('matches').select('created_at').eq('id', id).single()
    const single = vi.fn().mockResolvedValue({ data: singleData, error: null });
    const eqForSingle = vi.fn().mockReturnValue({ single });
    const selectForSingle = vi.fn().mockReturnValue({ eq: eqForSingle });

    // Second call: .from('matches').select('id', { count: 'exact', head: true }).lte('created_at', ...)
    const lte = vi.fn().mockResolvedValue(countResult);
    const selectForCount = vi.fn().mockReturnValue({ lte });

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: selectForSingle };
      return { select: selectForCount };
    });

    return { single, eqForSingle, lte };
  }

  it('returns the 1-based position of the match by created_at', async () => {
    mockFromChain({
      singleData: { created_at: '2026-06-20T10:00:00Z' },
      countResult: { count: 3, error: null },
    });
    const result = await getMatchNumber('match-3');
    expect(result).toBe(3);
  });

  it('returns 1 for the very first match', async () => {
    mockFromChain({
      singleData: { created_at: '2026-06-01T00:00:00Z' },
      countResult: { count: 1, error: null },
    });
    const result = await getMatchNumber('match-1');
    expect(result).toBe(1);
  });

  it('returns null when the match row is not found', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ select });

    const result = await getMatchNumber('nonexistent');
    expect(result).toBeNull();
  });

  it('uses lte on created_at to count earlier-or-equal matches', async () => {
    const { lte } = mockFromChain({
      singleData: { created_at: '2026-06-21T08:00:00Z' },
      countResult: { count: 5, error: null },
    });
    await getMatchNumber('match-5');
    expect(lte).toHaveBeenCalledWith('created_at', '2026-06-21T08:00:00Z');
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

describe('setPlayerInjured', () => {
  function mockUpdate(result) {
    const eq = vi.fn().mockResolvedValue(result);
    const update = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ update });
    return { update, eq };
  }

  it('updates is_injured on the given match_players row', async () => {
    const { update, eq } = mockUpdate({ error: null });
    const { setPlayerInjured } = await import('./matchService');
    await setPlayerInjured('mp-9', true);
    expect(supabase.from).toHaveBeenCalledWith('match_players');
    expect(update).toHaveBeenCalledWith({ is_injured: true });
    expect(eq).toHaveBeenCalledWith('id', 'mp-9');
  });

  it('throws when supabase returns an error', async () => {
    mockUpdate({ error: { message: 'injure failed' } });
    const { setPlayerInjured } = await import('./matchService');
    await expect(setPlayerInjured('mp-9', false)).rejects.toMatchObject({ message: 'injure failed' });
  });
});

describe('createSuperOverInnings', () => {
  function mockInsertChain(result) {
    const single = vi.fn().mockResolvedValue(result);
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });
    return { insert };
  }

  it('inserts innings row with is_super_over=true', async () => {
    const row = { id: 'inn-3', innings_number: 3, batting_team: 2, is_super_over: true, target: null };
    const { insert } = mockInsertChain({ data: row, error: null });
    const result = await createSuperOverInnings('match-1', 3, 2, null);
    expect(supabase.from).toHaveBeenCalledWith('innings');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_super_over: true, innings_number: 3, batting_team: 2 }));
    expect(result).toEqual(row);
  });

  it('passes target when provided', async () => {
    const row = { id: 'inn-4', innings_number: 4, batting_team: 1, is_super_over: true, target: 13 };
    const { insert } = mockInsertChain({ data: row, error: null });
    await createSuperOverInnings('match-1', 4, 1, 13);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ target: 13 }));
  });

  it('throws when supabase returns an error', async () => {
    mockInsertChain({ data: null, error: { message: 'insert failed' } });
    await expect(createSuperOverInnings('match-1', 3, 2, null)).rejects.toMatchObject({ message: 'insert failed' });
  });
});

describe('startUpcomingMatch', () => {
  let matchUpdatePayloads;
  let inningsInsert;

  beforeEach(() => {
    matchUpdatePayloads = [];
    inningsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'inn-1' }, error: null }),
      }),
    });

    supabase.from.mockImplementation((table) => {
      const single = vi.fn().mockResolvedValue({
        data: { id: 'match-1', tournament_id: null, team1_name: 'A', team2_name: 'B' },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const eqInner = vi.fn().mockReturnValue({ select, single });
      const eq = vi.fn().mockReturnValue({ select, single, eq: eqInner });

      if (table === 'matches') {
        const update = vi.fn().mockImplementation((payload) => {
          matchUpdatePayloads.push(payload);
          return { eq };
        });
        return { update, select: vi.fn().mockReturnValue({ eq }) };
      }
      if (table === 'innings') {
        return { insert: inningsInsert };
      }
      return { update: vi.fn().mockReturnValue({ eq }) };
    });
  });

  it('saves toss_winner and toss_decision to the match', async () => {
    await startUpcomingMatch('match-1', 'team1', 'bat');
    expect(matchUpdatePayloads[0]).toMatchObject({ toss_winner: 'team1', toss_decision: 'bat' });
  });

  it('sets battingTeam=1 when toss winner chooses to bat', async () => {
    await startUpcomingMatch('match-1', 'team1', 'bat');
    expect(inningsInsert).toHaveBeenCalledWith(expect.objectContaining({ batting_team: 1, innings_number: 1 }));
  });

  it('sets battingTeam=2 when toss winner chooses to field', async () => {
    await startUpcomingMatch('match-1', 'team1', 'field');
    expect(inningsInsert).toHaveBeenCalledWith(expect.objectContaining({ batting_team: 2 }));
  });

  it('sets battingTeam=2 when team2 wins and bats', async () => {
    await startUpcomingMatch('match-1', 'team2', 'bat');
    expect(inningsInsert).toHaveBeenCalledWith(expect.objectContaining({ batting_team: 2 }));
  });

  it('merges all three rule flags into the updateMatch payload', async () => {
    const rules = { last_man_standing: true, super_over_enabled: true, free_hit_on_no_ball: true };
    await startUpcomingMatch('match-1', 'team1', 'bat', rules);
    expect(matchUpdatePayloads[0]).toMatchObject({
      last_man_standing: true,
      super_over_enabled: true,
      free_hit_on_no_ball: true,
    });
  });

  it('sends no rule keys when rules param is omitted', async () => {
    await startUpcomingMatch('match-1', 'team1', 'bat');
    expect(matchUpdatePayloads[0]).not.toHaveProperty('last_man_standing');
    expect(matchUpdatePayloads[0]).not.toHaveProperty('super_over_enabled');
    expect(matchUpdatePayloads[0]).not.toHaveProperty('free_hit_on_no_ball');
  });

  it('merges only the provided rule flag (partial rules)', async () => {
    await startUpcomingMatch('match-1', 'team1', 'bat', { free_hit_on_no_ball: true });
    expect(matchUpdatePayloads[0]).toMatchObject({ free_hit_on_no_ball: true });
    expect(matchUpdatePayloads[0]).not.toHaveProperty('last_man_standing');
  });

  it('sets match status to live after saving toss data', async () => {
    await startUpcomingMatch('match-1', 'team1', 'bat');
    expect(matchUpdatePayloads[1]).toMatchObject({ status: 'live' });
  });
});

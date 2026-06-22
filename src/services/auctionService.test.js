import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────
let mockData = null;
let mockError = null;
const chain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(async () => ({ data: mockData, error: mockError })),
  then: (resolve) => Promise.resolve({ data: mockData, error: mockError }).then(resolve),
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'admin-uid' } } } }) },
    rpc: vi.fn(async () => ({ error: mockError })),
  },
}));

import {
  createAuction, addAuctionTeam, getAuction,
  placeBid, dealPlayer, signalPass, holdPlayer, returnToPool,
  drawNextPlayer, updateAuctionStatus, undoLastBid,
} from './auctionService';
import { supabase } from '../lib/supabase';

beforeEach(() => {
  vi.clearAllMocks();
  mockData = null;
  mockError = null;
  // Reset chain methods to return `this` by default
  Object.keys(chain).forEach(k => {
    if (k !== 'single' && k !== 'then') chain[k].mockReturnValue(chain);
  });
  chain.single.mockImplementation(async () => ({ data: mockData, error: mockError }));
  supabase.from.mockReturnValue(chain);
  supabase.rpc.mockResolvedValue({ error: mockError });
});

describe('createAuction', () => {
  it('returns row with status draft', async () => {
    mockData = { id: 'a1', name: 'Test Auction', status: 'draft', budget_per_team: 1000 };
    const result = await createAuction({ name: 'Test Auction', budget_per_team: 1000, bid_increments: [50, 100] });
    expect(result.status).toBe('draft');
    expect(result.id).toBe('a1');
  });
});

describe('addAuctionTeam', () => {
  it('sets budget_remaining equal to auction budget_per_team', async () => {
    // getAuction call returns auction with budget_per_team=500
    chain.single
      .mockResolvedValueOnce({ data: { id: 'a1', budget_per_team: 500 }, error: null })  // getAuction
      .mockResolvedValueOnce({ data: { id: 'at1', budget_remaining: 500 }, error: null }); // insert

    const result = await addAuctionTeam('a1', 't1', 'u1');
    expect(result.budget_remaining).toBe(500);
  });
});

describe('placeBid', () => {
  it('throws when amount exceeds budget_remaining', async () => {
    chain.single.mockResolvedValueOnce({
      data: { budget_remaining: 200, auction_id: 'a1' }, error: null,
    });
    await expect(placeBid('ap1', 'at1', 500)).rejects.toThrow('exceeds remaining budget');
  });

  it('resets pass_team1 and pass_team2 to false on successful bid', async () => {
    chain.single
      .mockResolvedValueOnce({ data: { budget_remaining: 1000, auction_id: 'a1' }, error: null }) // team fetch
      .mockResolvedValueOnce({ data: { error: null }, error: null })                               // bid insert
      .mockResolvedValueOnce({ data: { pass_team1: false, pass_team2: false }, error: null });     // player update

    let updatedFields = null;
    chain.update.mockImplementation((fields) => { updatedFields = fields; return chain; });

    await placeBid('ap1', 'at1', 300);
    expect(updatedFields).toMatchObject({ pass_team1: false, pass_team2: false });
  });
});

describe('dealPlayer', () => {
  it('calls deal_player RPC with correct player id', async () => {
    supabase.rpc.mockResolvedValue({ error: null });
    await dealPlayer('ap1');
    expect(supabase.rpc).toHaveBeenCalledWith('deal_player', { p_auction_player_id: 'ap1' });
  });

  it('throws when RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'No leading team' } });
    await expect(dealPlayer('ap1')).rejects.toThrow();
  });
});

describe('signalPass', () => {
  it('updates pass_team1 when passColumn is pass_team1', async () => {
    mockData = { pass_team1: true, pass_team2: false };
    let updatedFields = null;
    chain.update.mockImplementation((fields) => { updatedFields = fields; return chain; });

    await signalPass('ap1', 'pass_team1');
    expect(updatedFields).toMatchObject({ pass_team1: true });
    expect(updatedFields).not.toHaveProperty('pass_team2');
  });

  it('updates pass_team2 when passColumn is pass_team2', async () => {
    mockData = { pass_team1: false, pass_team2: true };
    let updatedFields = null;
    chain.update.mockImplementation((fields) => { updatedFields = fields; return chain; });

    await signalPass('ap1', 'pass_team2');
    expect(updatedFields).toMatchObject({ pass_team2: true });
    expect(updatedFields).not.toHaveProperty('pass_team1');
  });

  it('throws on invalid passColumn', async () => {
    await expect(signalPass('ap1', 'pass_team3')).rejects.toThrow('pass_team1 or pass_team2');
  });
});

describe('holdPlayer', () => {
  it('sets status to held and held_at to a non-null timestamp', async () => {
    let updatedFields = null;
    chain.update.mockImplementation((fields) => { updatedFields = fields; return chain; });
    mockData = { status: 'held', held_at: new Date().toISOString() };

    await holdPlayer('ap1');
    expect(updatedFields.status).toBe('held');
    expect(updatedFields.held_at).toBeTruthy();
  });
});

describe('returnToPool', () => {
  it('sets status to pool and clears held_at', async () => {
    let updatedFields = null;
    chain.update.mockImplementation((fields) => { updatedFields = fields; return chain; });
    mockData = { id: 'ap1', status: 'pool', held_at: null };

    const result = await returnToPool('ap1');
    expect(updatedFields.status).toBe('pool');
    expect(updatedFields.held_at).toBeNull();
    expect(result.status).toBe('pool');
  });

  it('throws when DB returns an error', async () => {
    mockError = { message: 'DB error' };
    await expect(returnToPool('ap1')).rejects.toMatchObject({ message: 'DB error' });
  });
});

describe('drawNextPlayer', () => {
  it('activates a pool player when pool is not empty', async () => {
    // listAuctionPlayers (pool) returns one item
    chain.then = (resolve) => Promise.resolve({ data: [{ id: 'ap-pool' }], error: null }).then(resolve);

    let activatedId = null;
    chain.eq.mockImplementation((col, val) => {
      if (col === 'id' && val) activatedId = val;
      return chain;
    });
    chain.update.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: { id: 'ap-pool', status: 'active' }, error: null });

    const result = await drawNextPlayer('a1');
    expect(result?.status).toBe('active');
  });

  it('calls updateAuctionStatus completed when pool and held are both empty', async () => {
    // Both pool and held queries return empty
    chain.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
    chain.single.mockResolvedValue({ data: { id: 'a1', status: 'completed' }, error: null });

    await drawNextPlayer('a1');
    // updateAuctionStatus calls update on auctions table
    expect(supabase.from).toHaveBeenCalledWith('auctions');
  });
});

describe('undoLastBid', () => {
  it('throws when there are no bids to undo', async () => {
    chain.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
    await expect(undoLastBid('ap1')).rejects.toThrow('No bids to undo');
  });

  it('clears current_bid and leading_team_id when undoing the only bid', async () => {
    // First call (fetch bids) returns one bid; subsequent calls (delete + update) use chain
    let callCount = 0;
    chain.then = (resolve) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: [{ id: 'bid1', amount: 200, auction_team_id: 'at1' }],
          error: null,
        }).then(resolve);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    };
    chain.single.mockResolvedValue({
      data: { id: 'ap1', current_bid: null, leading_team_id: null },
      error: null,
    });

    const result = await undoLastBid('ap1');
    expect(result.current_bid).toBeNull();
    expect(result.leading_team_id).toBeNull();
  });

  it('restores previous bid when undoing the latest of multiple bids', async () => {
    let callCount = 0;
    chain.then = (resolve) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: [
            { id: 'bid2', amount: 300, auction_team_id: 'at2' },
            { id: 'bid1', amount: 200, auction_team_id: 'at1' },
          ],
          error: null,
        }).then(resolve);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    };
    chain.single.mockResolvedValue({
      data: { id: 'ap1', current_bid: 200, leading_team_id: 'at1' },
      error: null,
    });

    const result = await undoLastBid('ap1');
    // Should restore to the previous bid (amount=200, team=at1)
    expect(result.current_bid).toBe(200);
    expect(result.leading_team_id).toBe('at1');
  });
});

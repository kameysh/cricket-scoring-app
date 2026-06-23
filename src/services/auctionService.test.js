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
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(async () => ({ data: mockData, error: mockError })),
  maybeSingle: vi.fn(async () => ({ data: mockData, error: mockError })),
  then: (resolve) => Promise.resolve({ data: mockData, error: mockError }).then(resolve),
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'admin-uid' } } } }) },
    rpc: vi.fn(async () => ({ error: mockError })),
  },
}));

vi.mock('./teamService', () => ({
  addTeam: vi.fn(),
  setTeamPlayers: vi.fn(),
}));

import {
  createAuction, addAuctionTeam, getAuction,
  placeBid, raiseAuctioneerBid, dealPlayer, signalPass, holdPlayer, returnToPool,
  drawNextPlayer, updateAuctionStatus, undoLastBid, autosellCaptains,
  createTeamsFromAuction, computeMinReserve, getBidsForPlayer,
} from './auctionService';
import { supabase } from '../lib/supabase';
import * as teamService from './teamService';

beforeEach(() => {
  vi.clearAllMocks();
  mockData = null;
  mockError = null;
  // Reset chain methods to return `this` by default
  Object.keys(chain).forEach(k => {
    if (k !== 'single' && k !== 'maybeSingle' && k !== 'then' && typeof chain[k]?.mockReturnValue === 'function') {
      chain[k].mockReturnValue(chain);
    }
  });
  chain.single.mockImplementation(async () => ({ data: mockData, error: mockError }));
  chain.maybeSingle.mockImplementation(async () => ({ data: mockData, error: mockError }));
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
    // First call (fetch bids) returns one bid; second call (delete) returns deleted row
    let callCount = 0;
    chain.then = (resolve) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: [{ id: 'bid1', amount: 200, auction_team_id: 'at1' }],
          error: null,
        }).then(resolve);
      }
      // Delete call — return the deleted row so the no-op guard passes
      return Promise.resolve({ data: [{ id: 'bid1' }], error: null }).then(resolve);
    };
    chain.single.mockResolvedValue({
      data: { id: 'ap1', current_bid: null, leading_team_id: null },
      error: null,
    });

    const result = await undoLastBid('ap1');
    expect(result.current_bid).toBeNull();
    expect(result.leading_team_id).toBeNull();
  });

  it('restores previous bid when undoing the latest of multiple bids — after undo button guards rapid clicks', async () => {
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
      // Delete call — return the deleted row so the no-op guard passes
      return Promise.resolve({ data: [{ id: 'bid2' }], error: null }).then(resolve);
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

describe('autosellCaptains', () => {
  it('returns empty array when no teams have a captain assigned', async () => {
    // listAuctionTeams returns teams with no captain_id
    chain.then = (resolve) => Promise.resolve({
      data: [{ id: 't1', name: 'Super Kings', captain_id: null, budget_remaining: 5000 }],
      error: null,
    }).then(resolve);

    const result = await autosellCaptains('a1');
    expect(result).toEqual([]);
    // players table should NOT have been queried
    expect(supabase.from).not.toHaveBeenCalledWith('players');
  });

  it('skips gracefully when captain has no player profile', async () => {
    let callCount = 0;
    chain.then = (resolve) => {
      callCount++;
      // listAuctionTeams
      return Promise.resolve({
        data: [{ id: 't1', name: 'Super Kings', captain_id: 'u1', budget_remaining: 5000 }],
        error: null,
      }).then(resolve);
    };
    // captain's player lookup returns null (no profile)
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await autosellCaptains('a1');
    expect(result).toEqual([]);
  });

  it('auto-adds captain to pool then sells them when not yet in pool', async () => {
    chain.then = (resolve) => Promise.resolve({
      data: [{ id: 't1', name: 'Super Kings', captain_id: 'u1', budget_remaining: 5000 }],
      error: null,
    }).then(resolve);

    chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'p1' }, error: null })  // players lookup succeeds
      .mockResolvedValueOnce({ data: null, error: null });           // auction_players not found

    // insert (auto-add to pool) returns the new row
    chain.single.mockResolvedValueOnce({
      data: { id: 'ap-new', base_price: 100, status: 'pool', player: { name: 'Ravi' } },
      error: null,
    });

    let soldUpdate = null;
    chain.update.mockImplementation((fields) => {
      if (fields.status === 'sold') soldUpdate = fields;
      return chain;
    });
    chain.insert.mockReturnValue(chain);

    const result = await autosellCaptains('a1');
    expect(result).toHaveLength(1);
    expect(result[0].teamName).toBe('Super Kings');
    expect(result[0].price).toBe(100);
    expect(soldUpdate?.status).toBe('sold');
    expect(soldUpdate?.sold_to_team_id).toBe('t1');
  });

  it('skips captain already sold (idempotent on retry)', async () => {
    chain.then = (resolve) => Promise.resolve({
      data: [{ id: 't1', name: 'Super Kings', captain_id: 'u1', budget_remaining: 5000 }],
      error: null,
    }).then(resolve);

    chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'p1' }, error: null })
      .mockResolvedValueOnce({
        data: { id: 'ap1', base_price: 500, status: 'sold', player: { name: 'Ravi' } },
        error: null,
      });

    const result = await autosellCaptains('a1');
    expect(result).toEqual([]);
  });

  it('marks captain as sold and deducts from team purse', async () => {
    chain.then = (resolve) => Promise.resolve({
      data: [{ id: 't1', name: 'Super Kings', captain_id: 'u1', budget_remaining: 5000 }],
      error: null,
    }).then(resolve);

    chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'p1' }, error: null })   // players lookup
      .mockResolvedValueOnce({
        data: { id: 'ap1', base_price: 500, status: 'pool', player: { name: 'Ravi' } },
        error: null,
      }); // auction_players

    let soldUpdate = null;
    let budgetUpdate = null;
    chain.update.mockImplementation((fields) => {
      if (fields.status === 'sold') soldUpdate = fields;
      if ('budget_remaining' in fields) budgetUpdate = fields;
      return chain;
    });
    // insert bid returns ok
    chain.insert.mockReturnValue(chain);

    const result = await autosellCaptains('a1');
    expect(result).toHaveLength(1);
    expect(result[0].teamName).toBe('Super Kings');
    expect(result[0].price).toBe(500);
    expect(soldUpdate?.sold_price).toBe(500);
    expect(soldUpdate?.sold_to_team_id).toBe('t1');
    expect(soldUpdate?.status).toBe('sold');
    expect(budgetUpdate?.budget_remaining).toBe(4500); // 5000 - 500
  });
});

// Builds a lightweight chain that resolves via .then() (for queries without .single())
function makeChain(data, error = null) {
  const c = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  c.then = (resolve) => Promise.resolve({ data, error }).then(resolve);
  return c;
}

describe('createTeamsFromAuction', () => {
  beforeEach(() => {
    vi.mocked(teamService.addTeam).mockReset();
    vi.mocked(teamService.setTeamPlayers).mockReset();
  });

  it('creates a global team per auction_team and assigns sold players', async () => {
    supabase.from
      .mockReturnValueOnce(makeChain([
        { id: 'at1', name: 'Super Kings' },
        { id: 'at2', name: 'Royal Challengers' },
      ]))
      .mockReturnValueOnce(makeChain([
        { player_id: 'p1', sold_to_team_id: 'at1' },
        { player_id: 'p2', sold_to_team_id: 'at1' },
        { player_id: 'p3', sold_to_team_id: 'at2' },
      ]));

    vi.mocked(teamService.addTeam)
      .mockResolvedValueOnce({ id: 'g1', name: 'Super Kings' })
      .mockResolvedValueOnce({ id: 'g2', name: 'Royal Challengers' });
    vi.mocked(teamService.setTeamPlayers).mockResolvedValue();

    const result = await createTeamsFromAuction('a1');

    expect(teamService.addTeam).toHaveBeenCalledWith('Super Kings', false, 'a1');
    expect(teamService.addTeam).toHaveBeenCalledWith('Royal Challengers', false, 'a1');
    expect(teamService.setTeamPlayers).toHaveBeenCalledWith('g1', ['p1', 'p2']);
    expect(teamService.setTeamPlayers).toHaveBeenCalledWith('g2', ['p3']);
    expect(result).toHaveLength(2);
  });

  it('skips setTeamPlayers when team has no sold players', async () => {
    supabase.from
      .mockReturnValueOnce(makeChain([{ id: 'at1', name: 'Empty Kings' }]))
      .mockReturnValueOnce(makeChain([]));

    vi.mocked(teamService.addTeam).mockResolvedValueOnce({ id: 'g1', name: 'Empty Kings' });

    await createTeamsFromAuction('a1');

    expect(teamService.addTeam).toHaveBeenCalledTimes(1);
    expect(teamService.setTeamPlayers).not.toHaveBeenCalled();
  });

  it('throws when DB fetch fails', async () => {
    supabase.from.mockReturnValueOnce(makeChain(null, new Error('DB error')));
    await expect(createTeamsFromAuction('a1')).rejects.toThrow('DB error');
  });
});

// ── computeMinReserve ──────────────────────────────────────────────────────────

describe('computeMinReserve', () => {
  // computeMinReserve makes two sequential supabase.from() calls that resolve
  // via .then() (not .single()). makeChain's .then() returns { data, error }.

  it('returns 0 when team has already filled SQUAD_SIZE-1 slots', async () => {
    // 8 players already sold — slotsAfterThisOne = 9 - 8 - 1 = 0
    supabase.from.mockReturnValueOnce(makeChain(Array(8).fill({ id: 'x' })));
    const reserve = await computeMinReserve('a1', 't1', 'ap-active');
    expect(reserve).toBe(0);
  });

  it('returns sum of top-N base prices where N = SQUAD_SIZE - picked - 1', async () => {
    // 0 players sold → need 8 more after winning current → sum top-8 unpicked
    const unpicked = [
      { base_price: 500 }, { base_price: 400 }, { base_price: 300 },
      { base_price: 200 }, { base_price: 100 }, { base_price: 100 },
      { base_price: 50 },  { base_price: 50 },  { base_price: 25 }, // 9 unpicked total, but only top-8 counted
    ];
    supabase.from
      .mockReturnValueOnce(makeChain([]))          // 0 sold
      .mockReturnValueOnce(makeChain(unpicked));   // unpicked pool (already ordered desc by query)

    const reserve = await computeMinReserve('a1', 't1', 'ap-active');
    // top-8: 500+400+300+200+100+100+50+50 = 1700
    expect(reserve).toBe(1700);
  });

  it('caps at available pool size when fewer unpicked than slots needed', async () => {
    // 7 sold → need 1 more after winning → top-1 from pool
    supabase.from
      .mockReturnValueOnce(makeChain(Array(7).fill({ id: 'x' }))) // 7 sold
      .mockReturnValueOnce(makeChain([{ base_price: 300 }, { base_price: 200 }])); // 2 unpicked

    const reserve = await computeMinReserve('a1', 't1', 'ap-active');
    expect(reserve).toBe(300); // only top-1 needed
  });

  it('returns 0 when unpicked pool is empty', async () => {
    supabase.from
      .mockReturnValueOnce(makeChain([]))  // 0 sold
      .mockReturnValueOnce(makeChain([])); // no players in pool at all

    const reserve = await computeMinReserve('a1', 't1', 'ap-active');
    expect(reserve).toBe(0);
  });

  it('throws when sold-count DB query errors', async () => {
    supabase.from.mockReturnValueOnce(makeChain(null, new Error('sold fetch error')));
    await expect(computeMinReserve('a1', 't1', 'ap1')).rejects.toThrow('sold fetch error');
  });

  it('throws when pool DB query errors', async () => {
    supabase.from
      .mockReturnValueOnce(makeChain([]))                              // sold ok
      .mockReturnValueOnce(makeChain(null, new Error('pool error'))); // pool fails

    await expect(computeMinReserve('a1', 't1', 'ap1')).rejects.toThrow('pool error');
  });

  it('uses .in([pool,held]) so unsold players do not inflate reserve', async () => {
    // Verify the pool query filters by status IN ['pool','held'] not just neq 'sold'
    const poolChain = makeChain([{ base_price: 200 }]);
    supabase.from
      .mockReturnValueOnce(makeChain([]))  // 0 sold
      .mockReturnValueOnce(poolChain);     // pool query

    await computeMinReserve('a1', 't1', 'ap1');
    expect(poolChain.in).toHaveBeenCalledWith('status', ['pool', 'held']);
  });
});

describe('raiseAuctioneerBid — reserve enforcement', () => {
  it('throws when raise would violate minimum purse reserve', async () => {
    // Team has ₹1000 purse, pool has 8 players at ₹100 → reserve=800 → maxBid=200
    // Raise of ₹500 should be blocked
    supabase.from
      .mockReturnValueOnce(makeChain({ budget_remaining: 1000, auction_id: 'a1' })) // team
      .mockReturnValueOnce(makeChain([]))                                            // computeMinReserve: 0 sold
      .mockReturnValueOnce(makeChain(Array(8).fill({ base_price: 100 })));           // pool: 8 players

    await expect(raiseAuctioneerBid('ap1', 'at1', 500)).rejects.toThrow('insufficient purse');
  });

  it('throws when raise exceeds raw budget', async () => {
    supabase.from.mockReturnValueOnce(makeChain({ budget_remaining: 200, auction_id: 'a1' }));
    await expect(raiseAuctioneerBid('ap1', 'at1', 500)).rejects.toThrow('exceeds remaining budget');
  });
});

describe('placeBid — reserve enforcement', () => {
  it('throws when bid would violate minimum purse reserve', async () => {
    // Team has ₹1000 left, 0 sold, active player excluded from pool
    // Pool has 8 players at ₹100 each → reserve needed = 8*100 = 800
    // maxBid = 1000 - 800 = 200; bid of 500 should fail
    const teamChain = makeChain({ budget_remaining: 1000, auction_id: 'a1' });
    const soldChain = makeChain([]);
    const poolChain = makeChain(Array(8).fill({ base_price: 100 }));

    supabase.from
      .mockReturnValueOnce(teamChain)  // team fetch (uses .single())
      .mockReturnValueOnce(soldChain)  // computeMinReserve: sold count
      .mockReturnValueOnce(poolChain); // computeMinReserve: unpicked pool

    await expect(placeBid('ap1', 'at1', 500)).rejects.toThrow('insufficient purse');
  });

  it('allows bid at exactly the max bid (boundary)', async () => {
    // Team fetch (single), sold count (then), insert bid (then), update player (single)
    chain.single
      .mockResolvedValueOnce({ data: { budget_remaining: 1000, auction_id: 'a1' }, error: null })
      .mockResolvedValueOnce({ data: { pass_team1: false, pass_team2: false }, error: null });
    // Override .then() so computeMinReserve's "sold" query returns 8 sold players (→ reserve=0)
    let thenCallCount = 0;
    chain.then = (resolve) => {
      thenCallCount++;
      const data = thenCallCount === 1 ? Array(8).fill({ id: 'x' }) : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    };

    await expect(placeBid('ap1', 'at1', 800)).resolves.not.toThrow();
  });
});

describe('getBidsForPlayer', () => {
  beforeEach(() => {
    // Restore chain.then — previous tests may have overridden it
    chain.then = (resolve) => resolve({ data: mockData, error: mockError });
  });

  it('returns bids ordered newest first', async () => {
    const bids = [{ id: 'b1', amount: 1000 }, { id: 'b2', amount: 500 }];
    mockData = bids;
    const result = await getBidsForPlayer('ap1');
    expect(result).toEqual(bids);
    expect(chain.eq).toHaveBeenCalledWith('auction_player_id', 'ap1');
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it('returns empty array when data is null', async () => {
    mockData = null;
    const result = await getBidsForPlayer('ap1');
    expect(result).toEqual([]);
  });

  it('throws on DB error', async () => {
    mockData = null;
    mockError = { message: 'DB error' };
    await expect(getBidsForPlayer('ap1')).rejects.toEqual({ message: 'DB error' });
  });
});

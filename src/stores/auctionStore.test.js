import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuctionStore } from './auctionStore';

// Reset store state before each test
beforeEach(() => {
  useAuctionStore.getState().reset();
});

// Seed helpers
function seedPlayers(players) {
  useAuctionStore.setState({ players });
}
function seedTeams(teams) {
  useAuctionStore.setState({ teams });
}

const POOL_PLAYER = {
  id: 'ap1', status: 'pool', player_id: 'p1', base_price: 100, auction_id: 'a1',
  player: { id: 'p1', name: 'Ravi', role: 'batsman', photo_url: null },
};
const POOL_PLAYER2 = {
  id: 'ap2', status: 'pool', player_id: 'p2', base_price: 200, auction_id: 'a1',
  player: { id: 'p2', name: 'Karthik', role: 'keeper', photo_url: null },
};
const TEAM = { id: 't1', name: 'Super Kings', budget_remaining: 50000 };

describe('auctionStore — _patchPlayer: pool → active triggers viewerDraw', () => {
  it('sets viewerDraw with pool snapshot and winner when player goes active', () => {
    seedPlayers([POOL_PLAYER, POOL_PLAYER2]);
    useAuctionStore.getState()._patchPlayer({ ...POOL_PLAYER, status: 'active' });

    const { viewerDraw } = useAuctionStore.getState();
    expect(viewerDraw).not.toBeNull();
    expect(viewerDraw.winner.id).toBe('ap1');
    expect(viewerDraw.winner.status).toBe('active');
    // Pool snapshot captured both pool players (before patch)
    expect(viewerDraw.pool.length).toBe(2);
  });

  it('does not overwrite viewerDraw if already set (auctioneer set it first)', () => {
    seedPlayers([POOL_PLAYER, POOL_PLAYER2]);
    const existing = { pool: [POOL_PLAYER], winner: POOL_PLAYER };
    useAuctionStore.setState({ viewerDraw: existing });
    useAuctionStore.getState()._patchPlayer({ ...POOL_PLAYER, status: 'active' });

    // Should remain unchanged — auctioneer's local draw takes precedence
    expect(useAuctionStore.getState().viewerDraw).toBe(existing);
  });

  it('clears bids when player becomes active', () => {
    useAuctionStore.setState({ bids: [{ id: 'b1' }], players: [POOL_PLAYER] });
    useAuctionStore.getState()._patchPlayer({ ...POOL_PLAYER, status: 'active' });
    expect(useAuctionStore.getState().bids).toHaveLength(0);
  });
});

describe('auctionStore — _patchPlayer: active → sold triggers soldFlash', () => {
  it('sets soldFlash with player, teamName, soldPrice', () => {
    seedPlayers([{ ...POOL_PLAYER, status: 'active' }]);
    seedTeams([TEAM]);

    useAuctionStore.getState()._patchPlayer({
      ...POOL_PLAYER, status: 'sold', sold_to_team_id: 't1', sold_price: 5000,
    });

    const { soldFlash } = useAuctionStore.getState();
    expect(soldFlash).not.toBeNull();
    expect(soldFlash.player.name).toBe('Ravi');
    expect(soldFlash.teamName).toBe('Super Kings');
    expect(soldFlash.soldPrice).toBe(5000);
  });

  it('preserves player join data (realtime row has no join)', () => {
    seedPlayers([{ ...POOL_PLAYER, status: 'active' }]);
    seedTeams([TEAM]);

    // Realtime payload has no .player join
    useAuctionStore.getState()._patchPlayer({
      id: 'ap1', status: 'sold', sold_to_team_id: 't1', sold_price: 3000,
    });

    expect(useAuctionStore.getState().soldFlash.player.name).toBe('Ravi');
  });

  it('does not set soldFlash for pool → sold without active step', () => {
    seedPlayers([POOL_PLAYER]);
    useAuctionStore.getState()._patchPlayer({
      ...POOL_PLAYER, status: 'sold', sold_to_team_id: 't1', sold_price: 1000,
    });
    expect(useAuctionStore.getState().soldFlash).toBeNull();
  });
});

describe('auctionStore — _startViewerDraw / _clearViewerDraw / _clearSoldFlash', () => {
  it('_startViewerDraw sets viewerDraw', () => {
    useAuctionStore.getState()._startViewerDraw([POOL_PLAYER], POOL_PLAYER);
    const { viewerDraw } = useAuctionStore.getState();
    expect(viewerDraw.winner.id).toBe('ap1');
    expect(viewerDraw.pool).toHaveLength(1);
  });

  it('_clearViewerDraw nullifies viewerDraw', () => {
    useAuctionStore.setState({ viewerDraw: { pool: [], winner: POOL_PLAYER } });
    useAuctionStore.getState()._clearViewerDraw();
    expect(useAuctionStore.getState().viewerDraw).toBeNull();
  });

  it('_clearSoldFlash nullifies soldFlash', () => {
    useAuctionStore.setState({ soldFlash: { player: {}, teamName: 'X', soldPrice: 100 } });
    useAuctionStore.getState()._clearSoldFlash();
    expect(useAuctionStore.getState().soldFlash).toBeNull();
  });
});

describe('auctionStore — _appendBid', () => {
  beforeEach(() => useAuctionStore.setState({ bids: [], teams: [{ id: 't1', name: 'Super Kings' }] }));

  it('prepends a new bid to the list', () => {
    useAuctionStore.getState()._appendBid({ id: 'b1', amount: 1000, auction_team_id: 't1' });
    expect(useAuctionStore.getState().bids[0].id).toBe('b1');
  });

  it('enriches bid with team data from store', () => {
    useAuctionStore.getState()._appendBid({ id: 'b1', amount: 1000, auction_team_id: 't1', auction_team: null });
    expect(useAuctionStore.getState().bids[0].auction_team?.name).toBe('Super Kings');
  });

  it('does not duplicate if same id already in list', () => {
    useAuctionStore.setState({ bids: [{ id: 'b1', amount: 1000 }], teams: [] });
    useAuctionStore.getState()._appendBid({ id: 'b1', amount: 1000 });
    expect(useAuctionStore.getState().bids).toHaveLength(1);
  });

  it('keeps list capped at 20', () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}` }));
    useAuctionStore.setState({ bids: existing, teams: [] });
    useAuctionStore.getState()._appendBid({ id: 'b99' });
    expect(useAuctionStore.getState().bids).toHaveLength(20);
    expect(useAuctionStore.getState().bids[0].id).toBe('b99');
  });
});

describe('auctionStore — _removeBid', () => {
  it('removes the bid with the matching id', () => {
    useAuctionStore.setState({ bids: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }] });
    useAuctionStore.getState()._removeBid('b2');
    const { bids } = useAuctionStore.getState();
    expect(bids).toHaveLength(2);
    expect(bids.map(b => b.id)).toEqual(['b1', 'b3']);
  });

  it('is a no-op when the bid id is not found', () => {
    useAuctionStore.setState({ bids: [{ id: 'b1' }] });
    useAuctionStore.getState()._removeBid('unknown');
    expect(useAuctionStore.getState().bids).toHaveLength(1);
  });

  it('handles empty bids list without throwing', () => {
    useAuctionStore.setState({ bids: [] });
    expect(() => useAuctionStore.getState()._removeBid('b1')).not.toThrow();
  });
});

describe('auctionStore — viewerCount', () => {
  it('_setViewerCount updates viewerCount', () => {
    useAuctionStore.getState()._setViewerCount(5);
    expect(useAuctionStore.getState().viewerCount).toBe(5);
  });
});

describe('auctionStore — reset', () => {
  it('clears viewerDraw, soldFlash, viewerCount', () => {
    useAuctionStore.setState({
      viewerDraw: { pool: [], winner: POOL_PLAYER },
      soldFlash: { player: {}, teamName: 'X', soldPrice: 0 },
      viewerCount: 7,
    });
    useAuctionStore.getState().reset();
    const state = useAuctionStore.getState();
    expect(state.viewerDraw).toBeNull();
    expect(state.soldFlash).toBeNull();
    expect(state.viewerCount).toBe(0);
  });
});

// ── loadAuction + _refreshBids (require mocking the service) ─────────────────
vi.mock('../services/auctionService', () => ({
  getAuction: vi.fn(),
  listAuctionTeams: vi.fn(),
  listAuctionPlayers: vi.fn(),
  getBidsForPlayer: vi.fn(),
}));

import * as auctionService from '../services/auctionService';

const MOCK_AUCTION = { id: 'a1', name: 'Test', status: 'live' };
const MOCK_TEAMS = [{ id: 't1', name: 'RCB', budget_remaining: 1000 }];
const MOCK_PLAYERS = [{ id: 'ap1', status: 'pool' }];

describe('auctionStore — loadAuction silent mode', () => {
  beforeEach(() => {
    vi.mocked(auctionService.getAuction).mockResolvedValue(MOCK_AUCTION);
    vi.mocked(auctionService.listAuctionTeams).mockResolvedValue(MOCK_TEAMS);
    vi.mocked(auctionService.listAuctionPlayers).mockResolvedValue(MOCK_PLAYERS);
    vi.mocked(auctionService.getBidsForPlayer).mockResolvedValue([]);
  });

  it('sets isLoading true then false on normal load', async () => {
    const loading = [];
    const unsub = useAuctionStore.subscribe(s => loading.push(s.isLoading));
    await useAuctionStore.getState().loadAuction('a1');
    unsub();
    expect(loading).toContain(true);
    expect(useAuctionStore.getState().isLoading).toBe(false);
  });

  it('never sets isLoading when silent=true', async () => {
    const loading = [];
    const unsub = useAuctionStore.subscribe(s => loading.push(s.isLoading));
    await useAuctionStore.getState().loadAuction('a1', true);
    unsub();
    expect(loading).not.toContain(true);
    expect(useAuctionStore.getState().isLoading).toBe(false);
  });
});

describe('auctionStore — _refreshBids', () => {
  it('replaces bids list with fresh data from service', async () => {
    const freshBids = [{ id: 'b1', amount: 500 }, { id: 'b2', amount: 300 }];
    vi.mocked(auctionService.getBidsForPlayer).mockResolvedValue(freshBids);
    useAuctionStore.setState({ bids: [{ id: 'old' }] });
    await useAuctionStore.getState()._refreshBids('ap1');
    expect(useAuctionStore.getState().bids).toEqual(freshBids);
  });

  it('does not throw or mutate bids when service throws', async () => {
    vi.mocked(auctionService.getBidsForPlayer).mockRejectedValue(new Error('network error'));
    useAuctionStore.setState({ bids: [{ id: 'keep' }] });
    await expect(useAuctionStore.getState()._refreshBids('ap1')).resolves.toBeUndefined();
    expect(useAuctionStore.getState().bids).toEqual([{ id: 'keep' }]);
  });
});

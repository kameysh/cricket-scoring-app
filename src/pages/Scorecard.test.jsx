import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// ── mock react-router-dom ─────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'match-1' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// ── Supabase channel mock — captures handlers so tests can fire them manually ─
const channelHandlers = {}; // { channelName: { eventKey: handler } }

function makeChannelMock(name) {
  if (!channelHandlers[name]) channelHandlers[name] = {};
  const handlers = channelHandlers[name];
  const mock = {
    on: vi.fn((type, opts, cb) => {
      const key = `${opts.event}:${opts.table}`;
      handlers[key] = cb;
      return mock; // return same instance for chaining
    }),
    subscribe: vi.fn(() => mock),
  };
  return mock;
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(name => makeChannelMock(name)),
    removeChannel: vi.fn(),
  },
}));

// ── mock matchService ─────────────────────────────────────────────────────────
vi.mock('../services/matchService', () => ({
  getMatch: vi.fn(),
  getInnings: vi.fn(),
  getDeliveries: vi.fn(),
  getMatchPlayers: vi.fn(),
  getMatchNumber: vi.fn(),
}));

import * as matchService from '../services/matchService';
import { supabase } from '../lib/supabase';
import Scorecard from './Scorecard';

// ── fixtures ──────────────────────────────────────────────────────────────────
const MATCH_LIVE = { id: 'match-1', status: 'live', team1_name: 'Super Kings', team2_name: 'Back Street Boyz', total_overs: 6, man_of_match: null, tournaments: null };
const INN1 = { id: 'inn-1', match_id: 'match-1', innings_number: 1, batting_team: 1, total_runs: 40, total_wickets: 2, total_legal_balls: 18 };
const DELIVERY = { id: 'd-1', innings_id: 'inn-1', batsman_id: 'p-1', runs_off_bat: 4, extra_type: null, extra_runs: 0, is_wicket: false, over_number: 0, ball_number: 1 };

const PLAYER_ROW = { player_id: 'p-1', is_captain: false, team: 1, players: { id: 'p-1', name: 'Kamesh', photo_url: null, role: 'batsman' } };

function setupMocks({ match = MATCH_LIVE, innings = [INN1], deliveries = [], matchPlayers = [] } = {}) {
  matchService.getMatch.mockResolvedValue(match);
  matchService.getInnings.mockResolvedValue(innings);
  matchService.getDeliveries.mockResolvedValue(deliveries);
  matchService.getMatchPlayers.mockResolvedValue(matchPlayers);
  matchService.getMatchNumber.mockResolvedValue(1);
}

async function renderScorecard() {
  let result;
  await act(async () => { result = render(<Scorecard />); });
  return result;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Scorecard — initial render', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('shows team names', async () => {
    await renderScorecard();
    expect(screen.getByText(/Super Kings.*Back Street Boyz/i)).toBeTruthy();
  });

  it('shows LIVE indicator when match is live', async () => {
    await renderScorecard();
    expect(screen.getByText('LIVE')).toBeTruthy();
  });

  it('does NOT show LIVE indicator for completed match', async () => {
    setupMocks({ match: { ...MATCH_LIVE, status: 'completed' } });
    await renderScorecard();
    expect(screen.queryByText('LIVE')).toBeNull();
  });
});

describe('Scorecard — realtime: match UPDATE', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('hides LIVE indicator when match UPDATE sets status to completed', async () => {
    await renderScorecard();
    expect(screen.getByText('LIVE')).toBeTruthy();

    const handler = channelHandlers[`scorecard:match:match-1`]?.['UPDATE:matches'];
    expect(handler).toBeDefined();

    await act(async () => {
      handler({ new: { ...MATCH_LIVE, status: 'completed' } });
    });

    expect(screen.queryByText('LIVE')).toBeNull();
  });

  it('keeps LIVE indicator when match UPDATE keeps status live', async () => {
    await renderScorecard();
    const handler = channelHandlers[`scorecard:match:match-1`]?.['UPDATE:matches'];
    await act(async () => {
      handler({ new: { ...MATCH_LIVE, status: 'live' } });
    });
    expect(screen.getByText('LIVE')).toBeTruthy();
  });
});

describe('Scorecard — realtime: innings UPDATE', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('patches innings score without a full reload when innings UPDATE fires', async () => {
    await renderScorecard();
    const getInningsCalls = matchService.getInnings.mock.calls.length;

    const handler = channelHandlers[`scorecard:innings:match-1`]?.['UPDATE:innings'];
    expect(handler).toBeDefined();

    await act(async () => {
      handler({ new: { ...INN1, total_runs: 55, total_wickets: 3 } });
    });

    // getInnings should NOT be called again — patched in-place
    expect(matchService.getInnings.mock.calls.length).toBe(getInningsCalls);
  });

  it('calls reloadInnings when a new innings INSERT fires', async () => {
    await renderScorecard();
    const callsBefore = matchService.getInnings.mock.calls.length;

    const handler = channelHandlers[`scorecard:innings:match-1`]?.['INSERT:innings'];
    expect(handler).toBeDefined();

    await act(async () => { handler({ new: { id: 'inn-2', match_id: 'match-1' } }); });

    expect(matchService.getInnings.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('Scorecard — realtime: deliveries INSERT', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks({ deliveries: [DELIVERY] }); });

  it('appends delivery to deliveriesMap when innings_id is known', async () => {
    await renderScorecard();

    const handler = channelHandlers[`scorecard:deliveries:match-1`]?.['INSERT:deliveries'];
    expect(handler).toBeDefined();

    const newDelivery = { id: 'd-2', innings_id: 'inn-1', batsman_id: 'p-1', runs_off_bat: 6, extra_type: null };
    await act(async () => { handler({ new: newDelivery }); });

    // getDeliveries should NOT be called again — appended in-place
    expect(matchService.getDeliveries).toHaveBeenCalledTimes(1); // only initial load
  });

  it('ignores delivery when innings_id is not for this match', async () => {
    await renderScorecard();
    const handler = channelHandlers[`scorecard:deliveries:match-1`]?.['INSERT:deliveries'];

    const foreignDelivery = { id: 'd-99', innings_id: 'inn-OTHER', runs_off_bat: 4 };
    // Should not throw
    await act(async () => { handler({ new: foreignDelivery }); });
    // getDeliveries still only called once (initial load)
    expect(matchService.getDeliveries).toHaveBeenCalledTimes(1);
  });
});

describe('Scorecard — realtime: channel cleanup', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('removes all 3 channels on unmount', async () => {
    const { unmount } = await renderScorecard();
    await act(async () => { unmount(); });
    expect(supabase.removeChannel).toHaveBeenCalledTimes(3);
  });
});

describe('Scorecard — realtime delivery name resolution from playersMap', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows player name (not UUID) for a delivery inserted via realtime when joins are absent', async () => {
    // matchPlayers provides the name; the realtime delivery has NO joined batsman object
    setupMocks({ matchPlayers: [PLAYER_ROW] });
    await renderScorecard();

    const handler = channelHandlers[`scorecard:deliveries:match-1`]?.['INSERT:deliveries'];
    expect(handler).toBeDefined();

    // Realtime payload: raw row only — no d.batsman, d.bowler, d.fielder joins
    const realtimeDelivery = {
      id: 'd-rt', innings_id: 'inn-1',
      batsman_id: 'p-1',      // UUID only, no joined .batsman object
      bowler_id: 'p-1',
      runs_off_bat: 4, extra_type: null, extra_runs: 0,
      is_wicket: false, is_legal_delivery: true, over_number: 0, ball_number: 1,
    };
    await act(async () => { handler({ new: realtimeDelivery }); });

    // "Kamesh" should appear; the raw UUID 'p-1' should NOT appear as a name
    expect(screen.queryByText('p-1')).toBeNull();
    expect(screen.getAllByText('Kamesh').length).toBeGreaterThanOrEqual(1);
  });
});

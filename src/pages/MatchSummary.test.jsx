/**
 * MatchSummary — nickname guard tests
 *
 * buildStatsFromDeliveries is not exported, so we test the page's name
 * rendering via the playerNameMap and batMap paths by importing the
 * module and asserting through rendered output.
 *
 * These tests focus on one clear contract: player.name is always shown,
 * never player.nickname, in every name-bearing data structure the page builds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── service mocks ──────────────────────────────────────────────────────────────
vi.mock('../services/matchService', () => ({
  getMatch:             vi.fn(),
  getInnings:           vi.fn(),
  getMatchPlayers:      vi.fn(),
  getScorecards:        vi.fn(),
  getDeliveries:        vi.fn(),
  deleteMatch:          vi.fn(),
  autoAssignManOfMatch: vi.fn().mockResolvedValue(undefined),
  getMatchNumber:       vi.fn().mockResolvedValue(1),
}));
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ canScore: false, isAdmin: false }) }));
vi.mock('../components/shared/ConfirmDialog', () => ({ default: () => null }));
vi.mock('../components/player/PlayerAvatar', () => ({
  default: ({ name }) => <span data-testid="avatar">{name}</span>,
}));
vi.mock('../components/player/PlayerLink', () => ({
  default: ({ name }) => <span>{name}</span>,
}));
vi.mock('../components/match/HighlightsFeed', () => ({ default: () => null }));
vi.mock('../components/match/PlayerMatchCardSheet', () => ({ default: () => null }));

import * as matchService from '../services/matchService';
import MatchSummary from './MatchSummary';

const MATCH = {
  id: 'match-1',
  team1_name: 'SK', team2_name: 'RCB',
  status: 'completed',
  winning_team_name: 'SK',
  result_summary: 'SK won by 5 runs',
  man_of_match_id: null,
  man_of_match: null,
  total_overs: 5,
};

const INN1 = { id: 'inn-1', match_id: 'match-1', innings_number: 1, batting_team: 1, total_runs: 40, total_wickets: 2, total_legal_balls: 30, is_super_over: false };

// Player with both name AND nickname set
const PLAYER_WITH_NICK = { player_id: 'p1', team: 1, is_captain: false, is_wicket_keeper: false, is_active: true, players: { id: 'p1', name: 'Yuvaraj Singh', nickname: 'Yuvi', photo_url: null } };
const BOWLER_WITH_NICK = { player_id: 'p2', team: 2, is_captain: false, is_wicket_keeper: false, is_active: true, players: { id: 'p2', name: 'Ravi Kumar', nickname: 'RK', photo_url: null } };

function makeDelivery(overrides = {}) {
  return {
    id: 'd1', innings_id: 'inn-1',
    batsman_id: 'p1', bowler_id: 'p2',
    batsman:  { id: 'p1', name: 'Yuvaraj Singh', nickname: 'Yuvi' },
    bowler:   { id: 'p2', name: 'Ravi Kumar',    nickname: 'RK' },
    fielder: null,
    runs_off_bat: 4, extra_type: null, extra_runs: 0, total_runs_on_delivery: 4,
    is_wicket: false, is_legal_delivery: true,
    over_number: 0, ball_number: 1,
    ...overrides,
  };
}

function renderSummary() {
  return render(
    <MemoryRouter initialEntries={['/matches/match-1/summary']}>
      <Routes>
        <Route path="/matches/:id/summary" element={<MatchSummary />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MatchSummary — primary name, not nickname', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchService.getMatch.mockResolvedValue(MATCH);
    matchService.getInnings.mockResolvedValue([INN1]);
    matchService.getMatchPlayers.mockResolvedValue([PLAYER_WITH_NICK, BOWLER_WITH_NICK]);
    matchService.getScorecards.mockResolvedValue({ batting: [], bowling: [], fielding: [] });
    matchService.getDeliveries.mockResolvedValue([makeDelivery()]);
  });

  it('shows batsman primary name in scorecard tab, not nickname', async () => {
    renderSummary();
    // Wait for data load then switch to SCORECARD tab
    const scorecardTab = await screen.findByRole('button', { name: /SCORECARD/i });
    await act(async () => { fireEvent.click(scorecardTab); });
    expect(screen.getAllByText('Yuvaraj Singh').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Yuvi')).not.toBeInTheDocument();
  });

  it('shows bowler primary name in scorecard tab, not nickname', async () => {
    renderSummary();
    const scorecardTab = await screen.findByRole('button', { name: /SCORECARD/i });
    await act(async () => { fireEvent.click(scorecardTab); });
    expect(screen.getAllByText('Ravi Kumar').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('RK')).not.toBeInTheDocument();
  });
});

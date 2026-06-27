import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const chainable = { data: [], error: null };
const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
q.select.mockReturnValue(q);
q.eq.mockReturnValue(q);
q.order.mockReturnValue(q);
q.limit.mockResolvedValue(chainable);
// make the chain thenable at every step
Object.assign(q, { then: (res) => Promise.resolve(chainable).then(res) });

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => q,
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../services/playerService', () => ({
  getAllCareerStats: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/seriesService', () => ({
  listSeries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/partnershipService', () => ({
  getTopPartnerships: vi.fn().mockResolvedValue([]),
}));

vi.mock('../components/player/PlayerAvatar', () => ({ default: () => <span data-testid="pavatar" /> }));
vi.mock('../components/shared/LoadingSkeleton', () => ({ default: () => <div>Loading</div> }));
vi.mock('../components/shared/EmptyState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

// Mock the MVP card sheet so we can assert it opens with the right props
vi.mock('../components/player/MvpCardSheet', () => ({
  default: ({ open, player, rank }) => (open ? <div data-testid="mvp-card-sheet">MVP card: {player?.name} #{rank}</div> : null),
}));

import * as playerService from '../services/playerService';
import Leaderboard from './Leaderboard';

// Helper: a career-stat row for the MVP tab
const mkRow = (id, name, over) => ({
  player_id: id, players: { id, name, photo_url: null, role: 'batsman' },
  bat_matches: 5, matches_played: 5,
  bat_runs: 100, bowl_wickets: 2, bat_fours: 8, bat_sixes: 3,
  bat_fifties: 1, bat_hundreds: 0, field_catches: 2, field_run_outs: 1,
  ...over,
});

function renderLeaderboard() {
  return render(<MemoryRouter><Leaderboard /></MemoryRouter>);
}

describe('Leaderboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Batting tab by default without crashing', async () => {
    renderLeaderboard();
    expect(screen.getByText('Batting')).toBeInTheDocument();
  });

  it('switches to Partnerships tab without crashing', async () => {
    renderLeaderboard();
    fireEvent.click(screen.getByText(/Partnerships/i));
    await waitFor(() => {
      expect(screen.getByText('No partnerships yet')).toBeInTheDocument();
    });
  });

  it('renders partnership rows with both player names and avatars', async () => {
    const { getTopPartnerships } = await import('../services/partnershipService');
    getTopPartnerships.mockResolvedValue([
      {
        batsman1Id: 'a', batsman2Id: 'b', runs: 50, balls: 30, broken: false,
        team1: 'Lions', team2: 'Tigers',
        player1: { id: 'a', name: 'Alpha', photo_url: null },
        player2: { id: 'b', name: 'Bravo', photo_url: null },
      },
    ]);
    renderLeaderboard();
    fireEvent.click(screen.getByText(/Partnerships/i));
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    // one avatar per player in the stand
    expect(screen.getAllByTestId('pavatar').length).toBeGreaterThanOrEqual(2);
  });

  it('switches to MVP tab without crashing', async () => {
    renderLeaderboard();
    fireEvent.click(screen.getByText(/🏆\s*MVP/));
    // No crash = passes
    expect(screen.getByText(/🏆\s*MVP/)).toBeInTheDocument();
  });

  it('opens the MVP card sheet when a top-3 MVP player name is tapped', async () => {
    playerService.getAllCareerStats.mockResolvedValue([
      mkRow('a', 'Alpha', { bat_runs: 300, bowl_wickets: 10 }), // highest → rank 1
      mkRow('b', 'Bravo', { bat_runs: 200, bowl_wickets: 5 }),
      mkRow('c', 'Charlie', { bat_runs: 100, bowl_wickets: 1 }),
      mkRow('d', 'Delta', { bat_runs: 10, bowl_wickets: 0 }),
    ]);
    renderLeaderboard();
    fireEvent.click(screen.getByText(/🏆\s*MVP/));

    // Top player's name renders in the table; tapping it opens the share card
    const alpha = await screen.findByText('Alpha');
    fireEvent.click(alpha);
    await waitFor(() => expect(screen.getByTestId('mvp-card-sheet')).toBeInTheDocument());
    expect(screen.getByText(/MVP card: Alpha #1/)).toBeInTheDocument();
  });

  it('does NOT open the card sheet for a rank 4+ MVP player (navigates instead)', async () => {
    playerService.getAllCareerStats.mockResolvedValue([
      mkRow('a', 'Alpha', { bat_runs: 300, bowl_wickets: 10 }),
      mkRow('b', 'Bravo', { bat_runs: 200, bowl_wickets: 5 }),
      mkRow('c', 'Charlie', { bat_runs: 100, bowl_wickets: 1 }),
      mkRow('d', 'Delta', { bat_runs: 10, bowl_wickets: 0 }), // rank 4
    ]);
    renderLeaderboard();
    fireEvent.click(screen.getByText(/🏆\s*MVP/));

    const delta = await screen.findByText('Delta');
    fireEvent.click(delta);
    // No card sheet for rank 4
    expect(screen.queryByTestId('mvp-card-sheet')).not.toBeInTheDocument();
  });
});

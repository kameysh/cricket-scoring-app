import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ canScore: true, isAdmin: true }) }));
vi.mock('../services/matchService', () => ({
  listMatches: vi.fn(),
  deleteMatch: vi.fn(),
  deleteAllMatches: vi.fn(),
}));
vi.mock('../components/shared/LoadingSkeleton', () => ({ default: () => <div>loading</div> }));
vi.mock('../components/shared/EmptyState', () => ({ default: ({ title }) => <div>{title}</div> }));
vi.mock('../components/shared/ConfirmDialog', () => ({ default: () => null }));
vi.mock('../components/match/MatchCard', () => ({
  default: ({ match, matchNumber }) => (
    <div data-testid="match-card">{`#${matchNumber} ${match.team1_name} vs ${match.team2_name} (${match.status})`}</div>
  ),
}));

import * as matchService from '../services/matchService';
import Matches from './Matches';

const tMatch = (id, status, n) => ({
  id, status, team1_name: 'Lions', team2_name: 'Tigers',
  tournament_id: 'tour-1', tournaments: { name: 'K7 Trophy Season 7' }, created_at: `2026-06-2${n}`,
});
const friendly = (id, status) => ({
  id, status, team1_name: 'Alpha', team2_name: 'Bravo',
  tournament_id: null, tournaments: null, created_at: '2026-06-29',
});

beforeEach(() => vi.clearAllMocks());

describe('Matches — tournament grouping', () => {
  it('groups tournament matches under a collapsible section with the tournament name', async () => {
    matchService.listMatches.mockResolvedValue([tMatch('m1', 'completed', 1), tMatch('m2', 'completed', 2)]);
    render(<Matches />);
    // Section header with name + count
    expect(await screen.findByText('K7 Trophy Season 7')).toBeInTheDocument();
    expect(screen.getByText(/2 matches · 2 completed/)).toBeInTheDocument();
  });

  it('a finished tournament is collapsed by default; clicking the header reveals the matches', async () => {
    matchService.listMatches.mockResolvedValue([tMatch('m1', 'completed', 1), tMatch('m2', 'completed', 2)]);
    render(<Matches />);
    const header = await screen.findByText('K7 Trophy Season 7');
    // Collapsed → no match cards yet
    expect(screen.queryByTestId('match-card')).not.toBeInTheDocument();
    fireEvent.click(header);
    // Expanded → both matches, numbered within the tournament
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
    expect(screen.getByText('#1 Lions vs Tigers (completed)')).toBeInTheDocument();
    expect(screen.getByText('#2 Lions vs Tigers (completed)')).toBeInTheDocument();
  });

  it('keeps an active tournament expanded by default', async () => {
    matchService.listMatches.mockResolvedValue([tMatch('m1', 'completed', 1), tMatch('m2', 'live', 2)]);
    render(<Matches />);
    await screen.findByText('K7 Trophy Season 7');
    // Not all done → expanded → cards visible without clicking
    await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(2));
  });

  it('renders standalone (non-tournament) matches flat, not inside a section', async () => {
    matchService.listMatches.mockResolvedValue([friendly('f1', 'completed')]);
    render(<Matches />);
    await waitFor(() => expect(screen.getByTestId('match-card')).toBeInTheDocument());
    expect(screen.queryByText('K7 Trophy Season 7')).not.toBeInTheDocument();
    expect(screen.getByText(/Alpha vs Bravo/)).toBeInTheDocument();
  });
});

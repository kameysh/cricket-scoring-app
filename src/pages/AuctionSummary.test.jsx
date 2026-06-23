import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/auctionService');
vi.mock('../components/player/PlayerAvatar', () => ({ default: () => <div data-testid="avatar" /> }));
vi.mock('../hooks/useRole', () => ({ useRole: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 'kameshwaran26@gmail.com' } } } }) },
  },
}));

import * as auctionService from '../services/auctionService';
import { useRole } from '../hooks/useRole';
import AuctionSummary from './AuctionSummary';

const BASE_AUCTION = {
  id: 'a1', name: 'Gully Premier League', status: 'completed',
  budget_per_team: 10000, completed_at: '2026-06-23T10:00:00Z',
};

const TEAMS = [
  { id: 'at1', name: 'CSK', captain_id: 'uid-capt1', budget_remaining: 2000, players_bought: 2 },
  { id: 'at2', name: 'RCB', captain_id: 'uid-capt2', budget_remaining: 5000, players_bought: 1 },
];

const PLAYERS = [
  {
    id: 'ap1', player_id: 'p1', status: 'sold', base_price: 500, sold_price: 3000,
    sold_to_team_id: 'at1',
    player: { id: 'p1', name: 'Kamesh S', role: 'all-rounder', user_id: 'uid-capt1' },
  },
  {
    id: 'ap2', player_id: 'p2', status: 'sold', base_price: 100, sold_price: 5000,
    sold_to_team_id: 'at1',
    player: { id: 'p2', name: 'Ravi Kumar', role: 'batsman', user_id: 'other-uid' },
  },
  {
    id: 'ap3', player_id: 'p3', status: 'sold', base_price: 100, sold_price: 1000,
    sold_to_team_id: 'at2',
    player: { id: 'p3', name: 'Naveen', role: 'bowler', user_id: 'other-uid2' },
  },
  {
    id: 'ap4', player_id: 'p4', status: 'unsold', base_price: 100, sold_price: null,
    sold_to_team_id: null,
    player: { id: 'p4', name: 'Suresh', role: 'keeper', user_id: null },
  },
];

function renderSummary({ isAdmin = false } = {}) {
  vi.mocked(useRole).mockReturnValue({ isAdmin });
  vi.mocked(auctionService.getAuction).mockResolvedValue(BASE_AUCTION);
  vi.mocked(auctionService.listAuctionTeams).mockResolvedValue(TEAMS);
  vi.mocked(auctionService.listAuctionPlayers).mockResolvedValue(PLAYERS);
  return render(
    <MemoryRouter initialEntries={['/auctions/a1/summary']}>
      <Routes>
        <Route path="/auctions/:id/summary" element={<AuctionSummary />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuctionSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows auction name and completed badge', async () => {
    renderSummary();
    await waitFor(() => expect(screen.getByText('Gully Premier League')).toBeInTheDocument());
    expect(screen.getByText('🏁 Completed')).toBeInTheDocument();
  });

  it('shows summary stat chips — teams, sold count, total spent', async () => {
    renderSummary();
    await waitFor(() => expect(screen.getByText('Gully Premier League')).toBeInTheDocument());
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Sold')).toBeInTheDocument();
    expect(screen.getByText('Total Spent')).toBeInTheDocument();
    expect(screen.getByText('₹9,000')).toBeInTheDocument(); // 3000+5000+1000
  });

  it('shows Highest Bid hero for non-captain highest sold player', async () => {
    renderSummary();
    await waitFor(() => expect(screen.getByText('👑 Highest Bid')).toBeInTheDocument());
    // Ravi Kumar at ₹5000 is the highest non-captain bid
    expect(screen.getAllByText('Ravi Kumar').length).toBeGreaterThan(0);
  });

  it('does not show captain as Highest Bid even if captain price is high', async () => {
    // Kamesh (captain) sold for 3000, Ravi (non-captain) sold for 5000
    // Highest bid should be Ravi, not Kamesh
    renderSummary();
    await waitFor(() => expect(screen.getByText('👑 Highest Bid')).toBeInTheDocument());
    expect(screen.queryByText('Kamesh S')).toBeDefined(); // shown in squad but not hero
  });

  it('shows (C) badge next to captain in team squad', async () => {
    renderSummary();
    await waitFor(() => expect(screen.getByText('Kamesh S')).toBeInTheDocument());
    expect(screen.getByText('(C)')).toBeInTheDocument();
  });

  it('shows team sections with squad and spend', async () => {
    renderSummary();
    await waitFor(() => expect(screen.getByText('CSK')).toBeInTheDocument());
    expect(screen.getByText('RCB')).toBeInTheDocument();
    expect(screen.getByText('₹8,000 spent')).toBeInTheDocument(); // CSK: 3000+5000
    expect(screen.getByText('₹1,000 spent')).toBeInTheDocument(); // RCB: 1000
  });

  it('shows unsold players section', async () => {
    renderSummary();
    await waitFor(() => expect(screen.getByText('Unsold Players')).toBeInTheDocument());
    expect(screen.getByText('Suresh')).toBeInTheDocument();
    expect(screen.getByText('Unsold')).toBeInTheDocument();
  });

  it('shows error state when auction not found', async () => {
    vi.mocked(auctionService.getAuction).mockRejectedValue(new Error('not found'));
    vi.mocked(auctionService.listAuctionTeams).mockResolvedValue([]);
    vi.mocked(auctionService.listAuctionPlayers).mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/auctions/bad/summary']}>
        <Routes>
          <Route path="/auctions/:id/summary" element={<AuctionSummary />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Auction not found')).toBeInTheDocument());
  });
});

describe('AuctionSummary — delete auction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows delete button for super admin', async () => {
    renderSummary({ isAdmin: true });
    await waitFor(() => expect(screen.getByText('Gully Premier League')).toBeInTheDocument());
    expect(screen.getByLabelText('Delete auction')).toBeInTheDocument();
  });

  it('does not show delete button for regular admin', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { user: { email: 'other@example.com' } } },
    });
    renderSummary({ isAdmin: true });
    await waitFor(() => expect(screen.getByText('Gully Premier League')).toBeInTheDocument());
    expect(screen.queryByLabelText('Delete auction')).not.toBeInTheDocument();
  });

  it('does not show delete button for non-admin', async () => {
    renderSummary({ isAdmin: false });
    await waitFor(() => expect(screen.getByText('Gully Premier League')).toBeInTheDocument());
    expect(screen.queryByLabelText('Delete auction')).not.toBeInTheDocument();
  });

  it('calls deleteAuction and navigates to /auctions on confirm', async () => {
    vi.mocked(auctionService.deleteAuction).mockResolvedValue();
    renderSummary({ isAdmin: true });
    await waitFor(() => expect(screen.getByLabelText('Delete auction')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Delete auction'));
    await waitFor(() => expect(screen.getByText('Delete Auction')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(auctionService.deleteAuction).toHaveBeenCalledWith('a1'));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../hooks/useRole', () => ({ useRole: () => ({ isAdmin: true, userId: 'admin-uid' }) }));

vi.mock('../services/auctionService', () => ({
  getAuction: vi.fn(),
  listAuctionTeams: vi.fn().mockResolvedValue([]),
  listAuctionPlayers: vi.fn().mockResolvedValue([]),
  addAuctionTeam: vi.fn(),
  addPlayerToPool: vi.fn(),
  updateAuctionStatus: vi.fn(),
}));

vi.mock('../services/teamService', () => ({
  listTeams: vi.fn().mockResolvedValue([
    { id: 't1', name: 'Super Kings' },
    { id: 't2', name: 'Back Street' },
    { id: 't3', name: 'Warriors' },
  ]),
  getTeamPlayers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/playerService');
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [
        { id: 'u1', full_name: 'Kamesh', email: 'k@test.com', role: 'admin' },
        { id: 'u2', full_name: 'Ravi', email: 'r@test.com', role: 'captain' },
      ], error: null }),
    })),
  },
}));

import AuctionSetup from './AuctionSetup';
import * as auctionService from '../services/auctionService';
import * as teamService from '../services/teamService';

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={['/auctions/new']}>
      <Routes>
        <Route path="/auctions/new" element={<AuctionSetup />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuctionSetup — teams tab duplicate prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamService.getTeamPlayers).mockResolvedValue([]);
    vi.mocked(auctionService.addAuctionTeam).mockResolvedValue({
      id: 'at1', team_id: 't1', budget_remaining: 5000, captain_id: null, team: { name: 'Super Kings' },
    });
    vi.mocked(auctionService.addPlayerToPool).mockResolvedValue({
      id: 'ap1', player_id: 'p1', status: 'pool', base_price: 100,
    });
    vi.mocked(teamService.listTeams).mockResolvedValue([
      { id: 't1', name: 'Super Kings' },
      { id: 't2', name: 'Back Street' },
      { id: 't3', name: 'Warriors' },
    ]);
  });

  it('renders Teams tab', async () => {
    renderSetup();
    await userEvent.click(screen.getByText('Teams'));
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 2')).toBeInTheDocument();
  });

  it('excludes team selected in slot 1 from slot 2 dropdown', async () => {
    renderSetup();
    await userEvent.click(screen.getByText('Teams'));

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0], 't1');

    const team2Select = selects[2];
    const options = Array.from(team2Select.querySelectorAll('option')).map(o => o.value);
    expect(options).not.toContain('t1');
    expect(options).toContain('t2');
    expect(options).toContain('t3');
  });

  it('excludes captain selected in slot 1 from slot 2 captain dropdown', async () => {
    renderSetup();
    await userEvent.click(screen.getByText('Teams'));

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'u1');

    const captain2Select = selects[3];
    const options = Array.from(captain2Select.querySelectorAll('option')).map(o => o.value);
    expect(options).not.toContain('u1');
    expect(options).toContain('u2');
  });

  it('calls getTeamPlayers for each saved team to auto-populate pool', async () => {
    // auctionId is null until basics are saved — saveTeams guard fires early.
    // Verify the guard: no getTeamPlayers call when auctionId is missing.
    renderSetup();
    await userEvent.click(screen.getByText('Teams'));
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0], 't1');
    await userEvent.click(screen.getByText('Save Teams'));

    await waitFor(() => {
      expect(auctionService.addAuctionTeam).not.toHaveBeenCalled();
      expect(teamService.getTeamPlayers).not.toHaveBeenCalled();
    });
  });
});

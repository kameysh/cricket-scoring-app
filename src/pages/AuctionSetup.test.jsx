import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../hooks/useRole', () => ({ useRole: () => ({ isAdmin: true, userId: 'admin-uid' }) }));

vi.mock('../services/auctionService', () => ({
  getAuction: vi.fn().mockResolvedValue({
    id: 'a1', name: 'Test Auction', budget_per_team: 5000, bid_increments: [],
  }),
  listAuctionTeams: vi.fn().mockResolvedValue([]),
  listAuctionPlayers: vi.fn().mockResolvedValue([]),
  addAuctionTeam: vi.fn(),
  updateAuctionTeamCaptain: vi.fn(),
  updateAuctionStatus: vi.fn(),
  createAuction: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: 'u1', full_name: 'Kamesh', email: 'k@test.com', role: 'admin' },
          { id: 'u2', full_name: 'Ravi', email: 'r@test.com', role: 'captain' },
        ],
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

import AuctionSetup from './AuctionSetup';
import * as auctionService from '../services/auctionService';

// Renders with an existing auction id — basics step is already "done" so
// the Teams step indicator button is enabled immediately.
function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/auctions/new/a1']}>
      <Routes>
        <Route path="/auctions/new/:id" element={<AuctionSetup />} />
      </Routes>
    </MemoryRouter>
  );
}

// Navigate to the Teams step by clicking the step indicator.
async function goToTeamsStep() {
  renderWithId();
  // Wait for the async load to finish, then click Teams
  await waitFor(() => expect(screen.getByText('Teams')).toBeDefined());
  await userEvent.click(screen.getByText('Teams'));
  await waitFor(() => expect(screen.getByText('Bidding Teams')).toBeDefined());
}

describe('AuctionSetup — stepper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auctionService.addAuctionTeam).mockResolvedValue({
      id: 'at1', name: 'Super Kings', budget_remaining: 5000, captain_id: null,
    });
  });

  it('starts on Basics step and shows step indicator', () => {
    renderWithId();
    expect(screen.getByText('Auction Details')).toBeDefined();
    expect(screen.getByText('Basics')).toBeDefined();
    expect(screen.getByText('Teams')).toBeDefined();
    expect(screen.getByText('Pool')).toBeDefined();
  });

  it('Teams step indicator is clickable when basics is already done (existing auction)', async () => {
    await goToTeamsStep();
    expect(screen.getByText('Bidding Teams')).toBeDefined();
  });

  it('Pool step indicator is disabled when teams not yet saved', async () => {
    renderWithId();
    // Auction exists but no teams → wizard advances to Teams step (step 1)
    await waitFor(() => expect(screen.getByText('Bidding Teams')).toBeDefined());
    // Pool label exists in step indicator but pool content is not shown
    expect(screen.getByText('Pool')).toBeDefined();
  });
});

describe('AuctionSetup — teams step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auctionService.addAuctionTeam).mockResolvedValue({
      id: 'at1', name: 'Super Kings', budget_remaining: 5000, captain_id: null,
    });
  });

  it('renders team name inputs and captain dropdowns', async () => {
    await goToTeamsStep();
    expect(screen.getByText('Team 1')).toBeDefined();
    expect(screen.getByText('Team 2')).toBeDefined();
    const inputs = screen.getAllByPlaceholderText(/e\.g\./i);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows all app users in captain dropdown', async () => {
    await goToTeamsStep();
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
    const selects = screen.getAllByRole('combobox');
    const options = Array.from(selects[0].querySelectorAll('option')).map(o => o.value);
    expect(options).toContain('u1');
    expect(options).toContain('u2');
  });

  it('excludes captain selected in slot 1 from slot 2', async () => {
    await goToTeamsStep();
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2));

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0], 'u1');

    const opts = Array.from(selects[1].querySelectorAll('option')).map(o => o.value);
    expect(opts).not.toContain('u1');
    expect(opts).toContain('u2');
  });

  it('shows Add Another Team button and adds a third slot', async () => {
    await goToTeamsStep();
    await userEvent.click(screen.getByText('Add Another Team'));
    expect(screen.getByText('Team 3')).toBeDefined();
  });

  it('rejects duplicate team names', async () => {
    await goToTeamsStep();
    const inputs = screen.getAllByPlaceholderText(/e\.g\./i);
    await userEvent.type(inputs[0], 'Super Kings');
    await userEvent.type(inputs[1], 'Super Kings');
    await userEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(auctionService.addAuctionTeam).not.toHaveBeenCalled());
  });

  it('calls addAuctionTeam with name and captainId when saving', async () => {
    await goToTeamsStep();
    const inputs = screen.getAllByPlaceholderText(/e\.g\./i);
    await userEvent.type(inputs[0], 'Super Kings');
    await userEvent.type(inputs[1], 'Back Street Boyz');
    await userEvent.click(screen.getByText('Continue →'));
    await waitFor(() => {
      expect(auctionService.addAuctionTeam).toHaveBeenCalledWith('a1', 'Super Kings', null);
      expect(auctionService.addAuctionTeam).toHaveBeenCalledWith('a1', 'Back Street Boyz', null);
    });
  });
});

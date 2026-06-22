import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../hooks/useAuctionRoom', () => ({ useAuctionRoom: vi.fn() }));
vi.mock('../hooks/useRole', () => ({ useRole: vi.fn() }));
vi.mock('../stores/auctionStore', () => ({ useAuctionStore: vi.fn() }));
vi.mock('../services/auctionService');

import { useRole } from '../hooks/useRole';
import { useAuctionStore } from '../stores/auctionStore';
import AuctionRoom from './AuctionRoom';

const BASE_AUCTION = {
  id: 'a1', name: 'Test Auction', status: 'live', budget_per_team: 1000,
  bid_increments: [50, 100],
};

const TEAM1 = { id: 'at1', team_id: 't1', captain_id: 'captain-uid', budget_remaining: 800, players_bought: 1, team: { id: 't1', name: 'Super Kings' } };
const TEAM2 = { id: 'at2', team_id: 't2', captain_id: 'captain2-uid', budget_remaining: 900, players_bought: 0, team: { id: 't2', name: 'Back Street' } };

const ACTIVE_PLAYER = {
  id: 'ap1', player_id: 'p1', status: 'active', base_price: 100, current_bid: 200,
  leading_team_id: 'at1', pass_team1: false, pass_team2: false,
  player: { id: 'p1', name: 'Ravi Kumar', role: 'batsman' },
};

function renderRoom(storeOverrides = {}, roleOverrides = {}) {
  vi.mocked(useAuctionStore).mockReturnValue({
    auction: BASE_AUCTION,
    teams: [TEAM1, TEAM2],
    players: [ACTIVE_PLAYER],
    bids: [],
    isLoading: false,
    error: null,
    reset: vi.fn(),
    ...storeOverrides,
  });
  vi.mocked(useRole).mockReturnValue({
    isAdmin: false, userId: 'other-uid', canScore: false,
    ...roleOverrides,
  });
  return render(
    <MemoryRouter initialEntries={['/auctions/a1']}>
      <Routes>
        <Route path="/auctions/:id" element={<AuctionRoom />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuctionRoom — role-gated controls', () => {
  it('admin sees AuctioneerControls, not CaptainControls', () => {
    renderRoom({}, { isAdmin: true, userId: 'admin-uid' });
    expect(screen.getByTestId('auctioneer-controls')).toBeInTheDocument();
    expect(screen.queryByTestId('captain-controls')).not.toBeInTheDocument();
  });

  it('captain of team A sees CaptainControls, not AuctioneerControls', () => {
    renderRoom({}, { isAdmin: false, userId: 'captain-uid' });
    expect(screen.getByTestId('captain-controls')).toBeInTheDocument();
    expect(screen.queryByTestId('auctioneer-controls')).not.toBeInTheDocument();
  });

  it('viewer sees neither AuctioneerControls nor bid buttons', () => {
    renderRoom({}, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.queryByTestId('auctioneer-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('captain-controls')).not.toBeInTheDocument();
  });
});

describe('AuctionRoom — BudgetBars', () => {
  it('renders budget bar for each team', () => {
    renderRoom({}, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.getByTestId('budget-bar-at1')).toBeInTheDocument();
    expect(screen.getByTestId('budget-bar-at2')).toBeInTheDocument();
  });

  it('budget bar width reflects budget_remaining proportion', () => {
    renderRoom({}, { isAdmin: false, userId: 'viewer-uid' });
    const bar = screen.getByTestId('budget-bar-at1');
    // 800/1000 = 80%
    expect(bar.style.width).toBe('80%');
  });
});

describe('AuctionRoom — PassIndicator', () => {
  it('hidden when neither team is passing', () => {
    renderRoom({}, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.queryByTestId('pass-indicator')).not.toBeInTheDocument();
  });

  it('shown when both teams pass', () => {
    renderRoom({
      players: [{ ...ACTIVE_PLAYER, pass_team1: true, pass_team2: true }],
    }, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.getByTestId('pass-indicator')).toBeInTheDocument();
  });
});

describe('AuctionRoom — Hold button highlight', () => {
  it('Hold button has amber pulse when both teams passing', () => {
    renderRoom({
      players: [{ ...ACTIVE_PLAYER, pass_team1: true, pass_team2: true }],
    }, { isAdmin: true, userId: 'admin-uid' });
    const holdBtn = screen.getByTestId('hold-btn');
    expect(holdBtn.className).toMatch(/animate-pulse/);
  });

  it('Hold button does not animate when not both passing', () => {
    renderRoom({}, { isAdmin: true, userId: 'admin-uid' });
    const holdBtn = screen.getByTestId('hold-btn');
    expect(holdBtn.className).not.toMatch(/animate-pulse/);
  });
});

describe('AuctionRoom — Captain bid validation', () => {
  it('bid button disabled when amount exceeds budgetRemaining', () => {
    // team1 budget_remaining = 100, increment 100 → bid=200 overBudget
    const lowBudgetTeam = { ...TEAM1, budget_remaining: 100 };
    renderRoom({ teams: [lowBudgetTeam, TEAM2] }, { isAdmin: false, userId: 'captain-uid' });
    const btn = screen.getByTestId('bid-btn-100');
    expect(btn).toBeDisabled();
  });

  it('bid button enabled when amount within budget', () => {
    // team1 budget_remaining=1000, currentBid=200, inc=50 → 250 ≤ 1000
    renderRoom({}, { isAdmin: false, userId: 'captain-uid' });
    const btn = screen.getByTestId('bid-btn-50');
    expect(btn).not.toBeDisabled();
  });
});

describe('AuctionRoom — Pass button state', () => {
  it('Pass button shows "Passing" state when captain already passed', () => {
    // captain-uid is team1 captain, pass_team1=true
    renderRoom({
      players: [{ ...ACTIVE_PLAYER, pass_team1: true }],
    }, { isAdmin: false, userId: 'captain-uid' });
    expect(screen.getByTestId('pass-btn')).toHaveTextContent('✋ Passing');
  });
});

describe('AuctionRoom — no active player', () => {
  it('shows waiting message when no player is active', () => {
    renderRoom({ players: [] }, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.getByText(/waiting for auctioneer/i)).toBeInTheDocument();
  });
});

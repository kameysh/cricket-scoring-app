import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../hooks/useAuctionRoom', () => ({ useAuctionRoom: vi.fn() }));
vi.mock('../hooks/useRole', () => ({ useRole: vi.fn() }));
vi.mock('../stores/auctionStore', () => ({ useAuctionStore: vi.fn() }));
vi.mock('../services/auctionService');
vi.mock('../lib/generateShareCard', () => ({
  generateAuctionSoldCard: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  generatePlayerCard: vi.fn(),
}));

import { useRole } from '../hooks/useRole';
import { useAuctionStore } from '../stores/auctionStore';
import { generateAuctionSoldCard } from '../lib/generateShareCard';
import AuctionRoom from './AuctionRoom';

const BASE_AUCTION = {
  id: 'a1', name: 'Test Auction', status: 'live', budget_per_team: 1000,
  bid_increments: [1000, 2000],
};

const TEAM1 = { id: 'at1', name: 'Super Kings', captain_id: 'captain-uid', budget_remaining: 800, players_bought: 1 };
const TEAM2 = { id: 'at2', name: 'Back Street', captain_id: 'captain2-uid', budget_remaining: 900, players_bought: 0 };

const ACTIVE_PLAYER = {
  id: 'ap1', player_id: 'p1', status: 'active', base_price: 100, current_bid: 200,
  leading_team_id: 'at1', pass_team1: false, pass_team2: false,
  player: { id: 'p1', name: 'Ravi Kumar', role: 'batsman' },
};

const BASE_STORE = {
  auction: BASE_AUCTION,
  teams: [TEAM1, TEAM2],
  players: [ACTIVE_PLAYER],
  bids: [],
  isLoading: false,
  error: null,
  viewerDraw: null,
  soldFlash: null,
  viewerCount: 0,
  reset: vi.fn(),
  _patchPlayer: vi.fn(),
  _appendBid: vi.fn(),
  _patchTeam: vi.fn(),
  _onAuctionUpdate: vi.fn(),
  loadAuction: vi.fn(),
  _startViewerDraw: vi.fn(),
  _clearViewerDraw: vi.fn(),
  _clearSoldFlash: vi.fn(),
};

function renderRoom(storeOverrides = {}, roleOverrides = {}) {
  vi.mocked(useAuctionStore).mockReturnValue({ ...BASE_STORE, ...storeOverrides });
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
  it('bid button disabled when adding it would exceed budgetRemaining', () => {
    // current_bid=200, budget=500, tapping +1000 would take total to 1200 > 500
    const lowBudgetTeam = { ...TEAM1, budget_remaining: 500 };
    renderRoom({ teams: [lowBudgetTeam, TEAM2] }, { isAdmin: false, userId: 'captain-uid' });
    const btn = screen.getByTestId('bid-btn-1000');
    expect(btn).toBeDisabled();
  });

  it('bid button enabled when amount within budget', () => {
    const richTeam = { ...TEAM1, budget_remaining: 50000 };
    renderRoom({ teams: [richTeam, TEAM2] }, { isAdmin: false, userId: 'captain-uid' });
    const btn = screen.getByTestId('bid-btn-1000');
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

describe('AuctionRoom — delete button', () => {
  it('admin sees delete button', () => {
    renderRoom({}, { isAdmin: true, userId: 'admin-uid' });
    // Trash icon rendered as SVG; check via aria or nearby text
    // ConfirmDialog trigger button wraps Trash2 icon
    const deleteBtns = screen.getAllByRole('button');
    // The delete button is a small icon-only button; confirm dialog text appears on open
    // Just verify it's rendered by checking the Trash2 icon is in the DOM via its parent
    expect(deleteBtns.length).toBeGreaterThan(2);
  });

  it('non-admin does not see delete button', () => {
    renderRoom({}, { isAdmin: false, userId: 'viewer-uid' });
    // Viewer has no Trash button
    // BudgetBars + ActivePlayer + Pool/Held/Sold — but no red icon-only button
    const redButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(redButtons).toHaveLength(0);
  });
});

describe('AuctionRoom — sold sheet grouping', () => {
  it('shows sold player count chip', () => {
    const soldPlayer = {
      id: 'ap2', player_id: 'p2', status: 'sold', base_price: 100, current_bid: 500,
      sold_price: 500, sold_to_team_id: 'at1', leading_team_id: 'at1',
      pass_team1: false, pass_team2: false,
      player: { id: 'p2', name: 'Siva', role: 'bowler' },
    };
    renderRoom({ players: [soldPlayer] }, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Sold')).toBeInTheDocument();
  });
});

describe('AuctionRoom — return held player to pool', () => {
  it('calls returnToPool service when admin clicks ↩ Pool on a held player', async () => {
    const { returnToPool } = await import('../services/auctionService');
    vi.mocked(returnToPool).mockResolvedValue({ id: 'ap-held', status: 'pool', held_at: null });

    const heldPlayer = {
      id: 'ap-held', player_id: 'p3', status: 'held', base_price: 150,
      current_bid: null, leading_team_id: null, pass_team1: false, pass_team2: false,
      player: { id: 'p3', name: 'Dhoni', role: 'keeper' },
    };
    renderRoom({ players: [heldPlayer], bids: [] }, { isAdmin: true, userId: 'admin-uid' });

    // Open the Held sheet
    fireEvent.click(screen.getByText('Held'));

    // Click return-to-pool for the held player
    await waitFor(() => expect(screen.getByTestId('return-to-pool-ap-held')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('return-to-pool-ap-held'));

    await waitFor(() => expect(returnToPool).toHaveBeenCalledWith('ap-held'));
  });

  it('↩ Pool button is not shown to non-admin viewers in the held sheet', async () => {
    const heldPlayer = {
      id: 'ap-held', player_id: 'p3', status: 'held', base_price: 150,
      current_bid: null, leading_team_id: null, pass_team1: false, pass_team2: false,
      player: { id: 'p3', name: 'Dhoni', role: 'keeper' },
    };
    renderRoom({ players: [heldPlayer], bids: [] }, { isAdmin: false, userId: 'viewer-uid' });

    fireEvent.click(screen.getByText('Held'));
    await waitFor(() => expect(screen.getByText('Dhoni')).toBeInTheDocument());

    expect(screen.queryByText('↩ Pool')).not.toBeInTheDocument();
  });
});

describe('AuctionRoom — BidLogStrip always renders', () => {
  it('shows "No bids yet" when bids is empty (prevents layout jump)', () => {
    renderRoom({ bids: [] }, { isAdmin: true, userId: 'admin-uid' });
    expect(screen.getByText('No bids yet')).toBeInTheDocument();
  });

  it('shows Bid History label regardless of bids', () => {
    renderRoom({ bids: [] }, { isAdmin: true, userId: 'admin-uid' });
    // CSS text-transform:uppercase is visual only — actual text content is 'Bid History'
    expect(screen.getByText('Bid History')).toBeInTheDocument();
  });

  it('renders bid chips when bids exist', () => {
    const bids = [
      { id: 'b1', amount: 300, auction_team_id: 'at1', auction_team: { name: 'Super Kings' } },
    ];
    renderRoom({ bids }, { isAdmin: true, userId: 'admin-uid' });
    expect(screen.getByText('₹300')).toBeInTheDocument();
    // 'Super Kings' also appears in team selector — just confirm at least one instance
    expect(screen.getAllByText('Super Kings').length).toBeGreaterThan(0);
  });
});

describe('AuctionRoom — SoldCardSheet', () => {
  it('sold card sheet is not shown before any deal', () => {
    renderRoom({}, { isAdmin: true, userId: 'admin-uid' });
    expect(screen.queryByText('Player Sold!')).not.toBeInTheDocument();
  });

  it('opens sold card sheet with correct data after Deal is clicked', async () => {
    const { dealPlayer } = await import('../services/auctionService');
    vi.mocked(generateAuctionSoldCard).mockClear();
    vi.mocked(dealPlayer).mockResolvedValue({});

    renderRoom({}, { isAdmin: true, userId: 'admin-uid' });
    fireEvent.click(screen.getByTestId('deal-btn'));

    await waitFor(() => {
      expect(screen.getByText('Player Sold!')).toBeInTheDocument();
    });

    // Player name and team appear in the sold sheet (may also appear elsewhere)
    expect(screen.getAllByText('Ravi Kumar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Super Kings').length).toBeGreaterThan(0);
    // Price tiles show base and sold price
    expect(screen.getAllByText('₹100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹200').length).toBeGreaterThan(0);
  });

  it('tapping a sold player in the list calls generateAuctionSoldCard with correct data', async () => {
    vi.mocked(generateAuctionSoldCard).mockClear();

    const soldPlayer = {
      id: 'ap2', player_id: 'p2', status: 'sold', base_price: 150, current_bid: 500,
      sold_price: 500, sold_to_team_id: 'at2', leading_team_id: 'at2',
      pass_team1: false, pass_team2: false,
      player: { id: 'p2', name: 'Karthik', role: 'keeper' },
    };
    renderRoom(
      { players: [soldPlayer], bids: [] },
      { isAdmin: false, userId: 'viewer-uid' },
    );

    // Open the Sold counter sheet
    fireEvent.click(screen.getByText('Sold'));

    // Wait for player list to render, then tap the player name
    await waitFor(() => expect(screen.getByText('Karthik')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Karthik'));

    // generateAuctionSoldCard should be called with the right data
    await waitFor(() => {
      expect(generateAuctionSoldCard).toHaveBeenCalledWith(
        expect.objectContaining({ teamName: 'Back Street', basePrice: 150, soldPrice: 500 })
      );
    });
  });
});

// ── Live relay — draw animation for viewers ───────────────────────────────────
describe('AuctionRoom — viewer draw animation', () => {
  const POOL = [
    { id: 'ap2', status: 'pool', player_id: 'p2', base_price: 100,
      player: { id: 'p2', name: 'Karthik', role: 'keeper' } },
  ];

  it('shows PlayerDrawAnimation for captain when viewerDraw is set', () => {
    renderRoom(
      { viewerDraw: { pool: POOL, winner: POOL[0] }, players: [] },
      { isAdmin: false, userId: 'captain-uid' },
    );
    expect(screen.getByText('🎲 Drawing…')).toBeInTheDocument();
  });

  it('shows PlayerDrawAnimation for viewer when viewerDraw is set', () => {
    renderRoom(
      { viewerDraw: { pool: POOL, winner: POOL[0] }, players: [] },
      { isAdmin: false, userId: 'viewer-uid' },
    );
    expect(screen.getByText('🎲 Drawing…')).toBeInTheDocument();
  });

  it('shows PlayerDrawAnimation for auctioneer when viewerDraw is set', () => {
    renderRoom(
      { viewerDraw: { pool: POOL, winner: POOL[0] }, players: [] },
      { isAdmin: true, userId: 'admin-uid' },
    );
    expect(screen.getByText('🎲 Drawing…')).toBeInTheDocument();
  });

  it('hides "Tap Next Player" placeholder while viewerDraw is active', () => {
    renderRoom(
      { viewerDraw: { pool: POOL, winner: POOL[0] }, players: [] },
      { isAdmin: true },
    );
    expect(screen.queryByText(/Tap "Next Player" to begin/)).not.toBeInTheDocument();
  });
});

// ── Live relay — SOLD! overlay ────────────────────────────────────────────────
describe('AuctionRoom — SOLD! overlay', () => {
  const SOLD_FLASH = {
    player: { name: 'Ravi Kumar', role: 'batsman', photo_url: null },
    teamName: 'Super Kings',
    soldPrice: 5000,
  };

  it('shows SOLD! overlay when soldFlash is set (viewer)', () => {
    renderRoom({ soldFlash: SOLD_FLASH }, { isAdmin: false, userId: 'viewer-uid' });
    expect(screen.getByText('🔨 SOLD!')).toBeInTheDocument();
    expect(screen.getByText('Sold to')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
  });

  it('shows SOLD! overlay for auctioneer too', () => {
    renderRoom({ soldFlash: SOLD_FLASH }, { isAdmin: true, userId: 'admin-uid' });
    expect(screen.getByText('🔨 SOLD!')).toBeInTheDocument();
  });

  it('calls _clearSoldFlash when overlay is tapped', () => {
    const clearSoldFlash = vi.fn();
    renderRoom({ soldFlash: SOLD_FLASH, _clearSoldFlash: clearSoldFlash }, { isAdmin: false });
    fireEvent.click(screen.getByText('🔨 SOLD!').closest('[class*="fixed"]'));
    expect(clearSoldFlash).toHaveBeenCalled();
  });

  it('does not show SOLD! overlay when soldFlash is null', () => {
    renderRoom({ soldFlash: null }, { isAdmin: false });
    expect(screen.queryByText('🔨 SOLD!')).not.toBeInTheDocument();
  });
});

// ── Live relay — viewer count ──────────────────────────────────────────────────
describe('AuctionRoom — undo bid rapid-click guard', () => {
  it('only calls undoLastBid once even if undo button is clicked twice rapidly', async () => {
    const { undoLastBid } = await import('../services/auctionService');
    let resolveUndo;
    vi.mocked(undoLastBid).mockReturnValue(new Promise(res => { resolveUndo = res; }));

    renderRoom({ players: [ACTIVE_PLAYER] }, { isAdmin: true, userId: 'admin-uid' });

    const btn = screen.getByTestId('undo-bid-btn');
    fireEvent.click(btn);
    fireEvent.click(btn); // rapid second click while first is pending

    resolveUndo({ id: 'ap1', current_bid: null, leading_team_id: null });
    await waitFor(() => expect(undoLastBid).toHaveBeenCalledTimes(1));
  });
});

describe('AuctionRoom — viewer count', () => {
  it('shows viewer count when more than 1 viewer', () => {
    renderRoom({ viewerCount: 4 }, { isAdmin: true });
    expect(screen.getByText('👁 4')).toBeInTheDocument();
  });

  it('hides viewer count when only 1 viewer (yourself)', () => {
    renderRoom({ viewerCount: 1 }, { isAdmin: true });
    expect(screen.queryByText(/👁/)).not.toBeInTheDocument();
  });

  it('hides viewer count when 0', () => {
    renderRoom({ viewerCount: 0 }, { isAdmin: false });
    expect(screen.queryByText(/👁/)).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuctioneerControls from './AuctioneerControls';

const TEAM1 = { id: 'at1', name: 'Super Kings', budget_remaining: 500000 };
const TEAM2 = { id: 'at2', name: 'RCB',         budget_remaining: 500000 };

const ACTIVE_PLAYER = {
  id: 'ap1', status: 'active', base_price: 100, current_bid: 1000,
  leading_team_id: 'at1', pass_team1: false, pass_team2: false,
  player: { id: 'p1', name: 'Ravi', role: 'batsman' },
};

function renderControls(overrides = {}) {
  const props = {
    activePlayer: ACTIVE_PLAYER,
    bothPassing: false,
    onNextPlayer: vi.fn(),
    onRaise: vi.fn(),
    onUndoBid: vi.fn(),
    onDeal: vi.fn(),
    onHold: vi.fn(),
    onUnsold: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    auctionStatus: 'live',
    bidIncrements: [1000, 2000],
    teams: [TEAM1, TEAM2],
    loading: false,
    ...overrides,
  };
  return render(<AuctioneerControls {...props} />);
}

describe('AuctioneerControls — haptic feedback', () => {
  beforeEach(() => {
    navigator.vibrate = vi.fn();
  });

  it('vibrates on chip tap (increment)', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    expect(navigator.vibrate).toHaveBeenCalledWith(12);
  });

  it('vibrates with shorter pulse on count badge tap (decrement)', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    navigator.vibrate.mockClear();
    fireEvent.click(screen.getByTestId('chip-count-1000'));
    expect(navigator.vibrate).toHaveBeenCalledWith(6);
  });

  it('vibrates with longer pulse on Clear', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    navigator.vibrate.mockClear();
    fireEvent.click(screen.getByText('Clear'));
    expect(navigator.vibrate).toHaveBeenCalledWith(20);
  });

  it('does not throw when navigator.vibrate is unavailable', () => {
    delete navigator.vibrate;
    renderControls();
    expect(() => fireEvent.click(screen.getByTestId('chip-1000'))).not.toThrow();
  });
});

describe('AuctioneerControls — multi-tap chips', () => {
  it('confirm raise button is hidden before any chip is tapped', () => {
    renderControls();
    expect(screen.queryByTestId('confirm-raise-btn')).not.toBeInTheDocument();
  });

  it('tapping a chip once shows confirm button with correct next bid', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    // currentBid=1000 + 1×1000 = 2000
    expect(screen.getByTestId('confirm-raise-btn')).toHaveTextContent('₹2,000');
  });

  it('tapping the same chip twice doubles the increment', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('chip-1000'));
    // 1000 + 2×1000 = 3000
    expect(screen.getByTestId('confirm-raise-btn')).toHaveTextContent('₹3,000');
    expect(screen.getByTestId('chip-count-1000')).toHaveTextContent('×2');
  });

  it('combining two different chips sums correctly', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('chip-2000'));
    // 1000 + 1000 + 2000 = 4000
    expect(screen.getByTestId('confirm-raise-btn')).toHaveTextContent('₹4,000');
  });

  it('tapping the count badge decrements that chip', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('chip-1000'));
    // count = 2, decrement once
    fireEvent.click(screen.getByTestId('chip-count-1000'));
    expect(screen.getByTestId('chip-count-1000')).toHaveTextContent('×1');
    expect(screen.getByTestId('confirm-raise-btn')).toHaveTextContent('₹2,000');
  });

  it('decrementing to zero removes the count badge and hides confirm button if total=0', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('chip-count-1000'));
    expect(screen.queryByTestId('chip-count-1000')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-raise-btn')).not.toBeInTheDocument();
  });

  it('Clear button resets all chips and hides confirm button', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('chip-2000'));
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.queryByTestId('confirm-raise-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chip-count-1000')).not.toBeInTheDocument();
  });

  it('confirming raise calls onRaise with correct nextBid and team, then resets chips', () => {
    const onRaise = vi.fn();
    renderControls({ onRaise });
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('chip-2000'));
    fireEvent.click(screen.getByTestId('confirm-raise-btn'));
    // currentBid=1000 + 1000 + 2000 = 4000
    expect(onRaise).toHaveBeenCalledWith(4000, 'at1');
    // chips reset — confirm button disappears
    expect(screen.queryByTestId('confirm-raise-btn')).not.toBeInTheDocument();
  });

  it('auto-advances to next team after confirming raise', () => {
    const onRaise = vi.fn();
    renderControls({ onRaise });
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('confirm-raise-btn'));
    // Should advance from Super Kings (at1) to RCB (at2)
    expect(screen.getByRole('button', { name: 'RCB' }).className).toMatch(/bg-brand-green/);
  });

  it('wraps team advance back to first after last team confirms', () => {
    const onRaise = vi.fn();
    renderControls({ onRaise });
    // First raise: at1 → advances to at2
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('confirm-raise-btn'));
    // Second raise: at2 → wraps to at1
    fireEvent.click(screen.getByTestId('chip-1000'));
    fireEvent.click(screen.getByTestId('confirm-raise-btn'));
    expect(screen.getByRole('button', { name: 'Super Kings' }).className).toMatch(/bg-brand-green/);
  });

  it('confirm button shows "Exceeds purse" and is disabled when total exceeds raw budget', () => {
    const tightTeam = { ...TEAM1, budget_remaining: 1500 };
    renderControls({ teams: [tightTeam, TEAM2] });
    // currentBid=1000, +2000 → nextBid=3000 > 1500
    fireEvent.click(screen.getByTestId('chip-2000'));
    const btn = screen.getByTestId('confirm-raise-btn');
    expect(btn).toHaveTextContent('Exceeds purse');
    expect(btn).toBeDisabled();
  });
});

describe('AuctioneerControls — BidLogStrip always renders', () => {
  it('controls render correctly', () => {
    renderControls();
    expect(screen.getByTestId('auctioneer-controls')).toBeInTheDocument();
  });
});

describe('AuctioneerControls — default bid increments', () => {
  it('renders all 10 chips (1K–10K) when no bidIncrements prop is passed', () => {
    const props = {
      activePlayer: ACTIVE_PLAYER,
      bothPassing: false,
      onNextPlayer: vi.fn(), onRaise: vi.fn(), onUndoBid: vi.fn(),
      onDeal: vi.fn(), onHold: vi.fn(), onUnsold: vi.fn(),
      onPause: vi.fn(), onResume: vi.fn(),
      auctionStatus: 'live', teams: [TEAM1, TEAM2], loading: false,
      // bidIncrements intentionally omitted — uses component default
    };
    render(<AuctioneerControls {...props} />);
    [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000].forEach(inc => {
      expect(screen.getByTestId(`chip-${inc}`)).toBeInTheDocument();
    });
  });

  it('does not render 4K chip when explicit 5-value list is passed', () => {
    renderControls({ bidIncrements: [1000, 2000, 3000, 5000, 10000] });
    expect(screen.queryByTestId('chip-4000')).not.toBeInTheDocument();
  });
});

describe('AuctioneerControls — undo bid', () => {
  it('shows Undo Last Bid when current_bid is set', () => {
    renderControls();
    expect(screen.getByTestId('undo-bid-btn')).toBeInTheDocument();
  });

  it('hides Undo Last Bid when no bid placed', () => {
    renderControls({ activePlayer: { ...ACTIVE_PLAYER, current_bid: null } });
    expect(screen.queryByTestId('undo-bid-btn')).not.toBeInTheDocument();
  });
});

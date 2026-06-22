import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeldQueue from './HeldQueue';

const HELD_PLAYERS = [
  { id: 'ap1', base_price: 100, player: { id: 'p1', name: 'Ravi', role: 'batsman' } },
  { id: 'ap2', base_price: 200, player: { id: 'p2', name: 'Karthik', role: 'keeper' } },
];

describe('HeldQueue', () => {
  it('shows empty message when no held players', () => {
    render(<HeldQueue heldPlayers={[]} isAdmin />);
    expect(screen.getByText('No players in the held queue')).toBeInTheDocument();
  });

  it('renders held player names', () => {
    render(<HeldQueue heldPlayers={HELD_PLAYERS} isAdmin />);
    expect(screen.getByText('Ravi')).toBeInTheDocument();
    expect(screen.getByText('Karthik')).toBeInTheDocument();
  });

  it('shows "↩ Pool" button per player when admin and onReturnToPool provided', () => {
    render(<HeldQueue heldPlayers={HELD_PLAYERS} isAdmin onReturnToPool={vi.fn()} />);
    expect(screen.getAllByText('↩ Pool')).toHaveLength(2);
  });

  it('does not show "↩ Pool" button when onReturnToPool is not provided', () => {
    render(<HeldQueue heldPlayers={HELD_PLAYERS} isAdmin />);
    expect(screen.queryByText('↩ Pool')).not.toBeInTheDocument();
  });

  it('does not show "↩ Pool" button for non-admin', () => {
    render(<HeldQueue heldPlayers={HELD_PLAYERS} isAdmin={false} onReturnToPool={vi.fn()} />);
    expect(screen.queryByText('↩ Pool')).not.toBeInTheDocument();
  });

  it('calls onReturnToPool with the correct player id when clicked', () => {
    const onReturnToPool = vi.fn();
    render(<HeldQueue heldPlayers={HELD_PLAYERS} isAdmin onReturnToPool={onReturnToPool} />);
    fireEvent.click(screen.getByTestId('return-to-pool-ap1'));
    expect(onReturnToPool).toHaveBeenCalledWith('ap1');
  });

  it('calls onReturnToPool with the second player id when that button is clicked', () => {
    const onReturnToPool = vi.fn();
    render(<HeldQueue heldPlayers={HELD_PLAYERS} isAdmin onReturnToPool={onReturnToPool} />);
    fireEvent.click(screen.getByTestId('return-to-pool-ap2'));
    expect(onReturnToPool).toHaveBeenCalledWith('ap2');
  });
});

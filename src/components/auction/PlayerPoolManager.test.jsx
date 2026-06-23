import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/playerService', () => ({
  listPlayers: vi.fn().mockResolvedValue([
    { id: 'p1', name: 'Ravi Kumar', nickname: 'RK', role: 'batsman', user_id: 'u1' },
    { id: 'p2', name: 'Senthil Nathan', nickname: '', role: 'bowler', user_id: null },
    { id: 'p3', name: 'Arun Raj', nickname: null, role: 'all-rounder', user_id: 'u2' },
  ]),
}));

vi.mock('../../services/auctionService', () => ({
  addPlayerToPool: vi.fn().mockResolvedValue({}),
  removePlayerFromPool: vi.fn().mockResolvedValue({}),
  updatePlayerBasePrice: vi.fn().mockResolvedValue({}),
}));

vi.mock('../player/PlayerAvatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

import PlayerPoolManager from './PlayerPoolManager';

const baseProps = {
  auctionId: 'a1',
  poolPlayers: [],
  captainUserIds: [],
  onPoolChange: vi.fn(),
};

describe('PlayerPoolManager', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows full name as primary text (not nickname) in available list', async () => {
    render(<PlayerPoolManager {...baseProps} />);
    // Wait for listPlayers to resolve
    await screen.findByText('Ravi Kumar');
    expect(screen.getByText('Ravi Kumar')).toBeDefined();
    // Nickname shown in small quotes
    expect(screen.getByText('"RK"')).toBeDefined();
  });

  it('shows full name without nickname element when nickname is empty', async () => {
    render(<PlayerPoolManager {...baseProps} />);
    await screen.findByText('Senthil Nathan');
    expect(screen.getByText('Senthil Nathan')).toBeDefined();
    // No nickname quotes for empty string
    const quotes = screen.queryAllByText(/^".*"$/);
    // Only RK should have quotes
    expect(quotes).toHaveLength(1);
    expect(quotes[0].textContent).toBe('"RK"');
  });

  it('shows player in pool with name primary and nickname secondary', async () => {
    const props = {
      ...baseProps,
      poolPlayers: [{ id: 'ap1', player_id: 'p1', base_price: 200, status: 'pool' }],
    };
    render(<PlayerPoolManager {...props} />);
    await screen.findByText('Ravi Kumar');
    expect(screen.getByText('Ravi Kumar')).toBeDefined();
    expect(screen.getByText('"RK"')).toBeDefined();
  });

  it('PriceCell renders without crashing when pool row is null (captain not yet in pool)', async () => {
    // Captain user u1 maps to player p1 (Ravi Kumar)
    const props = { ...baseProps, captainUserIds: ['u1'] };
    // Should not throw even though captainPoolRow is null
    expect(() => render(<PlayerPoolManager {...props} />)).not.toThrow();
    await screen.findByText('Ravi Kumar');
    // Default price shown
    expect(screen.getByText('100')).toBeDefined();
  });

  it('shows captain row with name primary and crown icon', async () => {
    const props = { ...baseProps, captainUserIds: ['u1'] };
    render(<PlayerPoolManager {...props} />);
    await screen.findByText('Ravi Kumar');
    expect(screen.getByText('👑')).toBeDefined();
  });
});

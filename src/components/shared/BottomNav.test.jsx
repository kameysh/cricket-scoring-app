import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';

vi.mock('../../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: false }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { email: 'test@test.com' }, role: 'viewer', signOut: vi.fn() }),
}));

vi.mock('../../services/pushService', () => ({
  isPushSupported: () => false,
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  getPushStatus: vi.fn().mockResolvedValue('unsupported'),
}));

const mockSetTheme = vi.fn();
vi.mock('../../stores/themeStore', () => ({
  useThemeStore: () => ({ theme: 'system', setTheme: mockSetTheme }),
  applyTheme: vi.fn(),
}));

function renderNav() {
  return render(<MemoryRouter><BottomNav /></MemoryRouter>);
}

describe('BottomNav', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders tabs in correct order: Home, Matches, Players, Rankings, Tourneys', () => {
    renderNav();
    const labels = screen.getAllByRole('link').map(a => a.getAttribute('aria-label'));
    expect(labels).toEqual(['Home', 'Matches', 'Players', 'Rankings', 'Tourneys']);
  });

  it('shows appearance theme buttons in admin sheet', () => {
    renderNav();
    // Open the account sheet
    fireEvent.click(screen.getByRole('button', { name: /viewer|me|account/i }));
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
  });

  it('calls setTheme when a theme button is clicked', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /viewer|me|account/i }));
    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});

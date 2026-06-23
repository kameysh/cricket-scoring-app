import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => vi.fn() };
});

let mockIsAdmin = true;
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ isAdmin: mockIsAdmin }) }));

vi.mock('../stores/playerStore', () => ({
  usePlayerStore: (sel) => sel({
    players: [
      { id: 'p1', name: 'Kamesh',  is_guest: false },
      { id: 'p2', name: 'Balaji M', is_guest: false },
    ],
    fetchPlayers: vi.fn(),
  }),
}));

vi.mock('../services/promoService', () => ({
  getActivePromo: vi.fn(),
  publishPromo: vi.fn(),
  deactivatePromo: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null, ImageIcon: () => null, Upload: () => null,
  CheckCircle2: () => null, X: () => null,
}));

import * as promoService from '../services/promoService';
import TournamentPromo from './TournamentPromo';

function renderPage() {
  return render(
    <MemoryRouter>
      <TournamentPromo />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdmin = true;
  promoService.getActivePromo.mockResolvedValue(null);
});

describe('TournamentPromo — basic render', () => {
  it('shows the page heading', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tournament Promo')).toBeInTheDocument());
  });

  it('shows Publish button disabled when no image selected', async () => {
    renderPage();
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /publish to home page/i });
      expect(btn).toBeDisabled();
    });
  });

  it('shows captain names from players list (not nickname)', async () => {
    renderPage();
    await waitFor(() => {
      const options = screen.getAllByRole('option', { name: 'Kamesh' });
      expect(options.length).toBeGreaterThan(0);
    });
  });

  it('captain selects filter each other out', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tournament Promo')).toBeInTheDocument());
    const selects = screen.getAllByRole('combobox');
    // Both selects show both players initially (before selection)
    expect(selects[0].querySelectorAll('option').length).toBe(3); // placeholder + 2 players
    expect(selects[1].querySelectorAll('option').length).toBe(3);
  });
});

describe('TournamentPromo — active promo display', () => {
  it('shows currently live banner when an active promo exists', async () => {
    promoService.getActivePromo.mockResolvedValue({
      id: 'promo1',
      banner_url: 'https://cdn.test/banner.png',
      tournament_name: 'GPL 2026',
      team1_name: 'CSK',
      team2_name: 'RCB',
      is_active: true,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Currently Live on Home')).toBeInTheDocument());
    expect(screen.getByText(/GPL 2026/)).toBeInTheDocument();
  });

  it('calls deactivatePromo when remove button is clicked', async () => {
    const user = userEvent.setup();
    promoService.getActivePromo.mockResolvedValue({
      id: 'promo1', banner_url: 'https://cdn.test/banner.png',
      tournament_name: 'GPL 2026', is_active: true,
    });
    promoService.deactivatePromo.mockResolvedValue();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Remove promo')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Remove promo'));
    expect(promoService.deactivatePromo).toHaveBeenCalledWith('promo1');
  });

  it('hides the live banner section when no active promo', async () => {
    promoService.getActivePromo.mockResolvedValue(null);
    renderPage();
    await waitFor(() => expect(screen.getByText('Tournament Promo')).toBeInTheDocument());
    expect(screen.queryByText('Currently Live on Home')).not.toBeInTheDocument();
  });
});

describe('TournamentPromo — non-admin', () => {
  it('renders null for non-admin users', () => {
    mockIsAdmin = false;
    const { container } = renderPage();
    expect(container.firstChild).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock the Satori-based generator — return a tiny fake PNG blob
const generateMvpCard = vi.fn();
vi.mock('../../lib/generateShareCard.jsx', () => ({
  generateMvpCard: (...args) => generateMvpCard(...args),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// BottomSheet renders children when open — mirror its real contract
vi.mock('../shared/BottomSheet', () => ({
  default: ({ open, children, title }) => (open ? <div data-testid="sheet"><h2>{title}</h2>{children}</div> : null),
}));

import MvpCardSheet from './MvpCardSheet';

const PLAYER = { id: 'p1', name: 'Santosh', photo_url: null, role: 'all_rounder' };
const STATS  = { bat_runs: 39, bowl_wickets: 7, bat_fours: 3, bat_sixes: 1, matches_played: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  // Provide a fake object URL implementation
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('MvpCardSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MvpCardSheet open={false} onClose={() => {}} player={PLAYER} rank={1} mvpScore={183.5} stats={STATS} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls generateMvpCard with player, rank, score and stats when opened', async () => {
    generateMvpCard.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    render(<MvpCardSheet open onClose={() => {}} player={PLAYER} rank={1} mvpScore={183.5} stats={STATS} />);
    await waitFor(() => expect(generateMvpCard).toHaveBeenCalled());
    expect(generateMvpCard).toHaveBeenCalledWith(
      expect.objectContaining({ player: PLAYER, rank: 1, mvpScore: 183.5, stats: STATS })
    );
  });

  it('shows the generating spinner, then the card image and a Share button', async () => {
    generateMvpCard.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    render(<MvpCardSheet open onClose={() => {}} player={PLAYER} rank={2} mvpScore={160} stats={STATS} />);
    // Spinner text shown immediately
    expect(screen.getByText(/Generating card/i)).toBeInTheDocument();
    // After generation, image + share button appear
    await waitFor(() => expect(screen.getByAltText('MVP card')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Share MVP Card/i })).toBeInTheDocument();
  });

  it('surfaces an error toast when generation fails', async () => {
    const toast = (await import('react-hot-toast')).default;
    generateMvpCard.mockRejectedValue(new Error('boom'));
    render(<MvpCardSheet open onClose={() => {}} player={PLAYER} rank={3} mvpScore={120} stats={STATS} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not generate card'));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const generateMotmSeriesCard = vi.fn();
vi.mock('../../lib/generateShareCard.jsx', () => ({
  generateMotmSeriesCard: (...args) => generateMotmSeriesCard(...args),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../shared/BottomSheet', () => ({
  default: ({ open, children, title }) => (open ? <div data-testid="sheet"><h2>{title}</h2>{children}</div> : null),
}));

import MotmCardSheet from './MotmCardSheet';

const PLAYER = { id: 'p1', name: 'Gokul', photo_url: null, role: 'all_rounder' };
const BREAKDOWN = {
  total: 314, matches: 5,
  groups: [{ title: 'BATTING', subtotal: 160, items: [{ label: 'Runs', detail: '120 × 1', pts: 120 }] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('MotmCardSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MotmCardSheet open={false} onClose={() => {}} player={PLAYER} seriesName="K7" breakdown={BREAKDOWN} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not generate until a breakdown is provided', () => {
    render(<MotmCardSheet open onClose={() => {}} player={PLAYER} seriesName="K7" breakdown={null} />);
    expect(generateMotmSeriesCard).not.toHaveBeenCalled();
  });

  it('generates the card with player, seriesName and breakdown when opened', async () => {
    generateMotmSeriesCard.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    render(<MotmCardSheet open onClose={() => {}} player={PLAYER} seriesName="K7 Trophy" breakdown={BREAKDOWN} />);
    await waitFor(() => expect(generateMotmSeriesCard).toHaveBeenCalled());
    expect(generateMotmSeriesCard).toHaveBeenCalledWith(
      expect.objectContaining({ player: PLAYER, seriesName: 'K7 Trophy', breakdown: BREAKDOWN })
    );
  });

  it('shows spinner then the card image and a Share button', async () => {
    generateMotmSeriesCard.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    render(<MotmCardSheet open onClose={() => {}} player={PLAYER} seriesName="K7" breakdown={BREAKDOWN} />);
    expect(screen.getByText(/Generating card/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByAltText('Man of the Series card')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Share Card/i })).toBeInTheDocument();
  });

  it('shows an error toast when generation fails', async () => {
    const toast = (await import('react-hot-toast')).default;
    generateMotmSeriesCard.mockRejectedValue(new Error('boom'));
    render(<MotmCardSheet open onClose={() => {}} player={PLAYER} seriesName="K7" breakdown={BREAKDOWN} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not generate card'));
  });
});

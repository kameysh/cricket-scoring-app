import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const chainable = { data: [], error: null };
const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
q.select.mockReturnValue(q);
q.eq.mockReturnValue(q);
q.order.mockReturnValue(q);
q.limit.mockResolvedValue(chainable);
// make the chain thenable at every step
Object.assign(q, { then: (res) => Promise.resolve(chainable).then(res) });

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => q,
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../services/playerService', () => ({
  getAllCareerStats: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/seriesService', () => ({
  listSeries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/partnershipService', () => ({
  getTopPartnerships: vi.fn().mockResolvedValue([]),
}));

vi.mock('../components/player/PlayerAvatar', () => ({ default: () => null }));
vi.mock('../components/shared/LoadingSkeleton', () => ({ default: () => <div>Loading</div> }));
vi.mock('../components/shared/EmptyState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

import Leaderboard from './Leaderboard';

function renderLeaderboard() {
  return render(<MemoryRouter><Leaderboard /></MemoryRouter>);
}

describe('Leaderboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Batting tab by default without crashing', async () => {
    renderLeaderboard();
    expect(screen.getByText('Batting')).toBeInTheDocument();
  });

  it('switches to Partnerships tab without crashing', async () => {
    renderLeaderboard();
    fireEvent.click(screen.getByText(/Partnerships/i));
    await waitFor(() => {
      expect(screen.getByText('No partnerships yet')).toBeInTheDocument();
    });
  });

  it('switches to MVP tab without crashing', async () => {
    renderLeaderboard();
    fireEvent.click(screen.getByText(/🏆\s*MVP/));
    // No crash = passes
    expect(screen.getByText(/🏆\s*MVP/)).toBeInTheDocument();
  });
});

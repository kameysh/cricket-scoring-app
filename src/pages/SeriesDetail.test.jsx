import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeriesDetail from './SeriesDetail';

vi.mock('../services/seriesService', () => ({
  getSeries: vi.fn(),
  getSeriesTournaments: vi.fn(),
  getSeriesPlayerStats: vi.fn(),
}));

vi.mock('../components/tournament/TournamentLeaderboard', () => ({
  default: ({ batting }) => <div data-testid="leaderboard">{batting.length} players</div>,
}));

vi.mock('../components/shared/LoadingSkeleton', () => ({
  default: () => <div>Loading…</div>,
}));

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

import * as seriesService from '../services/seriesService';

function renderDetail(id = 's1') {
  return render(
    <MemoryRouter initialEntries={[`/series/${id}`]}>
      <Routes>
        <Route path="/series/:id" element={<SeriesDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SeriesDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows series name', async () => {
    seriesService.getSeries.mockResolvedValue({ id: 's1', name: 'K7 Trophy' });
    seriesService.getSeriesTournaments.mockResolvedValue([]);
    seriesService.getSeriesPlayerStats.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => expect(screen.getByText('K7 Trophy')).toBeInTheDocument());
  });

  it('shows season list', async () => {
    seriesService.getSeries.mockResolvedValue({ id: 's1', name: 'K7 Trophy' });
    seriesService.getSeriesTournaments.mockResolvedValue([
      { id: 't1', name: 'K7 Trophy Season 1', status: 'completed', start_date: '2025-01-01' },
      { id: 't2', name: 'K7 Trophy Season 2', status: 'ongoing', start_date: '2026-01-01' },
    ]);
    seriesService.getSeriesPlayerStats.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => expect(screen.getByText('K7 Trophy Season 1')).toBeInTheDocument());
    expect(screen.getByText('K7 Trophy Season 2')).toBeInTheDocument();
    expect(screen.getByText('2 seasons')).toBeInTheDocument();
  });

  it('shows empty stats message when no data', async () => {
    seriesService.getSeries.mockResolvedValue({ id: 's1', name: 'K7 Trophy' });
    seriesService.getSeriesTournaments.mockResolvedValue([]);
    seriesService.getSeriesPlayerStats.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => expect(screen.getByText(/No stats yet/i)).toBeInTheDocument());
  });

  it('passes aggregated stats to TournamentLeaderboard', async () => {
    seriesService.getSeries.mockResolvedValue({ id: 's1', name: 'K7 Trophy' });
    seriesService.getSeriesTournaments.mockResolvedValue([]);
    seriesService.getSeriesPlayerStats.mockResolvedValue([
      { player_id: 'p1', bat_runs: 200 },
      { player_id: 'p2', bat_runs: 150 },
    ]);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('leaderboard')).toBeInTheDocument());
    expect(screen.getByText('2 players')).toBeInTheDocument();
  });

  it('shows not-found message when series missing', async () => {
    seriesService.getSeries.mockResolvedValue(null);
    seriesService.getSeriesTournaments.mockResolvedValue([]);
    seriesService.getSeriesPlayerStats.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => expect(screen.getByText(/Series not found/i)).toBeInTheDocument());
  });
});

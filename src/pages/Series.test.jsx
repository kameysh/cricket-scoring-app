import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Series from './Series';

vi.mock('../services/seriesService', () => ({
  listSeries: vi.fn(),
  addSeries: vi.fn(),
  deleteSeries: vi.fn(),
}));

vi.mock('../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: true }),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import * as seriesService from '../services/seriesService';

function renderSeries() {
  return render(<MemoryRouter><Series /></MemoryRouter>);
}

describe('Series page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no series exist', async () => {
    seriesService.listSeries.mockResolvedValue([]);
    renderSeries();
    await waitFor(() => expect(screen.getByText(/No series yet/i)).toBeInTheDocument());
  });

  it('renders series cards', async () => {
    seriesService.listSeries.mockResolvedValue([
      { id: 's1', name: 'K7 Trophy' },
      { id: 's2', name: 'City League' },
    ]);
    renderSeries();
    await waitFor(() => expect(screen.getByText('K7 Trophy')).toBeInTheDocument());
    expect(screen.getByText('City League')).toBeInTheDocument();
  });

  it('shows add form when New button clicked', async () => {
    seriesService.listSeries.mockResolvedValue([]);
    renderSeries();
    await waitFor(() => screen.getByRole('button', { name: /New/i }));
    fireEvent.click(screen.getByRole('button', { name: /New/i }));
    expect(screen.getByPlaceholderText(/K7 Trophy/i)).toBeInTheDocument();
  });

  it('creates a series on form submit', async () => {
    seriesService.listSeries.mockResolvedValue([]);
    seriesService.addSeries.mockResolvedValue({ id: 's3', name: 'Test Cup' });
    renderSeries();
    await waitFor(() => screen.getByRole('button', { name: /New/i }));
    fireEvent.click(screen.getByRole('button', { name: /New/i }));
    fireEvent.change(screen.getByPlaceholderText(/K7 Trophy/i), { target: { value: 'Test Cup' } });
    fireEvent.click(screen.getByText(/Create Series/i));
    await waitFor(() => expect(seriesService.addSeries).toHaveBeenCalledWith('Test Cup'));
  });

  it('prompts to delete a series', async () => {
    seriesService.listSeries.mockResolvedValue([{ id: 's1', name: 'K7 Trophy' }]);
    renderSeries();
    await waitFor(() => screen.getByText('K7 Trophy'));
    fireEvent.click(screen.getByLabelText(/Delete K7 Trophy/i));
    expect(screen.getByText(/Delete series/i)).toBeInTheDocument();
  });
});

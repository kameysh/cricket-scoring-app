import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BallLog from './BallLog';

// PlayerLink just renders a span with the name in tests
vi.mock('../player/PlayerLink', () => ({
  default: ({ name }) => <span>{name || 'Unknown'}</span>,
}));

function delivery(overrides) {
  return {
    id: Math.random().toString(),
    over_number: 0,
    ball_number: 1,
    batsman_id: 'b1',
    bowler_id: 'bw1',
    runs_off_bat: 0,
    extra_type: 'none',
    extra_runs: 0,
    total_runs_on_delivery: 0,
    is_wicket: false,
    batsman: { name: 'Batsman One' },
    bowler: { name: 'Bowler One' },
    ...overrides,
  };
}

describe('BallLog chip labels', () => {
  it('dot ball shows "•"', () => {
    render(<BallLog deliveries={[delivery({ runs_off_bat: 0 })]} />);
    expect(screen.getByRole('button', { name: '•' })).toBeInTheDocument();
  });

  it('4 runs shows "4"', () => {
    render(<BallLog deliveries={[delivery({ runs_off_bat: 4, total_runs_on_delivery: 4 })]} />);
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
  });

  it('wicket shows "W"', () => {
    render(<BallLog deliveries={[delivery({ is_wicket: true })]} />);
    expect(screen.getByRole('button', { name: 'W' })).toBeInTheDocument();
  });

  it('wide with 2 extras shows "wd+2" (total=3, wd base=1)', () => {
    render(<BallLog deliveries={[delivery({ extra_type: 'wide', extra_runs: 2, total_runs_on_delivery: 3 })]} />);
    expect(screen.getByRole('button', { name: 'wd+2' })).toBeInTheDocument();
  });

  it('no ball with 3 runs off bat shows "nb+3"', () => {
    render(<BallLog deliveries={[delivery({ extra_type: 'no_ball', runs_off_bat: 3, total_runs_on_delivery: 4 })]} />);
    expect(screen.getByRole('button', { name: 'nb+3' })).toBeInTheDocument();
  });

  it('bye with 2 extra_runs shows "2b"', () => {
    render(<BallLog deliveries={[delivery({ extra_type: 'bye', extra_runs: 2, total_runs_on_delivery: 2 })]} />);
    expect(screen.getByRole('button', { name: '2b' })).toBeInTheDocument();
  });

  it('leg bye with 1 extra_run shows "1lb"', () => {
    render(<BallLog deliveries={[delivery({ extra_type: 'leg_bye', extra_runs: 1, total_runs_on_delivery: 1 })]} />);
    expect(screen.getByRole('button', { name: '1lb' })).toBeInTheDocument();
  });
});

describe('BallLog display limit', () => {
  it('renders at most 24 chips even with 30 deliveries', () => {
    const deliveries = Array.from({ length: 30 }, (_, i) =>
      delivery({ id: `d${i}`, ball_number: i + 1 })
    );
    render(<BallLog deliveries={deliveries} />);
    const chips = screen.getAllByRole('button');
    expect(chips.length).toBe(24);
  });
});

describe('BallLog popover', () => {
  it('clicking chip opens popover with batsman and bowler names', () => {
    render(
      <BallLog deliveries={[delivery({ batsman: { name: 'Ali' }, bowler: { name: 'Ravi' } })]} />
    );
    fireEvent.click(screen.getByRole('button', { name: '•' }));
    expect(screen.getByText('Ali')).toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
  });

  it('resolveName fallback: uses matchPlayers when delivery has no joined name', () => {
    const matchPlayers = [
      { players: { id: 'b1', name: 'Fallback Batter' } },
      { players: { id: 'bw1', name: 'Fallback Bowler' } },
    ];
    // No batsman/bowler joined objects
    const d = delivery({ batsman: null, bowler: null });
    render(<BallLog deliveries={[d]} matchPlayers={matchPlayers} />);
    fireEvent.click(screen.getByRole('button', { name: '•' }));
    expect(screen.getByText(/Fallback Batter/)).toBeInTheDocument();
    expect(screen.getByText(/Fallback Bowler/)).toBeInTheDocument();
  });

  it('clicking overlay backdrop closes popover', () => {
    render(<BallLog deliveries={[delivery()]} />);
    fireEvent.click(screen.getByRole('button', { name: '•' }));
    // Backdrop is the fixed inset-0 overlay
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    fireEvent.click(overlay);
    expect(document.querySelector('.fixed.inset-0.z-50')).toBeNull();
  });
});

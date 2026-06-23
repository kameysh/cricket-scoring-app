import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PlayerDrawAnimation from './PlayerDrawAnimation';

const POOL = [
  { id: 'ap1', player_id: 'p1', base_price: 100, player: { id: 'p1', name: 'Ravi', role: 'batsman' } },
  { id: 'ap2', player_id: 'p2', base_price: 200, player: { id: 'p2', name: 'Karthik', role: 'keeper' } },
  { id: 'ap3', player_id: 'p3', base_price: 150, player: { id: 'p3', name: 'Suresh', role: 'bowler' } },
];

const WINNER = POOL[0];

beforeEach(() => {
  vi.useFakeTimers();
  navigator.vibrate = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  delete navigator.vibrate;
});

describe('PlayerDrawAnimation', () => {
  it('shows "Drawing..." immediately on render', () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={null} onComplete={vi.fn()} />);
    expect(screen.getByText('🎲 Drawing…')).toBeInTheDocument();
  });

  it('shows pool count during spin', () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={null} onComplete={vi.fn()} />);
    expect(screen.getByText('3 players in pool')).toBeInTheDocument();
  });

  async function runFullAnimation() {
    // Step through each phase so React can register new timers between advances:
    // 1. Pass MIN_SPIN_MS so winner-detection fires → setPhase('slowing')
    await act(async () => { vi.advanceTimersByTime(1700); });
    // 2. Run all SLOW_STEPS ticks (total ~2000ms)
    await act(async () => { vi.advanceTimersByTime(2100); });
    // 3. Run reveal delay (80ms) so setRevealed(true) fires
    await act(async () => { vi.advanceTimersByTime(200); });
  }

  it('transitions header to "Player Selected!" after full animation', async () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={WINNER} onComplete={vi.fn()} />);
    await runFullAnimation();
    expect(screen.getByText('🎉 Player Selected!')).toBeInTheDocument();
  });

  it('shows "Opening bidding…" after reveal', async () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={WINNER} onComplete={vi.fn()} />);
    await runFullAnimation();
    expect(screen.getByText('Opening bidding…')).toBeInTheDocument();
  });

  it('shows winner base price after reveal', async () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={WINNER} onComplete={vi.fn()} />);
    await runFullAnimation();
    expect(screen.getByText(/Base ₹/)).toBeInTheDocument();
  });

  it('calls onComplete after full animation', async () => {
    const onComplete = vi.fn();
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={WINNER} onComplete={onComplete} />);
    await runFullAnimation();
    // onComplete is scheduled 1000ms after reveal
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(onComplete).toHaveBeenCalled();
  });

  it('handles single-player pool without crashing', () => {
    render(<PlayerDrawAnimation poolPlayers={[POOL[0]]} winner={null} onComplete={vi.fn()} />);
    expect(screen.getByText('🎲 Drawing…')).toBeInTheDocument();
    expect(screen.getByText('1 player in pool')).toBeInTheDocument();
  });

  it('does not call onComplete prematurely when winner is null', async () => {
    const onComplete = vi.fn();
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={null} onComplete={onComplete} />);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('vibrates during fast spin phase', async () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={null} onComplete={vi.fn()} />);
    await act(async () => { vi.advanceTimersByTime(200); });
    // 2 spin ticks at 80ms each → vibrate called at least twice with short pulse
    expect(navigator.vibrate).toHaveBeenCalledWith(18);
    expect(navigator.vibrate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('vibrates with escalating pulses during slowdown', async () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={WINNER} onComplete={vi.fn()} />);
    // Get past spin into slowing phase
    await act(async () => { vi.advanceTimersByTime(1700); });
    const callsBefore = navigator.vibrate.mock.calls.length;
    // Run slow steps
    await act(async () => { vi.advanceTimersByTime(2100); });
    const slowCalls = navigator.vibrate.mock.calls.slice(callsBefore);
    // 5 slow-step pulses, each heavier than 18ms
    expect(slowCalls.length).toBeGreaterThanOrEqual(5);
    expect(slowCalls.some(([v]) => v > 18)).toBe(true);
  });

  it('fires double-buzz pattern on reveal', async () => {
    render(<PlayerDrawAnimation poolPlayers={POOL} winner={WINNER} onComplete={vi.fn()} />);
    await runFullAnimation();
    // Reveal vibration is an array pattern [100, 60, 180]
    expect(navigator.vibrate).toHaveBeenCalledWith([100, 60, 180]);
  });

  it('does not throw when navigator.vibrate is absent', async () => {
    delete navigator.vibrate;
    expect(() =>
      render(<PlayerDrawAnimation poolPlayers={POOL} winner={null} onComplete={vi.fn()} />)
    ).not.toThrow();
  });
});

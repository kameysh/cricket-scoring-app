import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BallInputPanel from './BallInputPanel';

// Mock UndoButton so we don't need its full implementation
vi.mock('./UndoButton', () => ({
  default: ({ disabled, onClick }) => (
    <button disabled={disabled} onClick={onClick} data-testid="undo-btn">Undo</button>
  ),
}));

const defaults = {
  onRuns: vi.fn(),
  onExtra: vi.fn(),
  onWicket: vi.fn(),
  onUndo: vi.fn(),
  undoDisabled: false,
};

describe('BallInputPanel', () => {
  it('renders 6 run buttons: 0, 1, 2, 3, 4, 6', () => {
    render(<BallInputPanel {...defaults} />);
    for (const r of [0, 1, 2, 3, 4, 6]) {
      expect(screen.getByRole('button', { name: String(r) })).toBeInTheDocument();
    }
  });

  it('renders 5 extra type buttons', () => {
    render(<BallInputPanel {...defaults} />);
    expect(screen.getByRole('button', { name: 'Wide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Ball' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bye' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leg Bye' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Penalty' })).toBeInTheDocument();
  });

  it('clicking run button calls onRuns with correct value', () => {
    const onRuns = vi.fn();
    render(<BallInputPanel {...defaults} onRuns={onRuns} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onRuns).toHaveBeenCalledWith(4);
  });

  it('clicking WICKET calls onWicket', () => {
    const onWicket = vi.fn();
    render(<BallInputPanel {...defaults} onWicket={onWicket} />);
    fireEvent.click(screen.getByRole('button', { name: 'WICKET' }));
    expect(onWicket).toHaveBeenCalledOnce();
  });

  it('undoDisabled=true → undo button is disabled', () => {
    render(<BallInputPanel {...defaults} undoDisabled />);
    expect(screen.getByTestId('undo-btn')).toBeDisabled();
  });

  it('Penalty calls onExtra("penalty_batting", 5) immediately without opening sheet', () => {
    const onExtra = vi.fn();
    render(<BallInputPanel {...defaults} onExtra={onExtra} />);
    fireEvent.click(screen.getByRole('button', { name: 'Penalty' }));
    expect(onExtra).toHaveBeenCalledWith('penalty_batting', 5);
    // Sheet should NOT be open — no "select runs" heading
    expect(screen.queryByText(/select runs/i)).toBeNull();
  });

  it('clicking "No Ball" opens sheet with options including 6', () => {
    render(<BallInputPanel {...defaults} />);
    fireEvent.click(screen.getByRole('button', { name: 'No Ball' }));
    // Sheet heading should appear
    expect(screen.getByText(/no ball.*select runs/i)).toBeInTheDocument();
    // 6 should be in the sheet options
    const allSixes = screen.getAllByRole('button', { name: '6' });
    expect(allSixes.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "Wide" opens sheet WITHOUT option 6', () => {
    render(<BallInputPanel {...defaults} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wide' }));
    expect(screen.getByText(/wide.*select runs/i)).toBeInTheDocument();
    // The sheet buttons are 0,1,2,3,4,5 — button "6" should NOT appear in sheet
    // (Original run button "6" still in the panel — check there's no second "6")
    const all6buttons = screen.queryAllByRole('button', { name: '6' });
    // Only 1 "6" (the run button in the main panel, not in the sheet)
    expect(all6buttons.length).toBe(1);
  });

  it('selecting a run from No Ball sheet calls onExtra("no_ball", n)', () => {
    const onExtra = vi.fn();
    render(<BallInputPanel {...defaults} onExtra={onExtra} />);
    fireEvent.click(screen.getByRole('button', { name: 'No Ball' }));
    // Click 6 in the sheet (there's now 2 "6" buttons: original + sheet)
    const all6 = screen.getAllByRole('button', { name: '6' });
    fireEvent.click(all6[all6.length - 1]); // click the sheet's 6
    expect(onExtra).toHaveBeenCalledWith('no_ball', 6);
  });

  it('disabled=true → panel has opacity-50 class and opening extra does nothing', () => {
    const onExtra = vi.fn();
    const { container } = render(<BallInputPanel {...defaults} onExtra={onExtra} disabled />);
    // Root div should have opacity-50
    expect(container.firstChild.className).toContain('opacity-50');
    fireEvent.click(screen.getByRole('button', { name: 'No Ball' }));
    // Sheet should NOT open (openExtra returns early when disabled)
    expect(screen.queryByText(/select runs/i)).toBeNull();
    expect(onExtra).not.toHaveBeenCalled();
  });
});

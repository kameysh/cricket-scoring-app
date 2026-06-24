import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StrikerIndicator from './StrikerIndicator';

vi.mock('../player/PlayerLink', () => ({
  default: ({ name }) => <span>{name || 'Unknown'}</span>,
}));

const striker = { id: 's1', name: 'Ali Khan' };
const nonStriker = { id: 'ns1', name: 'Ravi Sharma' };
const strikerCard = { runs: 45, balls_faced: 30, ones: 5, twos: 3, threes: 0, fours: 4, sixes: 2 };

describe('StrikerIndicator', () => {
  it('renders striker name with gold ● indicator', () => {
    const { container } = render(
      <StrikerIndicator striker={striker} nonStriker={nonStriker} strikerCard={strikerCard} nonStrikerCard={null} onSwap={vi.fn()} onRetire={vi.fn()} />
    );
    expect(screen.getByText('Ali Khan')).toBeInTheDocument();
    // The gold indicator ● should be present
    expect(container.innerHTML).toContain('●');
  });

  it('renders non-striker name', () => {
    render(
      <StrikerIndicator striker={striker} nonStriker={nonStriker} strikerCard={null} nonStrikerCard={null} onSwap={vi.fn()} onRetire={vi.fn()} />
    );
    expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
  });

  it('"Swap ends" button is visible when nonStriker is provided', () => {
    render(
      <StrikerIndicator striker={striker} nonStriker={nonStriker} strikerCard={null} nonStrikerCard={null} onSwap={vi.fn()} onRetire={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /swap ends/i })).toBeInTheDocument();
  });

  it('"Swap ends" button is NOT visible when nonStriker is absent', () => {
    render(
      <StrikerIndicator striker={striker} nonStriker={null} strikerCard={null} nonStrikerCard={null} onSwap={vi.fn()} onRetire={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: /swap ends/i })).toBeNull();
  });

  it('"Swap ends" click calls onSwap', () => {
    const onSwap = vi.fn();
    render(
      <StrikerIndicator striker={striker} nonStriker={nonStriker} strikerCard={null} nonStrikerCard={null} onSwap={onSwap} onRetire={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /swap ends/i }));
    expect(onSwap).toHaveBeenCalledOnce();
  });

  it('retire button on striker row calls onRetire with striker id', () => {
    const onRetire = vi.fn();
    render(
      <StrikerIndicator striker={striker} nonStriker={nonStriker} strikerCard={strikerCard} nonStrikerCard={null} onSwap={vi.fn()} onRetire={onRetire} />
    );
    const retireBtns = screen.getAllByTitle('Retire batsman');
    fireEvent.click(retireBtns[0]); // first one = striker
    expect(onRetire).toHaveBeenCalledWith('s1');
  });

  it('expanding a row shows 1s/2s/3s/4s/6s breakdown', () => {
    render(
      <StrikerIndicator striker={striker} nonStriker={null} strikerCard={strikerCard} nonStrikerCard={null} onSwap={vi.fn()} onRetire={vi.fn()} />
    );
    // Click the row to expand (the div containing name and ● indicator)
    fireEvent.click(screen.getByText('Ali Khan').closest('div'));
    // The grid div renders "1s\n5" in same element — use innerHTML check
    const grid = document.querySelector('.grid-cols-5');
    expect(grid).not.toBeNull();
    expect(grid.textContent).toContain('1s');
    expect(grid.textContent).toContain('4s');
    expect(grid.textContent).toContain('6s');
  });
});

describe('StrikerIndicator — primary name, not nickname', () => {
  it('shows player.name even when nickname is set on striker', () => {
    const s = { id: 's1', name: 'Yuvaraj Singh', nickname: 'Yuvi' };
    const ns = { id: 'ns1', name: 'Ravi Kumar', nickname: 'Ravi K' };
    render(<StrikerIndicator striker={s} nonStriker={ns} strikerCard={null} nonStrikerCard={null} onSwap={vi.fn()} onRetire={vi.fn()} />);
    expect(screen.getByText('Yuvaraj Singh')).toBeInTheDocument();
    expect(screen.queryByText('Yuvi')).not.toBeInTheDocument();
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    expect(screen.queryByText('Ravi K')).not.toBeInTheDocument();
  });
});

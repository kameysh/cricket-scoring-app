import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MotmFormulaSheet from './MotmFormulaSheet';

describe('MotmFormulaSheet', () => {
  it('renders the default Man of the Series heading and key formula rows', () => {
    render(<MotmFormulaSheet onClose={() => {}} />);
    expect(screen.getByText('Man of the Series Formula')).toBeInTheDocument();
    // Section headers
    expect(screen.getByText('Batting')).toBeInTheDocument();
    expect(screen.getByText('Bowling')).toBeInTheDocument();
    expect(screen.getByText('Fielding')).toBeInTheDocument();
    // A few representative point rules matching calcMotmScore
    expect(screen.getByText('Wicket taken')).toBeInTheDocument();
    expect(screen.getByText('+25 pts each')).toBeInTheDocument();
    expect(screen.getByText('Run scored')).toBeInTheDocument();
    expect(screen.getByText('Century')).toBeInTheDocument();
    expect(screen.getByText('+30 pts')).toBeInTheDocument();
  });

  it('supports a custom title and footer (e.g. for Man of the Match)', () => {
    render(<MotmFormulaSheet title="Man of the Match Formula" footer="Scored for this match only." onClose={() => {}} />);
    expect(screen.getByText('Man of the Match Formula')).toBeInTheDocument();
    expect(screen.getByText('Scored for this match only.')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<MotmFormulaSheet onClose={onClose} />);
    // The X button is the first button in the header
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

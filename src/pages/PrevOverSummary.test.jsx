import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PrevOverSummary } from './LiveScoring';

const makeDel = (overrides = {}) => ({
  over_number: 0,
  runs_off_bat: 1,
  extra_type: 'none',
  extra_runs: 0,
  total_runs_on_delivery: 1,
  is_wicket: false,
  ...overrides,
});

describe('PrevOverSummary', () => {
  // overNumber is 0-based (Math.floor(legalBalls / 6)) — same as matchStore currentOverNumber

  it('renders nothing when still in over 0 (first over in progress)', () => {
    // 3 balls into first over → overNumber = 0
    const { container } = render(<PrevOverSummary overNumber={0} deliveries={[makeDel()]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when overNumber > 0 but no deliveries for previous over', () => {
    // overNumber=1 but no balls with over_number=0
    const { container } = render(
      <PrevOverSummary overNumber={1} deliveries={[makeDel({ over_number: 1 })]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows previous over label once over 0 is complete and over 1 is in progress', () => {
    // 6 balls in over 0 done, 1 ball into over 1 → overNumber = 1
    const deliveries = [
      ...Array.from({ length: 6 }, () => makeDel({ over_number: 0 })),
      makeDel({ over_number: 1 }),
    ];
    render(<PrevOverSummary overNumber={1} deliveries={deliveries} />);
    expect(screen.getByTestId('prev-over-summary')).toBeInTheDocument();
    expect(screen.getByText('Over 1')).toBeInTheDocument();
  });

  it('shows runs and score snapshot for the previous over', () => {
    // 4+6+1+1+1+1 = 14 runs in over 0; overNumber=1
    const deliveries = [
      makeDel({ over_number: 0, total_runs_on_delivery: 4, runs_off_bat: 4 }),
      makeDel({ over_number: 0, total_runs_on_delivery: 6, runs_off_bat: 6 }),
      ...Array.from({ length: 4 }, () => makeDel({ over_number: 0, total_runs_on_delivery: 1 })),
      makeDel({ over_number: 1, total_runs_on_delivery: 1 }),
    ];
    render(<PrevOverSummary overNumber={1} deliveries={deliveries} />);
    const summary = screen.getByTestId('prev-over-summary');
    expect(summary.textContent).toContain('14 runs');
    expect(summary.textContent).toContain('14/0');
  });

  it('shows wicket count in over summary', () => {
    const deliveries = [
      ...Array.from({ length: 5 }, () => makeDel({ over_number: 0 })),
      makeDel({ over_number: 0, is_wicket: true, total_runs_on_delivery: 0, runs_off_bat: 0 }),
      makeDel({ over_number: 1 }),
    ];
    render(<PrevOverSummary overNumber={1} deliveries={deliveries} />);
    const summary = screen.getByTestId('prev-over-summary');
    expect(summary.textContent).toContain('1 wkt');
  });

  it('shows correct 1-based label for over 2 completed (overNumber=2)', () => {
    const deliveries = [
      ...Array.from({ length: 6 }, () => makeDel({ over_number: 0 })),
      ...Array.from({ length: 6 }, () => makeDel({ over_number: 1 })),
      makeDel({ over_number: 2 }),
    ];
    render(<PrevOverSummary overNumber={2} deliveries={deliveries} />);
    expect(screen.getByText('Over 2')).toBeInTheDocument();
  });
});

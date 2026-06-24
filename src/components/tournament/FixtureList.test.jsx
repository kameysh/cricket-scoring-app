import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FixtureList from './FixtureList';

vi.mock('../match/MatchCard', () => ({
  default: ({ match }) => <div data-testid="match-card">{match.id}</div>,
}));

vi.mock('../../hooks/useRole', () => ({
  useRole: () => ({ canScore: true }),
}));

function render_(props) {
  return render(
    <MemoryRouter>
      <FixtureList {...props} />
    </MemoryRouter>
  );
}

const MATCH = { id: 'm1', status: 'completed', team1_name: 'A', team2_name: 'B' };
const UPCOMING = { id: 'm1', status: 'upcoming', team1_name: 'Lion Kings', team2_name: 'Apex Avengers' };

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);   // 1 hour from now
const PAST   = new Date(Date.now() - 60 * 60 * 1000);   // 1 hour ago

describe('FixtureList', () => {
  it('shows empty state when no matches and no seriesTotal', () => {
    render_({ matches: [] });
    expect(screen.getByText(/No matches scheduled/i)).toBeInTheDocument();
  });

  it('shows empty state when all matches deleted (matches=[], seriesTotal=5)', () => {
    render_({ matches: [], seriesTotal: 5 });
    // Should NOT show "DELETED" tombstones — clean slate
    expect(screen.getByText(/No matches scheduled/i)).toBeInTheDocument();
    expect(screen.queryByText(/deleted/i)).not.toBeInTheDocument();
  });

  it('shows tombstone cards for deleted matches when some real matches exist', () => {
    render_({ matches: [MATCH], seriesTotal: 3 });
    // 1 real match + 2 tombstones
    expect(screen.getByTestId('match-card')).toBeInTheDocument();
    expect(screen.getAllByText(/deleted/i)).toHaveLength(2);
  });

  it('shows no tombstones when all slots are filled', () => {
    const matches = [MATCH, { ...MATCH, id: 'm2' }, { ...MATCH, id: 'm3' }];
    render_({ matches, seriesTotal: 3 });
    expect(screen.getAllByTestId('match-card')).toHaveLength(3);
    expect(screen.queryByText(/deleted/i)).not.toBeInTheDocument();
  });

  it('shows all matches with no tombstones when seriesTotal not provided', () => {
    render_({ matches: [MATCH] });
    expect(screen.getByTestId('match-card')).toBeInTheDocument();
    expect(screen.queryByText(/deleted/i)).not.toBeInTheDocument();
  });
});

describe('FixtureList — match 1 time lock', () => {
  it('shows lock + unlock time on match 1 when match1UnlockAt is in the future', () => {
    render_({ matches: [UPCOMING], onStart: vi.fn(), match1UnlockAt: FUTURE });
    expect(screen.getByText(/Unlocks/i)).toBeInTheDocument();
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
  });

  it('shows Start button on match 1 when match1UnlockAt is in the past', () => {
    render_({ matches: [UPCOMING], onStart: vi.fn(), match1UnlockAt: PAST });
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.queryByText(/Unlocks/i)).not.toBeInTheDocument();
  });

  it('shows Start button on match 1 when match1UnlockAt is null (super admin bypass)', () => {
    render_({ matches: [UPCOMING], onStart: vi.fn(), match1UnlockAt: null });
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.queryByText(/Unlocks/i)).not.toBeInTheDocument();
  });

  it('does not apply time lock to match 2+', () => {
    const m2 = { id: 'm2', status: 'upcoming', team1_name: 'A', team2_name: 'B' };
    render_({ matches: [{ ...UPCOMING, status: 'completed' }, m2], onStart: vi.fn(), match1UnlockAt: FUTURE, seriesTotal: 2 });
    // match 2 is locked by prev-match logic (match 1 not done in seriesTotal mode),
    // but the "Unlocks" label only appears for match 1
    const lockLabels = screen.queryAllByText(/Unlocks/i);
    expect(lockLabels).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchHistoryTable from './MatchHistoryTable';

function renderTable(history) {
  return render(<MemoryRouter><MatchHistoryTable history={history} /></MemoryRouter>);
}

const baseMatch = {
  id: 'm1', status: 'completed', team1_name: 'Lion Kings', team2_name: 'Apex Avengers',
  winning_team_name: 'Apex Avengers', result_type: 'runs', created_at: '2026-06-27',
};

describe('MatchHistoryTable — result badge', () => {
  it('shows "Won" from playerTeam even when scorecard team is null (the bug fix)', () => {
    renderTable([{ match: baseMatch, batting: { runs: 13, balls_faced: 7, fours: 0, sixes: 2, team: null }, bowling: null, fielding: null, playerTeam: 2 }]);
    expect(screen.getByText('Won')).toBeTruthy();
  });

  it('shows "Lost" when the player is on the losing team (scorecard team null)', () => {
    renderTable([{ match: baseMatch, batting: { runs: 1, balls_faced: 2, fours: 0, sixes: 0, team: null }, bowling: null, fielding: null, playerTeam: 1 }]);
    expect(screen.getByText('Lost')).toBeTruthy();
  });

  it('falls back to the scorecard team when playerTeam is absent', () => {
    renderTable([{ match: baseMatch, batting: { runs: 5, balls_faced: 4, fours: 1, sixes: 0, team: 2 }, bowling: null, fielding: null, playerTeam: null }]);
    expect(screen.getByText('Won')).toBeTruthy();
  });

  it('renders no badge when neither playerTeam nor scorecard team is known', () => {
    renderTable([{ match: baseMatch, batting: { runs: 5, balls_faced: 4, fours: 1, sixes: 0, team: null }, bowling: null, fielding: null, playerTeam: null }]);
    expect(screen.queryByText('Won')).toBeNull();
    expect(screen.queryByText('Lost')).toBeNull();
  });

  it('shows "Tied" for a tie regardless of team', () => {
    renderTable([{ match: { ...baseMatch, result_type: 'tie', winning_team_name: null }, batting: null, bowling: null, fielding: null, playerTeam: null }]);
    expect(screen.getByText('Tied')).toBeTruthy();
  });

  it('shows no badge for a non-completed match', () => {
    renderTable([{ match: { ...baseMatch, status: 'live' }, batting: null, bowling: null, fielding: null, playerTeam: 2 }]);
    expect(screen.queryByText('Won')).toBeNull();
    expect(screen.queryByText('Lost')).toBeNull();
  });

  it('shows empty state when history is empty', () => {
    renderTable([]);
    expect(screen.getByText(/No matches played yet/)).toBeTruthy();
  });
});

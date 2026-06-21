import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchScoreCard } from './Home';

// ── dependency mocks ─────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

let mockCanScore = false;
vi.mock('../hooks/useRole', () => ({
  useRole: () => ({ canScore: mockCanScore }),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => null,
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const MATCH = {
  id: 'm1',
  team1_name: 'Back Street Boyz',
  team2_name: 'Super Kings',
  result_summary: 'Match tied',
  created_at: '2026-06-20T10:00:00Z',
  venues: { name: 'Two In One Turf' },
};

// batting_team=1 → team1 batted, team2 bowled
const INN1 = { id: 'inn1', batting_team: 1, total_runs: 53, total_wickets: 3, total_legal_balls: 36 };
// batting_team=2 → team2 batted, team1 bowled
const INN2 = { id: 'inn2', batting_team: 2, total_runs: 53, total_wickets: 5, total_legal_balls: 36 };

const CARDS = {
  inn1: {
    batting: [
      { player_id: 'p1', runs: 21, balls: 15, players: { name: 'Yuvaraj' } },
      { player_id: 'p2', runs: 18, balls: 12, players: { name: 'Ranjith Ravi' } },
      { player_id: 'p3', runs: 8,  balls: 10, players: { name: 'Naveen' } },
    ],
    bowling: [
      { player_id: 'p7', wickets: 1, runs_conceded: 6,  legal_balls: 6, players: { name: 'Srinivasan' } },
      { player_id: 'p8', wickets: 0, runs_conceded: 10, legal_balls: 6, players: { name: 'Gokul' } },
    ],
    fielding: [],
  },
  inn2: {
    batting: [
      { player_id: 'p5', runs: 20, balls: 14, players: { name: 'Rahul' } },
      { player_id: 'p6', runs: 9,  balls: 8,  players: { name: 'Kamesh S' } },
    ],
    bowling: [
      { player_id: 'p4', wickets: 3, runs_conceded: 3, legal_balls: 6, players: { name: 'Vignesh RT' } },
    ],
    fielding: [],
  },
};

function makeStats(inn1 = INN1, inn2 = INN2) {
  return {
    innings: [inn1, inn2],
    cardMap: { [inn1.id]: CARDS.inn1, [inn2.id]: CARDS.inn2 },
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function renderCard(props = {}) {
  return render(
    <MatchScoreCard
      match={MATCH}
      stats={makeStats()}
      onNavigate={vi.fn()}
      {...props}
    />
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('MatchScoreCard — scores', () => {
  it('shows team1 score from the innings where batting_team === 1', () => {
    renderCard();
    expect(screen.getByText('53/3')).toBeTruthy();
  });

  it('shows team2 score from the innings where batting_team === 2', () => {
    renderCard();
    expect(screen.getByText('53/5')).toBeTruthy();
  });

  it('shows result_summary text', () => {
    renderCard();
    expect(screen.getByText('Match tied')).toBeTruthy();
  });

  it('shows overs for each team', () => {
    renderCard();
    const overTexts = screen.getAllByText(/\(6\.0 ov\)/);
    expect(overTexts.length).toBe(2);
  });

  it('handles missing stats gracefully — shows dashes', () => {
    renderCard({ stats: undefined });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('MatchScoreCard — team assignment (batting_team field)', () => {
  it('correctly assigns performers when team2 bats first', () => {
    // Swap: team2 bats in first innings, team1 bats in second
    const inn1 = { id: 'inn1', batting_team: 2, total_runs: 60, total_wickets: 4, total_legal_balls: 36 };
    const inn2 = { id: 'inn2', batting_team: 1, total_runs: 61, total_wickets: 2, total_legal_balls: 34 };
    const stats = {
      innings: [inn1, inn2],
      cardMap: {
        [inn1.id]: {
          batting:  [{ player_id: 'p-team2-bat', runs: 30, players: { name: 'Team2Batter' } }],
          bowling:  [{ player_id: 'p-team1-bowl', wickets: 2, runs_conceded: 20, players: { name: 'Team1Bowler' } }],
          fielding: [],
        },
        [inn2.id]: {
          batting:  [{ player_id: 'p-team1-bat', runs: 25, players: { name: 'Team1Batter' } }],
          bowling:  [{ player_id: 'p-team2-bowl', wickets: 3, runs_conceded: 15, players: { name: 'Team2Bowler' } }],
          fielding: [],
        },
      },
    };
    render(<MatchScoreCard match={MATCH} stats={stats} onNavigate={vi.fn()} />);

    // Team 1 column (left) should show Team1Batter and Team1Bowler
    expect(screen.getByText('Team1Batter')).toBeTruthy();
    expect(screen.getByText('Team1Bowler')).toBeTruthy();
    // Team 2 column (right) should show Team2Batter and Team2Bowler
    expect(screen.getByText('Team2Batter')).toBeTruthy();
    expect(screen.getByText('Team2Bowler')).toBeTruthy();
  });
});

describe('MatchScoreCard — top performers', () => {
  it('shows top 2 batters per team sorted by runs descending', () => {
    renderCard();
    // BSB top 2: Yuvaraj (21), Ranjith Ravi (18) — Naveen (8) excluded
    expect(screen.getByText('Yuvaraj')).toBeTruthy();
    expect(screen.getByText('Ranjith Ravi')).toBeTruthy();
    expect(screen.queryByText('Naveen')).toBeNull();

    // SK top 2: Rahul (20), Kamesh S (9)
    expect(screen.getByText('Rahul')).toBeTruthy();
    expect(screen.getByText('Kamesh S')).toBeTruthy();
  });

  it('shows top bowler per team', () => {
    renderCard();
    // BSB's top bowler is Vignesh RT (3 wkts in inn2 — team1 bowled there)
    expect(screen.getByText('Vignesh RT')).toBeTruthy();
    // SK's top bowler is Srinivasan (1 wkt in inn1 — team2 bowled there)
    expect(screen.getByText('Srinivasan')).toBeTruthy();
  });

  it('shows bowling figures in green (runs/wickets format)', () => {
    renderCard();
    expect(screen.getByText('3/3')).toBeTruthy(); // Vignesh RT
    expect(screen.getByText('1/6')).toBeTruthy(); // Srinivasan
  });

  it('shows run totals for batters', () => {
    renderCard();
    expect(screen.getByText('21')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });
});

describe('MatchScoreCard — navigation', () => {
  it('calls onNavigate with match id when card is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderCard({ onNavigate });
    // Click the score header button
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onNavigate).toHaveBeenCalledWith('m1');
  });
});

describe('MatchScoreCard — delete button', () => {
  it('does not render delete button when onDelete is not provided', () => {
    renderCard({ onDelete: undefined });
    expect(screen.queryByLabelText('Delete match')).toBeNull();
  });

  it('calls onDelete with match when delete is clicked by a scorer', async () => {
    mockCanScore = true;
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderCard({ onDelete });
    const deleteBtn = screen.getByLabelText('Delete match');
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(MATCH);
  });
});

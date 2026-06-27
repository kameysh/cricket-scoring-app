import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

describe('MatchScoreCard — primary name always shown (not nickname)', () => {
  it('shows player.name even when nickname is set', () => {
    const statsWithNickname = {
      innings: [
        { id: 'inn1', match_id: 'm1', batting_team: 1, total_runs: 50, total_wickets: 2, total_overs: 9 },
      ],
      cardMap: {
        inn1: {
          batting: [{ player_id: 'p1', runs: 30, balls: 20, players: { name: 'Yuvaraj Singh', nickname: 'Yuvi' } }],
          bowling: [{ player_id: 'p2', wickets: 2, runs_conceded: 15, legal_balls: 12, players: { name: 'Ravi Bowler', nickname: 'Ravi' } }],
        },
      },
    };
    const match = { id: 'm1', team1_name: 'SK', team2_name: 'RCB', status: 'completed', winning_team_name: 'SK', result_summary: 'SK won' };
    render(<MatchScoreCard match={match} stats={statsWithNickname} onNavigate={() => {}} />);
    expect(screen.getByText('Yuvaraj Singh')).toBeInTheDocument();
    expect(screen.queryByText('Yuvi')).not.toBeInTheDocument();
    expect(screen.getByText('Ravi Bowler')).toBeInTheDocument();
    expect(screen.queryByText('Ravi')).not.toBeInTheDocument();
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

// ── Home component — live hero with innings scores ────────────────────────────

// Supabase channel mock (same pattern as Scorecard.test.jsx)
const channelHandlers = {};
function makeChannelMock(name) {
  if (!channelHandlers[name]) channelHandlers[name] = {};
  const handlers = channelHandlers[name];
  const mock = {
    on: vi.fn((type, opts, cb) => { handlers[`${opts.event}:${opts.table}`] = cb; return mock; }),
    subscribe: vi.fn(() => mock),
  };
  return mock;
}
vi.mock('../lib/supabase', () => ({
  supabase: { channel: vi.fn(name => makeChannelMock(name)), removeChannel: vi.fn() },
}));

const LIVE_MATCH = {
  id: 'lm1', status: 'live',
  team1_name: 'Super Kings', team2_name: 'Back Street Boyz',
  result_summary: null, venues: null, tournaments: null,
};
const LIVE_INN1 = { id: 'li1', match_id: 'lm1', innings_number: 1, batting_team: 1,
  total_runs: 45, total_wickets: 3, total_legal_balls: 18, is_completed: false };

vi.mock('../services/matchService', () => ({
  listMatches: vi.fn(),
  getInnings: vi.fn(),
  getScorecards: vi.fn().mockResolvedValue({ batting: [], bowling: [], fielding: [] }),
  getMatchNumber: vi.fn().mockResolvedValue(1),
  deleteMatch: vi.fn(),
}));
vi.mock('../services/playerService', () => ({
  getAllCareerStats: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/tournamentService', () => ({
  listTournaments: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/auctionService', () => ({
  listAuctions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/promoService', () => ({
  getActivePromo: vi.fn().mockResolvedValue(null),
}));
vi.mock('../lib/cricketUtils', () => ({
  formatOvers: (balls) => `${Math.floor(balls / 6)}.${balls % 6}`,
  displayName: (p) => p?.nickname?.trim() || p?.name || '',
  matchDateValue: (m) => (m?.match_date ? new Date(`${m.match_date}T00:00:00`) : (m?.created_at ? new Date(m.created_at) : null)),
}));

import * as matchService from '../services/matchService';
import Home from './Home';

async function renderHome() {
  let result;
  await act(async () => { result = render(<Home />); });
  return result;
}

describe('Home — live hero shows innings score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(channelHandlers).forEach(k => delete channelHandlers[k]);
    matchService.listMatches.mockResolvedValue([LIVE_MATCH]);
    matchService.getInnings.mockResolvedValue([LIVE_INN1]);
  });

  it('shows team1 score runs/wickets in live hero', async () => {
    await renderHome();
    expect(screen.getByText('45/3')).toBeTruthy();
  });

  it('shows overs in live hero', async () => {
    await renderHome();
    expect(screen.getByText('(3.0 ov)')).toBeTruthy();
  });

  it('shows "Batting" label on the team currently batting', async () => {
    await renderHome();
    expect(screen.getByText('Batting')).toBeTruthy();
  });

  it('shows "Yet to bat" for team that has not started batting', async () => {
    // Only team1 has an innings — team2 has no innings row yet
    await renderHome();
    expect(screen.getByText('Yet to bat')).toBeTruthy();
  });

  it('patches live score when innings UPDATE fires via realtime', async () => {
    await renderHome();
    // Fire realtime UPDATE on the live-innings channel
    const handler = channelHandlers['home:live-innings']?.['UPDATE:innings'];
    expect(handler).toBeDefined();
    await act(async () => {
      handler({ new: { ...LIVE_INN1, total_runs: 67, total_wickets: 4 } });
    });
    expect(screen.getByText('67/4')).toBeTruthy();
    expect(screen.queryByText('45/3')).toBeNull();
  });
});

import * as auctionService from '../services/auctionService';
import * as promoService from '../services/promoService';

describe('Home — live auction hero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(channelHandlers).forEach(k => delete channelHandlers[k]);
    matchService.listMatches.mockResolvedValue([]);
    matchService.getInnings.mockResolvedValue([]);
  });

  it('shows live auction hero when auction status is live', async () => {
    auctionService.listAuctions.mockResolvedValue([
      { id: 'auc1', name: 'Gully Premier League', status: 'live' },
    ]);
    await renderHome();
    expect(screen.getByText('AUCTION LIVE')).toBeTruthy();
    expect(screen.getByText('Gully Premier League')).toBeTruthy();
    expect(screen.getByText('Join Auction →')).toBeTruthy();
  });

  it('shows paused auction hero when auction status is paused', async () => {
    auctionService.listAuctions.mockResolvedValue([
      { id: 'auc1', name: 'GPL Season 2', status: 'paused' },
    ]);
    await renderHome();
    expect(screen.getByText('AUCTION PAUSED')).toBeTruthy();
  });

  it('does not show auction hero when no live/paused auctions', async () => {
    auctionService.listAuctions.mockResolvedValue([
      { id: 'auc1', name: 'Old Auction', status: 'completed' },
    ]);
    await renderHome();
    expect(screen.queryByText('Join Auction →')).toBeNull();
  });
});

describe('Home — tournament promo banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(channelHandlers).forEach(k => delete channelHandlers[k]);
    matchService.listMatches.mockResolvedValue([]);
    matchService.getInnings.mockResolvedValue([]);
    auctionService.listAuctions.mockResolvedValue([]);
  });

  it('shows promo banner image when an active promo exists', async () => {
    promoService.getActivePromo.mockResolvedValue({
      id: 'pr1',
      banner_url: 'https://cdn.test/banner.png',
      tournament_name: 'GPL 2026',
      team1_name: null, team2_name: null,
      captain1_name: null, captain2_name: null,
      event_date: null,
    });
    await renderHome();
    const img = screen.getByRole('img', { name: 'GPL 2026' });
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://cdn.test/banner.png');
  });

  it('shows tournament name and teams when present', async () => {
    promoService.getActivePromo.mockResolvedValue({
      id: 'pr1',
      banner_url: 'https://cdn.test/banner.png',
      tournament_name: 'GPL 2026',
      team1_name: 'CSK', captain1_name: 'Kamesh',
      team2_name: 'RCB', captain2_name: 'Balaji',
      event_date: null,
    });
    await renderHome();
    expect(screen.getByText('GPL 2026')).toBeTruthy();
    expect(screen.getByText(/CSK.*C: Kamesh.*vs.*RCB.*C: Balaji/)).toBeTruthy();
  });

  it('does not show promo section when no active promo', async () => {
    promoService.getActivePromo.mockResolvedValue(null);
    await renderHome();
    expect(screen.queryByRole('img', { name: /tournament/i })).toBeNull();
  });
});

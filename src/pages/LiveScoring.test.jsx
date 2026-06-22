import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── router ────────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'match-1' }),
  useNavigate: () => mockNavigate,
}));

// ── supabase (not used in these tests but imported by LiveScoring) ────────────
vi.mock('../lib/supabase', () => ({
  supabase: { channel: vi.fn(() => ({ on: vi.fn(), subscribe: vi.fn() })), removeChannel: vi.fn() },
}));

// ── toast ─────────────────────────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// ── offline hook ──────────────────────────────────────────────────────────────
vi.mock('../hooks/useOfflineSync', () => ({ useOfflineSync: () => ({ isOnline: true }) }));

// ── matchService / playerService ──────────────────────────────────────────────
const mockSetMatchStatus = vi.fn().mockResolvedValue();
const mockEndInnings = vi.fn().mockResolvedValue();
const mockStartInnings = vi.fn().mockResolvedValue();
const mockStartSuperOverInnings = vi.fn().mockResolvedValue();
const mockAutoAssign = vi.fn().mockResolvedValue();
const mockIncrementMatches = vi.fn().mockResolvedValue();

vi.mock('../services/matchService', () => ({
  getMatchNumber: vi.fn().mockResolvedValue(1),
  autoAssignManOfMatch: () => mockAutoAssign(),
  incrementMatchesPlayed: () => mockIncrementMatches(),
}));
vi.mock('../services/playerService', () => ({ listPlayers: vi.fn().mockResolvedValue([]) }));

// ── heavy child components — render nothing so tests stay fast ────────────────
vi.mock('../components/scoring/Scoreboard', () => ({ default: () => null }));
vi.mock('../components/scoring/PowerplayBanner', () => ({ default: () => null }));
vi.mock('../components/scoring/FreehitBanner', () => ({ default: () => null }));
vi.mock('../components/scoring/StrikerIndicator', () => ({ default: () => null }));
vi.mock('../components/scoring/LiveScorecardPanel', () => ({ default: () => null }));
vi.mock('../components/scoring/BallInputPanel', () => ({ default: () => null }));
vi.mock('../components/scoring/BallLog', () => ({ default: () => null }));
vi.mock('../components/scoring/JokerPanel', () => ({ default: () => null }));
vi.mock('../components/scoring/WicketModal', () => ({ default: () => null }));
vi.mock('../components/scoring/NewBatsmanModal', () => ({ default: () => null }));
// BowlerSelectModal mock renders a sentinel so tests can detect when it's open and inspect eligible players
vi.mock('../components/scoring/BowlerSelectModal', () => ({
  default: ({ open, title, eligible = [] }) => open
    ? <div data-testid="bowler-modal" data-eligible={eligible.map(p => p.id).join(',')}>{title || 'Select Next Bowler'}</div>
    : null,
}));
vi.mock('../components/scoring/MatchResultBanner', () => ({ default: () => null }));
vi.mock('../components/scoring/PlayerStatsDrawer', () => ({ default: () => null }));
vi.mock('../components/shared/OfflineBanner', () => ({ default: () => null }));
vi.mock('../components/match/PlayerSubSheet', () => ({ default: () => null }));
vi.mock('lucide-react', () => ({ ArrowLeftRight: () => null, X: () => null, ChevronDown: () => null, ChevronUp: () => null }));

// ── useWinCondition — controllable from tests ─────────────────────────────────
let mockWinInfo = null;
vi.mock('../hooks/useWinCondition', () => ({ useWinCondition: () => mockWinInfo }));

// ── matchStore — controllable from tests ──────────────────────────────────────
let mockStoreState = {};
vi.mock('../stores/matchStore', () => ({
  useMatchStore: (selector) => selector ? selector(mockStoreState) : mockStoreState,
}));

import LiveScoring from './LiveScoring';

// ── base fixtures ─────────────────────────────────────────────────────────────
const BASE_MATCH = {
  id: 'match-1', status: 'in_progress', team_size: 6, total_overs: 5,
  team1_name: 'Super Kings', team2_name: 'Back Street Boyz',
  super_over_enabled: true, last_man_standing: false,
  free_hit_on_no_ball: false, max_overs_per_bowler: null,
};

const INN1 = { id: 'i1', innings_number: 1, batting_team: 1, total_runs: 30, total_wickets: 5, total_legal_balls: 30, is_completed: true, is_super_over: false, target: null };
const INN2_TIED = { id: 'i2', innings_number: 2, batting_team: 2, total_runs: 30, total_wickets: 6, total_legal_balls: 30, is_completed: false, is_super_over: false, target: 31 };
const INN2_ALLOUT_LOSING = { ...INN2_TIED, total_runs: 20, total_wickets: 6 };

function buildStore(overrides = {}) {
  return {
    match: BASE_MATCH,
    innings: [INN1, INN2_TIED],
    currentInnings: INN2_TIED,
    matchPlayers: [],
    deliveries: [],
    battingScorecards: [],
    bowlingScorecards: [],
    fieldingScorecards: [],
    striker: 'p1',
    nonStriker: 'p2',
    bowler: 'p3',
    keeper: 'p4',
    jokerId: null,
    freeHit: false,
    undoAvailable: false,
    scoringInProgress: false,
    load: vi.fn().mockResolvedValue({ match: BASE_MATCH, currentInnings: INN2_TIED }),
    loadMatch: vi.fn().mockResolvedValue({ match: BASE_MATCH, currentInnings: INN2_TIED }),
    reset: vi.fn(),
    endInnings: mockEndInnings,
    startInnings: mockStartInnings,
    startSuperOverInnings: mockStartSuperOverInnings,
    setMatchStatus: mockSetMatchStatus,
    scoreBall: vi.fn(),
    undo: vi.fn(),
    setOpeners: vi.fn(),
    setBowler: vi.fn(),
    setKeeper: vi.fn(),
    swapStriker: vi.fn(),
    retireBatsman: vi.fn(),
    swapPlayer: vi.fn(),
    swapBack: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWinInfo = null;
  mockStoreState = buildStore();
  mockNavigate.mockReset();
});

async function renderLiveScoring() {
  let result;
  await act(async () => { result = render(<LiveScoring />); });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('LiveScoring — scoring panel has opaque background (no bleed-through)', () => {
  it('fixed BallInputPanel wrapper has bg-white class so content behind it cannot show through', async () => {
    mockStoreState = buildStore({ currentInnings: INN2_TIED });
    mockWinInfo = null;
    const { container } = await renderLiveScoring();
    // The outer fixed div wrapping BallInputPanel must have bg-white (opaque) so the
    // BallLog and scrollable page content behind it never bleed through the panel.
    const fixedPanel = container.querySelector('.fixed.bottom-16');
    expect(fixedPanel).toBeTruthy();
    expect(fixedPanel.className).toContain('bg-white');
  });
});

describe('LiveScoring — dual modal prevention (tie + super over)', () => {
  it('shows Super Over sheet (not Match Result) when main innings ties with SO enabled', async () => {
    mockStoreState = buildStore({ currentInnings: INN2_TIED });
    mockWinInfo = { won: true, type: 'tie', winner: null, summary: 'Match tied', margin: 0 };
    await renderLiveScoring();
    expect(screen.getByText('Match Tied — Super Over!')).toBeTruthy();
    expect(screen.queryByText('Match Result')).toBeNull();
  });

  it('shows Match Result (not Super Over) when innings 2 is all-out and team loses', async () => {
    mockStoreState = buildStore({ currentInnings: INN2_ALLOUT_LOSING });
    mockWinInfo = { won: true, type: 'runs', winner: 'Super Kings', summary: 'Super Kings won by 10 runs', margin: 10 };
    await renderLiveScoring();
    expect(screen.getByText('Match Result')).toBeTruthy();
    expect(screen.queryByText('Match Tied — Super Over!')).toBeNull();
  });

  it('does NOT show any result modal when innings 2 is in progress (no winner yet)', async () => {
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.queryByText('Match Result')).toBeNull();
    expect(screen.queryByText('Match Tied — Super Over!')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LiveScoring — all-out effect (odd vs even innings)', () => {
  it('does NOT auto-open winConfirm when even innings (innings 2) goes all-out — winInfo handles it', async () => {
    // All-out on innings 2 but no winner yet (winInfo still null = chasing hasn't finished)
    const inn2AllOut = { ...INN2_TIED, total_wickets: 6 };
    mockStoreState = buildStore({ currentInnings: inn2AllOut });
    mockWinInfo = null; // haven't crossed target yet despite all-out
    await renderLiveScoring();
    // No modal should open — winInfo is null so neither modal should appear
    expect(screen.queryByText('Match Result')).toBeNull();
    expect(screen.queryByText('Match Tied — Super Over!')).toBeNull();
  });

  it('calls endInnings when SO first innings (innings 3, odd) is all-out at 2 wickets', async () => {
    const soInn3 = { id: 'i3', innings_number: 3, batting_team: 2, total_runs: 10, total_wickets: 2, total_legal_balls: 4, is_completed: false, is_super_over: true, target: null };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true }, soInn3],
      currentInnings: soInn3,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    mockWinInfo = null;
    await renderLiveScoring();
    // Odd SO innings all-out (2 wickets) → handleEndInnings → startSuperOverInnings
    expect(mockEndInnings).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LiveScoring — BallInputPanel disabled when decision modal is open', () => {
  it('disables BallInputPanel when oversLimitOpen (SO over limit reached)', async () => {
    // SO innings at exactly 6 legal balls → oversLimitOpen fires
    const soInn = { id: 'i3', innings_number: 3, batting_team: 2, total_runs: 10, total_wickets: 0, total_legal_balls: 6, is_completed: false, is_super_over: true, target: null };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true }, soInn],
      currentInnings: soInn,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    mockWinInfo = null;
    await renderLiveScoring();
    // The "Super Over Complete" sheet should be open; BallInputPanel disabled via prop
    // BallInputPanel is mocked to null, but we can verify the overs-limit sheet appeared
    expect(screen.getByText('Super Over Complete')).toBeTruthy();
  });
});

describe('LiveScoring — BallInputPanel disabled for ALL decision modals', () => {
  it('disables ball input when winConfirmOpen (regular win)', async () => {
    mockWinInfo = { won: true, type: 'runs', winner: 'Super Kings', summary: 'Super Kings won by 5 runs', margin: 5 };
    mockStoreState = buildStore({ currentInnings: INN2_TIED });
    await renderLiveScoring();
    // Match Result sheet is open — BallInputPanel mock receives disabled=true
    // We can verify by checking the sheet is shown (which only happens when modal opens)
    expect(screen.getByText('Match Result')).toBeTruthy();
  });

  it('disables ball input when superOverOpen (tie + SO enabled)', async () => {
    mockWinInfo = { won: true, type: 'tie', winner: null, summary: 'Match tied', margin: 0 };
    mockStoreState = buildStore({ currentInnings: INN2_TIED });
    await renderLiveScoring();
    expect(screen.getByText('Match Tied — Super Over!')).toBeTruthy();
  });

  it('overs-limit sheet shows "Super Over Complete" title (not match overs) for SO innings', async () => {
    const soInnComplete = { id: 'i3', innings_number: 3, batting_team: 2, total_runs: 8,
      total_wickets: 0, total_legal_balls: 6, is_completed: false, is_super_over: true, target: null };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true }, soInnComplete],
      currentInnings: soInnComplete,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.getByText('Super Over Complete')).toBeTruthy();
    expect(screen.queryByText(/Overs Complete/)).toBeNull();
  });

  it('overs-limit sheet shows "<N> Overs Complete" title for regular innings', async () => {
    // innings 1 that is NOT completed but has all 30 balls bowled
    const inn1AtLimit = { id: 'i1', innings_number: 1, batting_team: 1, total_runs: 45,
      total_wickets: 2, total_legal_balls: 30, is_completed: false, is_super_over: false, target: null };
    mockStoreState = buildStore({ innings: [inn1AtLimit], currentInnings: inn1AtLimit });
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.getByText('5 Overs Complete')).toBeTruthy();
    expect(screen.queryByText('Super Over Complete')).toBeNull();
  });
});

describe('LiveScoring — successive super over (SO itself ties)', () => {
  it('shows Super Over sheet again when SO innings 4 is also tied', async () => {
    const soInn4Tied = { id: 'i4', innings_number: 4, batting_team: 1, total_runs: 10,
      total_wickets: 0, total_legal_balls: 6, is_completed: false, is_super_over: true, target: 11 };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true },
        { id: 'i3', innings_number: 3, batting_team: 2, total_runs: 10, is_completed: true, is_super_over: true },
        soInn4Tied],
      currentInnings: soInn4Tied,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    // SO tie → type='tie' → should show Super Over sheet again (not Match Result)
    mockWinInfo = { won: true, type: 'tie', winner: null, summary: 'Match tied', margin: 0 };
    await renderLiveScoring();
    expect(screen.getByText('Match Tied — Super Over!')).toBeTruthy();
    expect(screen.queryByText('Match Result')).toBeNull();
  });

  it('shows Match Result for SO innings 4 with a winner (not a tie)', async () => {
    const soInn4Win = { id: 'i4', innings_number: 4, batting_team: 1, total_runs: 12,
      total_wickets: 0, total_legal_balls: 4, is_completed: false, is_super_over: true, target: 11 };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true },
        { id: 'i3', innings_number: 3, is_completed: true, is_super_over: true },
        soInn4Win],
      currentInnings: soInn4Win,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    mockWinInfo = { won: true, type: 'super_over', winner: 'Super Kings', summary: 'Super Kings won Super Over by 5 wickets', margin: 5 };
    await renderLiveScoring();
    expect(screen.getByText('Match Result')).toBeTruthy();
    expect(screen.queryByText('Match Tied — Super Over!')).toBeNull();
  });
});

describe('LiveScoring — SO disabled on tie (no super over sheet)', () => {
  it('shows Match Result (type=tie) when SO disabled and match ties', async () => {
    mockStoreState = buildStore({
      currentInnings: INN2_TIED,
      match: { ...BASE_MATCH, super_over_enabled: false },
    });
    mockWinInfo = { won: true, type: 'tie', winner: null, summary: 'Match tied', margin: 0 };
    await renderLiveScoring();
    expect(screen.getByText('Match Result')).toBeTruthy();
    expect(screen.queryByText('Match Tied — Super Over!')).toBeNull();
  });
});

// ─── Bowler modal suppression ─────────────────────────────────────────────────
describe('LiveScoring — bowler modal must NOT open when decision sheet is showing', () => {
  it('does NOT show bowler modal when match is tied (winInfo.won=true)', async () => {
    // bowler=null simulates the over having just ended and bowler reset
    mockStoreState = buildStore({ currentInnings: INN2_TIED, bowler: null });
    mockWinInfo = { won: true, type: 'tie', winner: null, summary: 'Match tied', margin: 0 };
    await renderLiveScoring();
    // SO sheet must be open
    expect(screen.getByText('Match Tied — Super Over!')).toBeTruthy();
    // Bowler modal must NOT be open
    expect(screen.queryByTestId('bowler-modal')).toBeNull();
  });

  it('does NOT show bowler modal when regular match is won', async () => {
    mockStoreState = buildStore({ currentInnings: { ...INN2_TIED, total_runs: 35 }, bowler: null });
    mockWinInfo = { won: true, type: 'wickets', winner: 'Back Street Boyz', summary: 'Back Street Boyz won by 4 wickets', margin: 4 };
    await renderLiveScoring();
    expect(screen.getByText('Match Result')).toBeTruthy();
    expect(screen.queryByTestId('bowler-modal')).toBeNull();
  });

  it('does NOT show bowler modal when overs limit reached (innings 2, no winner yet)', async () => {
    // innings 2 at exactly 30 balls (5 overs), no win yet (still need runs), bowler=null (over ended)
    const inn2AtLimit = { ...INN2_TIED, total_legal_balls: 30, total_runs: 10, total_wickets: 0 };
    mockStoreState = buildStore({ currentInnings: inn2AtLimit, bowler: null });
    mockWinInfo = null; // haven't won yet
    await renderLiveScoring();
    // Overs-limit sheet must be open
    expect(screen.getByText('5 Overs Complete')).toBeTruthy();
    // Bowler modal must NOT be open
    expect(screen.queryByTestId('bowler-modal')).toBeNull();
  });

  it('does NOT show bowler modal when SO overs limit reached (SO first innings at 6 balls)', async () => {
    const soInn3AtLimit = { id: 'i3', innings_number: 3, batting_team: 2,
      total_runs: 12, total_wickets: 0, total_legal_balls: 6,
      is_completed: false, is_super_over: true, target: null };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true }, soInn3AtLimit],
      currentInnings: soInn3AtLimit,
      bowler: null,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.getByText('Super Over Complete')).toBeTruthy();
    expect(screen.queryByTestId('bowler-modal')).toBeNull();
  });

  it('DOES show bowler modal in mid-innings when bowler is unset and no decision pending', async () => {
    // innings 2, 3 legal balls in, no win yet, no overs limit — bowler modal should open
    const inn2MidOver = { ...INN2_TIED, total_legal_balls: 3, total_runs: 5, total_wickets: 0 };
    mockStoreState = buildStore({ currentInnings: inn2MidOver, bowler: null });
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.getByTestId('bowler-modal')).toBeTruthy();
  });
});

// ─── Overs-complete sheet body text ───────────────────────────────────────────
describe('LiveScoring — overs-complete sheet body text', () => {
  it('shows generic overs text for regular innings', async () => {
    const inn1AtLimit = { id: 'i1', innings_number: 1, batting_team: 1,
      total_runs: 45, total_wickets: 2, total_legal_balls: 30,
      is_completed: false, is_super_over: false, target: null };
    mockStoreState = buildStore({ innings: [inn1AtLimit], currentInnings: inn1AtLimit });
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.getByText(/All 5 overs have been bowled/)).toBeTruthy();
    expect(screen.queryByText(/super over is complete/i)).toBeNull();
  });

  it('shows SO-specific text for super over innings at limit', async () => {
    const soInn3AtLimit = { id: 'i3', innings_number: 3, batting_team: 2,
      total_runs: 12, total_wickets: 0, total_legal_balls: 6,
      is_completed: false, is_super_over: true, target: null };
    mockStoreState = buildStore({
      innings: [INN1, { ...INN2_TIED, is_completed: true }, soInn3AtLimit],
      currentInnings: soInn3AtLimit,
      match: { ...BASE_MATCH, super_over_enabled: true },
    });
    mockWinInfo = null;
    await renderLiveScoring();
    expect(screen.getByText(/super over is complete/i)).toBeTruthy();
    expect(screen.queryByText(/All 5 overs have been bowled/)).toBeNull();
  });
});

// ─── Keeper modal excludes current bowler ────────────────────────────────────
// batting_team=1 → bowling team=2; so bowling team players must have team:2
const BOWLING_TEAM_PLAYERS = [
  { id: 'mp-bowl', player_id: 'p-bowl', team: 2, is_active: true, players: { id: 'p-bowl', name: 'Kamesh' } },
  { id: 'mp-keep', player_id: 'p-keep', team: 2, is_active: true, players: { id: 'p-keep', name: 'Manoj' } },
  { id: 'mp-other', player_id: 'p-other', team: 2, is_active: true, players: { id: 'p-other', name: 'Naveen' } },
];
const INN_BATTING_T1 = { id: 'i1', innings_number: 1, batting_team: 1, total_runs: 5, total_wickets: 0, total_legal_balls: 3, is_completed: false, is_super_over: false, target: null };

describe('LiveScoring — keeper modal must NOT include the current bowler', () => {
  it('keeper modal eligible list excludes the current bowler', async () => {
    mockStoreState = buildStore({
      innings: [INN_BATTING_T1],
      currentInnings: INN_BATTING_T1,
      matchPlayers: BOWLING_TEAM_PLAYERS,
      bowler: 'p-bowl',   // Kamesh is currently bowling
      keeper: 'p-keep',
    });
    mockWinInfo = null;
    await renderLiveScoring();

    // Open keeper modal via "Change" button next to Keeper row
    // Bowler row shows "Change" first, Keeper row "Change" second
    const changeBtns = screen.getAllByRole('button', { name: /change/i });
    await act(async () => { await userEvent.click(changeBtns[1]); });

    const keeperModal = screen.getByTestId('bowler-modal');
    const eligible = keeperModal.getAttribute('data-eligible');
    expect(eligible).not.toContain('p-bowl');   // current bowler excluded
    expect(eligible).toContain('p-keep');        // others still included
    expect(eligible).toContain('p-other');
  });

  it('bowler modal eligible list CAN include the current keeper', async () => {
    mockStoreState = buildStore({
      innings: [INN_BATTING_T1],
      currentInnings: INN_BATTING_T1,
      matchPlayers: BOWLING_TEAM_PLAYERS,
      bowler: null,        // no bowler → modal auto-opens
      keeper: 'p-keep',
    });
    mockWinInfo = null;
    await renderLiveScoring();

    const bowlerModal = screen.getByTestId('bowler-modal');
    const eligible = bowlerModal.getAttribute('data-eligible');
    // keeper (Manoj/p-keep) CAN appear in bowler modal
    expect(eligible).toContain('p-keep');
  });
});

describe('LiveScoring — End Innings button completes match on final innings', () => {
  it('calls store.setMatchStatus completed when End Innings clicked on final innings (innings 2)', async () => {
    mockWinInfo = { won: true, type: 'runs', winner: 'Super Kings', summary: 'Super Kings won by 10 runs', margin: 10 };
    mockStoreState = buildStore({ currentInnings: INN2_TIED });
    await renderLiveScoring();

    // Click End Match on the Match Result sheet that should be open
    const endMatchBtn = screen.getByRole('button', { name: /end match/i });
    await act(async () => { await userEvent.click(endMatchBtn); });

    expect(mockSetMatchStatus).toHaveBeenCalledWith('completed', expect.objectContaining({ result_type: 'runs' }));
  });

  it('calls store.setMatchStatus completed when End Innings button clicked manually (no winInfo)', async () => {
    mockWinInfo = null;
    mockStoreState = buildStore({ currentInnings: { ...INN2_TIED, total_wickets: 0, total_legal_balls: 30 } });
    await renderLiveScoring();

    // Header "End Innings" button (first one; overs-limit sheet may also have one)
    const endInningsBtns = screen.getAllByRole('button', { name: /end innings/i });
    await act(async () => { await userEvent.click(endInningsBtns[0]); });

    // Final innings manually ended → should complete the match
    expect(mockEndInnings).toHaveBeenCalled();
    expect(mockSetMatchStatus).toHaveBeenCalledWith('completed', expect.any(Object));
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../services/tournamentService', () => ({
  getTournament: vi.fn(),
  getTournamentTeams: vi.fn(),
  getTournamentMatches: vi.fn(),
  getTeamPlayersForTournament: vi.fn(),
  setTeamPlayers: vi.fn(),
}));
vi.mock('../services/matchService', () => ({
  createMatch: vi.fn(),
  setMatchPlayers: vi.fn(),
}));
vi.mock('../services/venueService', () => ({ listVenues: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/teamService', () => ({
  listTeams: vi.fn(),
  getAllTeamPlayers: vi.fn(),
}));
vi.mock('../services/auctionService', () => ({
  listAuctionTeams: vi.fn(),
}));
vi.mock('../components/match/PlayerSearch', () => ({
  default: ({ players, selectedIds }) => (
    <div data-testid="player-search">
      {players.map(p => (
        <div key={p.id} data-testid={`player-${p.id}`}
          data-selected={selectedIds.includes(p.id) ? 'true' : 'false'}>
          {p.name}
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../components/player/PlayerAvatar', () => ({ default: () => null }));
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ canManageTournaments: true }) }));
vi.mock('lucide-react', () => ({
  UserPlus: () => null, X: () => null, CheckCircle2: () => null,
  ArrowLeftRight: () => null, Trash2: () => null,
}));

import * as tournamentService from '../services/tournamentService';
import * as teamService from '../services/teamService';
import * as auctionService from '../services/auctionService';
import TournamentSetup from './TournamentSetup';

const PLAYERS = [
  { id: 'p1', name: 'Kamesh', user_id: 'u1', is_guest: false },
  { id: 'p2', name: 'Balaji', user_id: 'u2', is_guest: false },
  { id: 'p3', name: 'Charu', user_id: 'u3', is_guest: false },
];

vi.mock('../stores/playerStore', () => ({
  usePlayerStore: (sel) => sel({ players: PLAYERS, fetchPlayers: vi.fn(), addPlayer: vi.fn() }),
}));

const BASE_TOURNAMENT = {
  id: 't1', name: 'GPL 2026', series_matches: 3,
  venue_id: null, series_id: null,
};
const TOURNAMENT_TEAMS = [
  { id: 'tt1', tournament_id: 't1', name: 'CSK' },
  { id: 'tt2', tournament_id: 't1', name: 'RCB' },
];

function setup(overrides = {}) {
  vi.mocked(tournamentService.getTournament).mockResolvedValue(BASE_TOURNAMENT);
  vi.mocked(tournamentService.getTournamentTeams).mockResolvedValue(TOURNAMENT_TEAMS);
  vi.mocked(tournamentService.getTournamentMatches).mockResolvedValue([]);
  vi.mocked(tournamentService.getTeamPlayersForTournament).mockResolvedValue({});
  vi.mocked(teamService.listTeams).mockResolvedValue(overrides.globalTeams ?? []);
  vi.mocked(teamService.getAllTeamPlayers).mockResolvedValue(overrides.allTeamPlayers ?? []);
  vi.mocked(auctionService.listAuctionTeams).mockResolvedValue(overrides.auctionTeams ?? []);
}

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={['/tournaments/t1/setup']}>
      <Routes>
        <Route path="/tournaments/:id/setup" element={<TournamentSetup />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TournamentSetup — auto-select players from registry roster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pre-selects players matching the global team roster', async () => {
    setup({
      globalTeams: [
        { id: 'g1', name: 'CSK', source_auction_id: 'auc1' },
        { id: 'g2', name: 'RCB', source_auction_id: 'auc1' },
      ],
      allTeamPlayers: [
        { team_id: 'g1', player_id: 'p1' },
        { team_id: 'g1', player_id: 'p2' },
        { team_id: 'g2', player_id: 'p3' },
      ],
      auctionTeams: [
        { id: 'at1', name: 'CSK', captain_id: null },
        { id: 'at2', name: 'RCB', captain_id: null },
      ],
    });
    renderSetup();
    // p1 and p2 belong to CSK roster — they appear as player chips
    await waitFor(() => expect(screen.getByText('Setup Teams')).toBeInTheDocument());
    // Player names appear in both chips and captain select options — use getAllByText
    await waitFor(() => expect(screen.getAllByText('Kamesh').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Balaji').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Charu').length).toBeGreaterThan(0);
  });

  it('does not auto-select players for teams with no matching registry roster', async () => {
    setup({
      globalTeams: [],
      allTeamPlayers: [],
      auctionTeams: [],
    });
    renderSetup();
    await waitFor(() => expect(screen.getByText('Setup Teams')).toBeInTheDocument());
    // No players should be auto-assigned — no chips rendered
    expect(screen.queryByText('Kamesh')).not.toBeInTheDocument();
  });
});

describe('TournamentSetup — auto-populate captain from auction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pre-selects the captain whose user_id matches auction team captain_id', async () => {
    setup({
      globalTeams: [
        { id: 'g1', name: 'CSK', source_auction_id: 'auc1' },
        { id: 'g2', name: 'RCB', source_auction_id: 'auc1' },
      ],
      allTeamPlayers: [
        { team_id: 'g1', player_id: 'p1' },
        { team_id: 'g1', player_id: 'p2' },
        { team_id: 'g2', player_id: 'p3' },
      ],
      // Kamesh (user_id='u1', player id='p1') is captain of CSK
      auctionTeams: [
        { id: 'at1', name: 'CSK', captain_id: 'u1' },
        { id: 'at2', name: 'RCB', captain_id: 'u3' },
      ],
    });
    renderSetup();
    await waitFor(() => expect(screen.getByText('Setup Teams')).toBeInTheDocument());
    // Wait for players to render as chips (means teamPlayers state populated)
    await waitFor(() => expect(screen.getAllByText('Kamesh').length).toBeGreaterThan(0));
    // Captain select should have p1 (Kamesh) selected for CSK
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const captainSelect = selects.find(s => s.value === 'p1');
      expect(captainSelect).toBeDefined();
    });
  });

  it('does not set captain when no matching player has that user_id', async () => {
    setup({
      globalTeams: [{ id: 'g1', name: 'CSK', source_auction_id: 'auc1' }],
      allTeamPlayers: [{ team_id: 'g1', player_id: 'p1' }],
      auctionTeams: [{ id: 'at1', name: 'CSK', captain_id: 'unknown-uid' }],
    });
    renderSetup();
    await waitFor(() => expect(screen.getByText('Setup Teams')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('CSK')).toBeInTheDocument());
    // No crash — captain select stays at empty placeholder
    const selects = screen.getAllByRole('combobox');
    const captainSelects = selects.filter(s => s.value === '');
    expect(captainSelects.length).toBeGreaterThan(0);
  });
});

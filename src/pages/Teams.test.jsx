import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── service mocks ─────────────────────────────────────────────────────────────
vi.mock('../services/teamService', () => ({
  listTeams: vi.fn(),
  addTeam: vi.fn(),
  deleteTeam: vi.fn(),
  updateTeamName: vi.fn(),
  getAllTeamPlayers: vi.fn(),
  getTeamPlayers: vi.fn(),
  setTeamPlayers: vi.fn(),
}));

vi.mock('../services/playerService', () => ({
  listPlayers: vi.fn(),
}));

import Teams from './Teams';
import * as teamService from '../services/teamService';
import * as playerService from '../services/playerService';

// ── fixtures ──────────────────────────────────────────────────────────────────
const TEAM_A = { id: 'ta', name: 'Back Street Boyz', is_guest: false };
const TEAM_B = { id: 'tb', name: 'Super Kings', is_guest: false };

const PLAYER_IN_A  = { id: 'p1', name: 'Balaji M',   photo_url: null, is_guest: false };
const PLAYER_IN_B  = { id: 'p2', name: 'Charu',      photo_url: null, is_guest: false };
const PLAYER_FREE  = { id: 'p3', name: 'Dinesh',     photo_url: null, is_guest: false };

function setup() {
  // Team A has p1; Team B has p2; p3 is unassigned
  teamService.listTeams.mockResolvedValue([TEAM_A, TEAM_B]);
  playerService.listPlayers.mockResolvedValue([PLAYER_IN_A, PLAYER_IN_B, PLAYER_FREE]);
  teamService.getAllTeamPlayers.mockResolvedValue([
    { team_id: 'ta', player_id: 'p1' },
    { team_id: 'tb', player_id: 'p2' },
  ]);
}

// ── helpers ───────────────────────────────────────────────────────────────────
async function expandTeam(teamName, rosterIds = []) {
  teamService.getTeamPlayers.mockResolvedValue(rosterIds);
  render(<Teams />);
  await waitFor(() => expect(screen.getByText('Back Street Boyz')).toBeInTheDocument());
  await userEvent.click(screen.getByText(teamName));
  // Wait for roster section header
  await waitFor(() => expect(screen.getByText('Roster')).toBeInTheDocument());
}

async function expandTeamAndOpenAddPanel(teamName, rosterIds = []) {
  await expandTeam(teamName, rosterIds);
  await userEvent.click(screen.getByText('Add / Remove Players'));
  await waitFor(() => expect(screen.getByPlaceholderText('Search players…')).toBeInTheDocument());
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('Teams — roster player filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('shows roster players immediately on expand (no add panel needed)', async () => {
    teamService.getTeamPlayers.mockResolvedValue(['p1']);
    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Back Street Boyz')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Back Street Boyz'));
    await waitFor(() => expect(screen.getByText('Roster')).toBeInTheDocument());
    // p1 (Balaji M) is in roster — shown without opening add panel
    expect(screen.getByText('Balaji M')).toBeInTheDocument();
  });

  it('shows all players in add panel for non-auction team', async () => {
    teamService.getAllTeamPlayers.mockResolvedValue([]);
    await expandTeamAndOpenAddPanel('Back Street Boyz', []);
    expect(screen.getByText('Balaji M')).toBeInTheDocument();
    expect(screen.getByText('Charu')).toBeInTheDocument();
    expect(screen.getByText('Dinesh')).toBeInTheDocument();
  });

  it("shows a player assigned to another team as disabled with 'In <team>' label", async () => {
    await expandTeamAndOpenAddPanel('Super Kings', ['p2']);
    const balajiBtn = screen.getByRole('button', { name: /Balaji M/i });
    expect(balajiBtn).toBeDisabled();
    expect(screen.getByText('In Back Street Boyz')).toBeInTheDocument();
  });

  it("does NOT show 'In <team>' label for a player in the current team's roster", async () => {
    await expandTeam('Back Street Boyz', ['p1']);
    // p1 is in this team's roster section — no "In ..." label
    expect(screen.queryByText('In Back Street Boyz')).not.toBeInTheDocument();
  });

  it('unassigned player is enabled in add panel', async () => {
    teamService.setTeamPlayers.mockResolvedValue();
    await expandTeamAndOpenAddPanel('Super Kings', []);
    const dineshBtn = screen.getByRole('button', { name: /Dinesh/i });
    expect(dineshBtn).not.toBeDisabled();
  });

  it('clicking a disabled (cross-team) player does not call setTeamPlayers', async () => {
    await expandTeamAndOpenAddPanel('Super Kings', ['p2']);
    const balajiBtn = screen.getByRole('button', { name: /Balaji M/i });
    await userEvent.click(balajiBtn);
    expect(teamService.setTeamPlayers).not.toHaveBeenCalled();
  });
});

describe('Teams — auction team roster is restricted to sold players', () => {
  it('shows only sold players in roster for auction-sourced team', async () => {
    const auctionTeam = {
      id: 'ta', name: 'Super Kings', is_guest: false,
      source_auction_id: 'auc1',
      source_auction: { name: 'GPL' },
    };
    teamService.listTeams.mockResolvedValue([auctionTeam]);
    playerService.listPlayers.mockResolvedValue([
      { id: 'p1', name: 'Sold Player', photo_url: null, is_guest: false },
      { id: 'p2', name: 'Other Player', photo_url: null, is_guest: false },
    ]);
    teamService.getAllTeamPlayers.mockResolvedValue([{ team_id: 'ta', player_id: 'p1' }]);
    teamService.getTeamPlayers.mockResolvedValue(['p1']);

    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Super Kings')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Super Kings'));
    await waitFor(() => expect(screen.getByText('Roster')).toBeInTheDocument());

    // Only p1 (roster/sold player) shown — Other Player not in roster
    expect(screen.getByText('Sold Player')).toBeInTheDocument();
    expect(screen.queryByText('Other Player')).not.toBeInTheDocument();
    // No "Add / Remove Players" button for auction teams
    expect(screen.queryByText('Add / Remove Players')).not.toBeInTheDocument();
  });

  it('shows all players in add panel for non-auction team', async () => {
    teamService.listTeams.mockResolvedValue([TEAM_A]);
    playerService.listPlayers.mockResolvedValue([PLAYER_IN_A, PLAYER_FREE]);
    teamService.getAllTeamPlayers.mockResolvedValue([{ team_id: 'ta', player_id: 'p1' }]);
    teamService.getTeamPlayers.mockResolvedValue(['p1']);

    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Back Street Boyz')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Back Street Boyz'));
    await waitFor(() => expect(screen.getByText('Roster')).toBeInTheDocument());
    // Open the add panel
    await userEvent.click(screen.getByText('Add / Remove Players'));
    await waitFor(() => expect(screen.getByPlaceholderText('Search players…')).toBeInTheDocument());

    // Both players visible for non-auction teams (Balaji M may appear in roster + add panel)
    expect(screen.getAllByText('Balaji M').length).toBeGreaterThan(0);
    expect(screen.getByText('Dinesh')).toBeInTheDocument();
  });
});

describe('Teams — auction source label', () => {
  it('shows auction name badge on teams created from an auction', async () => {
    teamService.listTeams.mockResolvedValue([
      {
        id: 'ta', name: 'Super Kings', is_guest: false,
        source_auction_id: 'auc1',
        source_auction: { name: 'Gully Premier League' },
      },
      {
        id: 'tb', name: 'RCB', is_guest: false,
        source_auction_id: null,
        source_auction: null,
      },
    ]);
    playerService.listPlayers.mockResolvedValue([]);
    teamService.getAllTeamPlayers.mockResolvedValue([]);

    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Super Kings')).toBeInTheDocument());

    expect(screen.getByText(/Gully Premier League/)).toBeInTheDocument();
    // RCB has no auction badge
    expect(screen.queryAllByText(/Gully Premier League/).length).toBe(1);
  });
});

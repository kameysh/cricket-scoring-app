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
async function renderAndExpandTeam(teamName, teamId, rosterIds = []) {
  teamService.getTeamPlayers.mockResolvedValue(rosterIds);
  const utils = render(<Teams />);
  // Wait for initial load
  await waitFor(() => expect(screen.getByText('Back Street Boyz')).toBeInTheDocument());
  // Expand the requested team
  await userEvent.click(screen.getByText(teamName));
  await waitFor(() => expect(screen.getByPlaceholderText('Search players…')).toBeInTheDocument());
  return utils;
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('Teams — roster player filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('shows all players when expanding a team with no prior assignments', async () => {
    // Both teams have empty rosters for this test
    teamService.getAllTeamPlayers.mockResolvedValue([]);
    teamService.getTeamPlayers.mockResolvedValue([]);
    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Back Street Boyz')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Back Street Boyz'));
    await waitFor(() => expect(screen.getByPlaceholderText('Search players…')).toBeInTheDocument());

    expect(screen.getByText('Balaji M')).toBeInTheDocument();
    expect(screen.getByText('Charu')).toBeInTheDocument();
    expect(screen.getByText('Dinesh')).toBeInTheDocument();
  });

  it('shows own-team players as selected (green checkmark button)', async () => {
    // Team A has p1 in its roster
    teamService.getTeamPlayers.mockResolvedValue(['p1']);
    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Back Street Boyz')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Back Street Boyz'));
    await waitFor(() => expect(screen.getByPlaceholderText('Search players…')).toBeInTheDocument());

    // p1 (Balaji M) is in team A — its row should NOT be disabled
    const balajiBtn = screen.getByRole('button', { name: /Balaji M/i });
    expect(balajiBtn).not.toBeDisabled();
  });

  it("shows a player assigned to another team as disabled with 'In <team>' label", async () => {
    // Expand Team B; p1 is assigned to Team A
    await renderAndExpandTeam('Super Kings', 'tb', ['p2']);

    // p1 (Balaji M) is on Team A — should be disabled
    const balajiBtn = screen.getByRole('button', { name: /Balaji M/i });
    expect(balajiBtn).toBeDisabled();

    // Should show "In Back Street Boyz" sublabel
    expect(screen.getByText('In Back Street Boyz')).toBeInTheDocument();
  });

  it("does NOT show 'In <team>' label for a player assigned to the current team", async () => {
    // Expand Team A; p1 is assigned to Team A
    await renderAndExpandTeam('Back Street Boyz', 'ta', ['p1']);

    // p1 belongs to this team — should NOT show "In Back Street Boyz"
    expect(screen.queryByText('In Back Street Boyz')).not.toBeInTheDocument();
  });

  it('unassigned player is enabled and clickable', async () => {
    teamService.setTeamPlayers.mockResolvedValue();
    await renderAndExpandTeam('Super Kings', 'tb', []);

    // p3 (Dinesh) is unassigned — should be enabled
    const dineshBtn = screen.getByRole('button', { name: /Dinesh/i });
    expect(dineshBtn).not.toBeDisabled();
  });

  it('clicking a player in another team does not call setTeamPlayers', async () => {
    // Expand Team B; p1 is on Team A
    await renderAndExpandTeam('Super Kings', 'tb', ['p2']);

    const balajiBtn = screen.getByRole('button', { name: /Balaji M/i });
    // Disabled buttons ignore click events
    await userEvent.click(balajiBtn);
    expect(teamService.setTeamPlayers).not.toHaveBeenCalled();
  });
});

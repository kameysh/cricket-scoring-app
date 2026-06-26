import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerSubSheet from './PlayerSubSheet';

vi.mock('../player/PlayerAvatar', () => ({ default: () => <span data-testid="avatar" /> }));

const MATCH = { team1_name: 'Lion Kings', team2_name: 'Apex Avengers' };

// Active squad: two team-1 players to sub out
const MATCH_PLAYERS = [
  { id: 'mp-1', player_id: 'p1', team: 1, is_active: true, players: { id: 'p1', name: 'Virat', photo_url: null } },
  { id: 'mp-2', player_id: 'p2', team: 1, is_active: true, players: { id: 'p2', name: 'Rohit', photo_url: null } },
];
const ALL_PLAYERS = [
  { id: 'p9', name: 'Replacement Guy', photo_url: null },
];

function renderSheet(props = {}) {
  return render(
    <PlayerSubSheet
      open
      onClose={() => {}}
      match={MATCH}
      matchPlayers={MATCH_PLAYERS}
      allPlayers={ALL_PLAYERS}
      onSwap={props.onSwap || vi.fn()}
      onSwapBack={vi.fn()}
      tournamentMatch={props.tournamentMatch ?? false}
    />
  );
}

// Advance from step 1 (pick outgoing) to step 2 (pick replacement)
function goToStep2() {
  fireEvent.click(screen.getByText('Virat'));
}

describe('PlayerSubSheet — injured toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT show the Injured toggle for a non-tournament match', () => {
    renderSheet({ tournamentMatch: false });
    goToStep2();
    expect(screen.queryByText(/injury/i)).not.toBeInTheDocument();
  });

  it('shows the Injured toggle in step 2 for a tournament match', () => {
    renderSheet({ tournamentMatch: true });
    goToStep2();
    expect(screen.getByText(/Subbing out due to injury/i)).toBeInTheDocument();
  });

  it('passes { injured: false } when the toggle is left off', async () => {
    const onSwap = vi.fn().mockResolvedValue();
    renderSheet({ tournamentMatch: true, onSwap });
    goToStep2();
    fireEvent.click(screen.getByText('Replacement Guy'));
    expect(onSwap).toHaveBeenCalledWith('mp-1', 'p9', 1, { injured: false });
  });

  it('passes { injured: true } when the toggle is switched on', async () => {
    const onSwap = vi.fn().mockResolvedValue();
    renderSheet({ tournamentMatch: true, onSwap });
    goToStep2();
    fireEvent.click(screen.getByText(/Subbing out due to injury/i));
    fireEvent.click(screen.getByText('Replacement Guy'));
    expect(onSwap).toHaveBeenCalledWith('mp-1', 'p9', 1, { injured: true });
  });

  it('resets the injury toggle when going back and picking a different player', async () => {
    const onSwap = vi.fn().mockResolvedValue();
    renderSheet({ tournamentMatch: true, onSwap });
    // Pick Virat, turn injury ON, then go Back
    fireEvent.click(screen.getByText('Virat'));
    fireEvent.click(screen.getByText(/Subbing out due to injury/i));
    fireEvent.click(screen.getByText('← Back'));
    // Pick Rohit instead — toggle must be fresh (off)
    fireEvent.click(screen.getByText('Rohit'));
    fireEvent.click(screen.getByText('Replacement Guy'));
    expect(onSwap).toHaveBeenCalledWith('mp-2', 'p9', 1, { injured: false });
  });
});

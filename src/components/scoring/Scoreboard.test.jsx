import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Scoreboard from './Scoreboard';

const MATCH = { id: 'm1', total_overs: 5, team1_name: 'Super Kings', team2_name: 'Back Street Boyz' };

const regularInnings1 = {
  id: 'i1', innings_number: 1, batting_team: 1,
  total_runs: 40, total_wickets: 2, total_legal_balls: 18,
  is_super_over: false, target: null,
};

const regularInnings2 = {
  ...regularInnings1,
  id: 'i2', innings_number: 2,
  total_runs: 20, total_wickets: 1, total_legal_balls: 12,
  target: 41,
};

const soInnings1 = {
  id: 'i3', innings_number: 3, batting_team: 2,
  total_runs: 10, total_wickets: 0, total_legal_balls: 4,
  is_super_over: true, target: null,
};

const soInnings2 = {
  id: 'i4', innings_number: 4, batting_team: 1,
  total_runs: 5, total_wickets: 0, total_legal_balls: 3,
  is_super_over: true, target: 11,
};

describe('Scoreboard — regular innings', () => {
  it('renders null when innings prop is absent', () => {
    const { container } = render(<Scoreboard match={MATCH} innings={null} battingTeamName="A" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows team name and score', () => {
    render(<Scoreboard match={MATCH} innings={regularInnings1} battingTeamName="Super Kings" />);
    expect(screen.getByText('Super Kings')).toBeTruthy();
    expect(screen.getByText('40/2')).toBeTruthy();
  });

  it('shows overs out of total_overs for regular innings', () => {
    render(<Scoreboard match={MATCH} innings={regularInnings1} battingTeamName="Super Kings" />);
    expect(screen.getByText(/Overs: 3\.0\/5/)).toBeTruthy();
  });

  it('shows match number when matchNumber prop provided and not super over', () => {
    render(<Scoreboard match={MATCH} innings={regularInnings1} battingTeamName="Super Kings" matchNumber={3} />);
    expect(screen.getByText('Match 03')).toBeTruthy();
  });

  it('does NOT show ⚡ Super Over label for regular innings', () => {
    render(<Scoreboard match={MATCH} innings={regularInnings1} battingTeamName="Super Kings" />);
    expect(screen.queryByText(/super over/i)).toBeNull();
  });

  it('shows RRR row when innings 2 has a target', () => {
    render(<Scoreboard match={MATCH} innings={regularInnings2} battingTeamName="Back Street Boyz" />);
    expect(screen.getByText(/Need/)).toBeTruthy();
    expect(screen.getByText(/RRR/)).toBeTruthy();
  });

  it('does NOT show RRR for innings 1', () => {
    render(<Scoreboard match={MATCH} innings={regularInnings1} battingTeamName="Super Kings" />);
    expect(screen.queryByText(/RRR/)).toBeNull();
  });
});

describe('Scoreboard — super over innings', () => {
  it('shows ⚡ Super Over label when is_super_over=true', () => {
    render(<Scoreboard match={MATCH} innings={soInnings1} battingTeamName="Back Street Boyz" />);
    expect(screen.getByText(/Super Over/i)).toBeTruthy();
  });

  it('shows max overs as 1 for super over', () => {
    render(<Scoreboard match={MATCH} innings={soInnings1} battingTeamName="Back Street Boyz" />);
    expect(screen.getByText(/Overs: .*\/1/)).toBeTruthy();
  });

  it('does NOT show match number during super over even when matchNumber provided', () => {
    render(<Scoreboard match={MATCH} innings={soInnings1} battingTeamName="Back Street Boyz" matchNumber={5} />);
    expect(screen.queryByText(/Match 05/)).toBeNull();
  });

  it('shows RRR for super over innings with a target', () => {
    render(<Scoreboard match={MATCH} innings={soInnings2} battingTeamName="Super Kings" />);
    expect(screen.getByText(/Need/)).toBeTruthy();
    expect(screen.getByText(/RRR/)).toBeTruthy();
  });

  it('does NOT show RRR for super over first innings (no target)', () => {
    render(<Scoreboard match={MATCH} innings={soInnings1} battingTeamName="Back Street Boyz" />);
    expect(screen.queryByText(/RRR/)).toBeNull();
  });

  it('calculates balls remaining correctly — SO uses 6 ball cap not total_overs*6', () => {
    // 4 balls bowled → 2 remaining
    const { getByText } = render(<Scoreboard match={MATCH} innings={{ ...soInnings2, total_legal_balls: 4, target: 11 }} battingTeamName="Super Kings" />);
    expect(getByText(/Need \d+ off 2/)).toBeTruthy();
  });
});

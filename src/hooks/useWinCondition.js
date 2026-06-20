import { useMemo } from 'react';
import { checkWinCondition } from '../services/scoringService';

export function useWinCondition({ match, currentInnings, innings, team1Total }) {
  return useMemo(() => {
    if (!match || !currentInnings || currentInnings.innings_number !== 2) return null;
    const ballsRemaining = match.total_overs * 6 - currentInnings.total_legal_balls;
    const isAllOut = match.last_man_standing
      ? currentInnings.total_wickets >= match.team_size
      : currentInnings.total_wickets >= match.team_size - 1;
    const oversCompleted = ballsRemaining <= 0;

    // Derive team names by WHO ACTUALLY BATTED in each innings.
    // match.team1_name is NOT necessarily the team that batted first —
    // it depends on the toss. Use innings.batting_team (1 or 2) to resolve correctly.
    const inn1 = innings?.find(i => i.innings_number === 1);
    const firstBatterName  = inn1?.batting_team === 1 ? match.team1_name : match.team2_name;
    const secondBatterName = currentInnings.batting_team === 1 ? match.team1_name : match.team2_name;

    return checkWinCondition({
      inningsNumber: 2,
      team1Total: team1Total ?? inn1?.total_runs ?? 0,
      team2Total: currentInnings.total_runs,
      team1Name: firstBatterName,
      team2Name: secondBatterName,
      teamSize: match.team_size,
      wicketsFallen: currentInnings.total_wickets,
      ballsRemaining,
      isAllOut,
      oversCompleted,
    });
  }, [match, currentInnings, innings, team1Total]);
}

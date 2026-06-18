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
    return checkWinCondition({
      inningsNumber: 2,
      team1Total: team1Total ?? innings?.find(i => i.innings_number === 1)?.total_runs ?? 0,
      team2Total: currentInnings.total_runs,
      team1Name: match.team1_name,
      team2Name: match.team2_name,
      teamSize: match.team_size,
      wicketsFallen: currentInnings.total_wickets,
      ballsRemaining,
      isAllOut,
      oversCompleted,
    });
  }, [match, currentInnings, innings, team1Total]);
}

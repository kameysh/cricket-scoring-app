import { useMemo } from 'react';
import { checkWinCondition } from '../services/scoringService';

export function useWinCondition({ match, currentInnings, innings, team1Total }) {
  return useMemo(() => {
    if (!match || !currentInnings) return null;

    // Even-numbered SO innings = second innings of a SO round (innings 4, 6, 8…)
    const isSuperOver2 = currentInnings.is_super_over && currentInnings.innings_number % 2 === 0;
    const isRegularInnings2 = currentInnings.innings_number === 2 && !currentInnings.is_super_over;
    if (!isRegularInnings2 && !isSuperOver2) return null;

    // For super over: 1 over max, 2 wickets = all out
    const maxOvers = isSuperOver2 ? 1 : match.total_overs;
    const ballsRemaining = maxOvers * 6 - currentInnings.total_legal_balls;
    const isAllOut = isSuperOver2
      ? currentInnings.total_wickets >= 2
      : match.last_man_standing
        ? currentInnings.total_wickets >= match.team_size
        : currentInnings.total_wickets >= match.team_size - 1;
    const oversCompleted = ballsRemaining <= 0;

    // Derive team names by WHO ACTUALLY BATTED in each innings.
    // For SO: the paired first innings is always currentInnings.innings_number - 1
    const inn1 = innings?.find(i => isSuperOver2
      ? (i.is_super_over && i.innings_number === currentInnings.innings_number - 1)
      : i.innings_number === 1);
    const firstBatterName  = inn1?.batting_team === 1 ? match.team1_name : match.team2_name;
    const secondBatterName = currentInnings.batting_team === 1 ? match.team1_name : match.team2_name;

    const result = checkWinCondition({
      inningsNumber: 2, // checkWinCondition uses this only to gate itself; we always pass 2
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

    if (!result) return null;

    // Tag super over wins so LiveScoring can set result_type correctly
    if (isSuperOver2 && result.won && result.type !== 'tie') {
      return { ...result, type: 'super_over', summary: result.summary.replace('won by', 'won Super Over by') };
    }
    return result;
  }, [match, currentInnings, innings, team1Total]);
}

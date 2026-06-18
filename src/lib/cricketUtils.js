// ============================================================
// Cricket math & rule utilities — pure functions, no side effects
// ============================================================

export function formatOvers(legalBalls) {
  if (!legalBalls) return '0.0';
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function calcCRR(runs, legalBalls) {
  if (!legalBalls) return 0;
  return (runs / (legalBalls / 6));
}

export function calcRRR(needed, ballsRemaining) {
  if (!ballsRemaining || needed <= 0) return 0;
  return (needed / (ballsRemaining / 6));
}

export function calcNRR(matches) {
  // matches: [{ runsScored, oversFaced (in legal balls), runsConceded, oversBowled (legal balls) }]
  let runsScored = 0, ballsFaced = 0, runsConceded = 0, ballsBowled = 0;
  for (const m of matches) {
    runsScored += m.runsScored;
    ballsFaced += m.oversFaced;
    runsConceded += m.runsConceded;
    ballsBowled += m.oversBowled;
  }
  const forRate = ballsFaced ? runsScored / (ballsFaced / 6) : 0;
  const againstRate = ballsBowled ? runsConceded / (ballsBowled / 6) : 0;
  return forRate - againstRate;
}

export function calcStrikeRate(runs, balls) {
  if (!balls) return null;
  return (runs / balls) * 100;
}

export function calcBattingAverage(runs, innings, notOuts) {
  const dismissals = innings - notOuts;
  if (dismissals <= 0) return null;
  return runs / dismissals;
}

export function calcBowlingAverage(runs, wickets) {
  if (!wickets) return null;
  return runs / wickets;
}

export function calcEconomy(runs, legalBalls) {
  if (!legalBalls) return null;
  return runs / (legalBalls / 6);
}

export function calcBowlingStrikeRate(legalBalls, wickets) {
  if (!wickets) return null;
  return legalBalls / wickets;
}

export function formatBestFigures(wickets, runs) {
  return `${wickets}/${runs}`;
}

export function isMaiden(deliveriesInOver) {
  // deliveriesInOver: array of delivery rows for one bowler's over (legal balls only count)
  return deliveriesInOver.every(d => {
    const runsOffBat = d.runs_off_bat || 0;
    const extraCountsAgainstBowler = d.extra_type === 'wide' || d.extra_type === 'no_ball';
    return runsOffBat === 0 && !extraCountsAgainstBowler;
  });
}

export function detectHatTrick(lastThreeLegalBalls) {
  if (!lastThreeLegalBalls || lastThreeLegalBalls.length < 3) return false;
  const last3 = lastThreeLegalBalls.slice(-3);
  const sameBowler = last3.every(d => d.bowler_id === last3[0].bowler_id);
  const allWickets = last3.every(d => d.is_wicket && d.is_legal_delivery);
  return sameBowler && allWickets;
}

export function deriveRunType(runsOffBat) {
  switch (runsOffBat) {
    case 0: return 'dot';
    case 1: return 'one';
    case 2: return 'two';
    case 3: return 'three';
    case 4: return 'four';
    case 6: return 'six';
    case 5: return 'other';
    default: return 'other';
  }
}

/**
 * Decide whether striker/non-striker should swap ends.
 * extraType: 'none' | 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty_batting' | 'penalty_fielding'
 */
export function applyStrikerSwap(runsOffBat, extraType, extraRuns, endOfOver) {
  let swap = false;

  if (extraType === 'wide') {
    swap = false;
  } else if (extraType === 'no_ball') {
    swap = runsOffBat % 2 === 1;
  } else if (extraType === 'bye' || extraType === 'leg_bye') {
    swap = extraRuns % 2 === 1;
  } else if (extraType === 'penalty_batting' || extraType === 'penalty_fielding') {
    swap = false;
  } else {
    swap = runsOffBat % 2 === 1;
  }

  if (endOfOver) swap = !swap;
  return swap;
}

export function calcWinByWickets(teamSize, wicketsFallen) {
  return teamSize - 1 - wicketsFallen;
}

export function calcWinByRuns(team1Total, team2Total) {
  return Math.abs(team1Total - team2Total);
}

export function round(num, dp = 2) {
  if (num === null || num === undefined || Number.isNaN(num)) return null;
  return Math.round(num * 10 ** dp) / 10 ** dp;
}

export function fmt(num, dp = 2) {
  const r = round(num, dp);
  return r === null ? '—' : r.toFixed(dp);
}

export function calcMotmScore(playerId, battingCards, bowlingCards, fieldingCards) {
  let score = 0;

  for (const b of battingCards.filter(c => c.player_id === playerId)) {
    score += b.runs || 0;
    score += (b.fours || 0) * 1;
    score += (b.sixes || 0) * 2;
    if ((b.balls_faced || 0) >= 10) {
      const sr = calcStrikeRate(b.runs, b.balls_faced);
      if (sr >= 150) score += 15;
      else if (sr >= 125) score += 8;
    }
    if ((b.runs || 0) >= 100) score += 30;
    else if ((b.runs || 0) >= 50) score += 15;
    if (b.status && b.status !== 'out' && b.status !== 'retired_out') score += 5;
  }

  for (const bwl of bowlingCards.filter(c => c.player_id === playerId)) {
    score += (bwl.wickets || 0) * 25;
    score += (bwl.maidens || 0) * 6;
    if ((bwl.wickets || 0) >= 5) score += 20;
    else if ((bwl.wickets || 0) >= 3) score += 10;
    if ((bwl.legal_balls || 0) >= 12) {
      const econ = calcEconomy(bwl.runs_conceded, bwl.legal_balls);
      if (econ !== null && econ <= 6) score += 10;
      else if (econ !== null && econ <= 8) score += 5;
    }
  }

  for (const f of fieldingCards.filter(c => c.player_id === playerId)) {
    score += (f.catches || 0) * 8;
    score += (f.stumpings || 0) * 10;
    score += (f.run_outs || 0) * 8;
  }

  return score;
}

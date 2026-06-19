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

// ── Player Badges ─────────────────────────────────────────────────────────────
export function computeBadges(stats, duckHunterCount = 0, allStats = []) {
  if (!stats) return [];
  const balls = stats.bat_balls || 0;
  const sr = balls >= 20 ? (stats.bat_runs / balls) * 100 : 0;
  const maxSR = allStats
    .filter(s => (s.bat_balls || 0) >= 20)
    .reduce((best, s) => Math.max(best, (s.bat_runs / s.bat_balls) * 100), 0);
  const maxThirties = allStats.reduce((best, s) => Math.max(best, s.bat_thirties || 0), 0);

  return [
    {
      id: 'half_century', emoji: '🏏', label: 'Half-centurion',
      earned: (stats.bat_fifties || 0) > 0 || (stats.bat_hundreds || 0) > 0,
      count: (stats.bat_fifties || 0) + (stats.bat_hundreds || 0),
      hint: 'Score 50+ in an innings',
    },
    {
      id: 'century', emoji: '💯', label: 'Centurion',
      earned: (stats.bat_hundreds || 0) > 0,
      count: stats.bat_hundreds || 0,
      hint: 'Score 100+ in an innings',
    },
    {
      id: 'accumulator', emoji: '🎯', label: 'Accumulator',
      earned: (stats.bat_thirties || 0) >= 2 && maxThirties > 0 && (stats.bat_thirties || 0) === maxThirties,
      count: null,
      hint: 'Current leader in 30s (min 2)',
    },
    {
      id: 'five_fer', emoji: '🎳', label: '5-Fer',
      earned: (stats.bowl_five_wicket_hauls || 0) > 0,
      count: stats.bowl_five_wicket_hauls || 0,
      hint: 'Take 5+ wickets in an innings',
    },
    {
      id: 'hat_trick', emoji: '🎩', label: 'Hat-trick',
      earned: (stats.bowl_hat_tricks || 0) > 0,
      count: stats.bowl_hat_tricks || 0,
      hint: 'Take 3 wickets in 3 consecutive legal deliveries',
    },
    {
      id: 'duck_hunter', emoji: '🔥', label: 'Duck Hunter',
      earned: duckHunterCount >= 5,
      count: duckHunterCount,
      hint: 'Dismiss 5+ batsmen for ducks',
    },
    {
      id: 'highest_sr', emoji: '⚡', label: 'Highest SR',
      earned: sr > 0 && maxSR > 0 && Math.abs(sr - maxSR) < 0.01,
      count: null,
      hint: 'Current highest career strike rate (min 20 balls)',
    },
  ];
}

// ── Match Highlights ──────────────────────────────────────────────────────────
const WICKET_LABEL = {
  bowled: 'bowled', caught: 'caught out', lbw: 'LBW', stumped: 'stumped',
  hit_wicket: 'hit wicket', run_out: 'run out', retired_hurt: 'retired hurt', retired_out: 'retired out',
};

export function buildHighlights(deliveries, playersMap) {
  // playersMap: { [playerId]: { name, ... } }
  if (!deliveries?.length) return [];

  const name = id => playersMap?.[id]?.name || 'Unknown';
  const highlights = [];
  const batsmanRuns = new Map(); // running total per batsman this innings
  const bowlerWickets = new Map(); // running total per bowler
  const legalBalls = []; // for hat-trick detection

  // Group deliveries by over for maiden detection
  const overDeliveries = new Map(); // over_number → [deliveries]

  for (const d of deliveries) {
    const overNum = d.over_number ?? 0;
    if (!overDeliveries.has(overNum)) overDeliveries.set(overNum, []);
    overDeliveries.get(overNum).push(d);
  }

  let prevOver = -1;

  for (const d of deliveries) {
    const batsman = name(d.batsman_id);
    const bowler = name(d.bowler_id);
    const over = d.over_number ?? 0;
    const ball = d.ball_number ?? 0;
    const overLabel = `Over ${over + 1}`;

    // Maiden: check when we move to a new over
    if (over !== prevOver && prevOver >= 0) {
      const prevOverBalls = overDeliveries.get(prevOver) || [];
      const legal = prevOverBalls.filter(b => b.is_legal_delivery);
      if (legal.length > 0) {
        const isMaiden = legal.every(b => {
          const runsOffBat = b.runs_off_bat || 0;
          const extraCounts = b.extra_type === 'wide' || b.extra_type === 'no_ball';
          return runsOffBat === 0 && !extraCounts;
        });
        if (isMaiden) {
          const bowlerOfOver = name(legal[0].bowler_id);
          highlights.push({ type: 'maiden', emoji: '🛡️', over: prevOver, ball: 5, overLabel: `Over ${prevOver + 1}`, text: `MAIDEN! ${bowlerOfOver} bowls a tight over` });
        }
      }
    }
    prevOver = over;

    // Update running batsman total (wides don't count)
    if (d.extra_type !== 'wide') {
      const runs = d.runs_off_bat || 0;
      const prevRuns = batsmanRuns.get(d.batsman_id) || 0;
      batsmanRuns.set(d.batsman_id, prevRuns + runs);
    }

    // Legal balls for hat-trick
    if (d.is_legal_delivery) {
      legalBalls.push(d);
      if (detectHatTrick(legalBalls.slice(-3))) {
        highlights.push({ type: 'hattrick', emoji: '🎩', over, ball, overLabel, text: `HAT-TRICK! ${bowler} takes 3 in a row!` });
      }
    }

    // Wicket events
    if (d.is_wicket) {
      const outId = d.batsman_out_id || d.batsman_id;
      const dismissed = name(outId);
      const batsmanTotal = batsmanRuns.get(outId) ?? batsmanRuns.get(d.batsman_id) ?? 0;

      // Update bowler wicket count
      const bwid = d.bowler_id;
      const creditable = ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'];
      if (bwid && creditable.includes(d.wicket_type)) {
        bowlerWickets.set(bwid, (bowlerWickets.get(bwid) || 0) + 1);
        const totalWkts = bowlerWickets.get(bwid);
        if (totalWkts === 5) {
          highlights.push({ type: 'fivefer', emoji: '🎳', over, ball, overLabel, text: `FIVE-FER! ${bowler} takes his 5th wicket!` });
        }
      }

      if (batsmanTotal === 0 && d.wicket_type !== 'run_out') {
        highlights.push({ type: 'duck', emoji: '🦆', over, ball, overLabel, text: `DUCK! ${dismissed} dismissed for a duck by ${bowler}` });
      } else {
        const how = WICKET_LABEL[d.wicket_type] || d.wicket_type?.replace(/_/g, ' ') || 'out';
        const fielder = d.fielder_id ? name(d.fielder_id) : '';
        const suffix = ['caught', 'stumped'].includes(d.wicket_type) && fielder ? ` (${fielder})` : '';
        highlights.push({ type: 'wicket', emoji: '🎳', over, ball, overLabel, text: `OUT! ${dismissed} ${how} by ${bowler}${suffix}` });
      }
    }

    // Boundary events (only on non-wicket balls to avoid double events)
    if (!d.is_wicket) {
      const runs = d.runs_off_bat || 0;
      const batTotal = batsmanRuns.get(d.batsman_id) || 0;
      const prevTotal = batTotal - runs;

      if (runs === 6) {
        highlights.push({ type: 'six', emoji: '💥', over, ball, overLabel, text: `SIX! ${batsman} smashes ${bowler} over the boundary!` });
      } else if (runs === 4) {
        highlights.push({ type: 'four', emoji: '🏏', over, ball, overLabel, text: `FOUR! ${batsman} finds the boundary off ${bowler}` });
      }

      // Milestone checks — fired once when total crosses threshold
      if (prevTotal < 30 && batTotal >= 30 && batTotal < 50) {
        highlights.push({ type: 'thirty', emoji: '🎯', over, ball, overLabel, text: `THIRTY! ${batsman} gets to 30!` });
      }
      if (prevTotal < 50 && batTotal >= 50 && batTotal < 100) {
        highlights.push({ type: 'fifty', emoji: '⭐', over, ball, overLabel, text: `FIFTY! ${batsman} brings up a brilliant half-century!` });
      }
      if (prevTotal < 100 && batTotal >= 100) {
        highlights.push({ type: 'hundred', emoji: '💯', over, ball, overLabel, text: `CENTURY! ${batsman} scores a magnificent hundred!` });
      }
    }
  }

  // Check maiden for the last over
  const lastOver = prevOver;
  if (lastOver >= 0) {
    const lastOverBalls = overDeliveries.get(lastOver) || [];
    const legal = lastOverBalls.filter(b => b.is_legal_delivery);
    if (legal.length === 6) { // only complete overs
      const isMaiden = legal.every(b => {
        const runsOffBat = b.runs_off_bat || 0;
        const extraCounts = b.extra_type === 'wide' || b.extra_type === 'no_ball';
        return runsOffBat === 0 && !extraCounts;
      });
      if (isMaiden) {
        const bowlerOfOver = name(legal[0].bowler_id);
        highlights.push({ type: 'maiden', emoji: '🛡️', over: lastOver, ball: 5, overLabel: `Over ${lastOver + 1}`, text: `MAIDEN! ${bowlerOfOver} bowls a tight over` });
      }
    }
  }

  return highlights;
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

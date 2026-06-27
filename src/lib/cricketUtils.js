// ============================================================
// Cricket math & rule utilities — pure functions, no side effects
// ============================================================

// Returns nickname when set, otherwise full name. Safe to call with null/undefined.
export function displayName(player) {
  if (!player) return '';
  return player.nickname?.trim() || player.name || '';
}

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
  if (wickets == null || runs == null) return '—';
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
    const runs = b.runs || 0;
    const balls = b.balls_faced || 0;
    score += runs;
    score += (b.fours || 0) * 1;
    score += (b.sixes || 0) * 2;
    if (runs >= 100) score += 30;
    else if (runs >= 50) score += 15;
    else if (runs >= 30) score += 5;
    // SR bonus — min 6 balls, tuned for gully/T10 matches
    if (balls >= 6) {
      const sr = calcStrikeRate(runs, balls);
      if (sr >= 200) score += 20;
      else if (sr >= 150) score += 12;
      else if (sr >= 125) score += 6;
    }
    const isNotOut = b.status && b.status !== 'out' && b.status !== 'retired_out';
    if (isNotOut && runs >= 10) score += 5;
    if (runs === 0 && b.status === 'out') score -= 5;
  }

  for (const bwl of bowlingCards.filter(c => c.player_id === playerId)) {
    const wkts = bwl.wickets || 0;
    const legal = bwl.legal_balls || 0;
    score += wkts * 25;
    score += (bwl.maidens || 0) * 6;
    if (wkts >= 5) score += 20;
    else if (wkts >= 3) score += 10;
    // Economy bonus applies even without wickets — rewards tight bowling
    if (legal >= 6) {
      const econ = calcEconomy(bwl.runs_conceded, legal);
      if (econ !== null && econ <= 5) score += 15;
      else if (econ !== null && econ <= 6) score += 10;
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

// Tiebreaker object used by autoAssign — not displayed to users
export function calcMotmDetail(playerId, battingCards, bowlingCards) {
  let runs = 0, wickets = 0, balls = 0, runsConc = 0, legalBalls = 0;
  for (const b of battingCards.filter(c => c.player_id === playerId)) {
    runs += b.runs || 0;
    balls += b.balls_faced || 0;
  }
  for (const bwl of bowlingCards.filter(c => c.player_id === playerId)) {
    wickets += bwl.wickets || 0;
    runsConc += bwl.runs_conceded || 0;
    legalBalls += bwl.legal_balls || 0;
  }
  const sr = balls >= 6 ? (runs / balls) * 100 : 0;
  const econ = legalBalls >= 6 ? (runsConc / legalBalls) * 6 : 999;
  return { runs, wickets, sr, econ };
}

// Compare two candidates — returns true if a is strictly better than b.
// winningTeam: 1 | 2 | null — when set, winner's team players preferred on pts tie.
function motmBetter(a, b, winningTeam) {
  if (a.pts !== b.pts) return a.pts > b.pts;
  // On pts tie, prefer player from the winning team
  if (winningTeam) {
    const aWinner = a.team === winningTeam;
    const bWinner = b.team === winningTeam;
    if (aWinner !== bWinner) return aWinner;
  }
  if (a.runs !== b.runs) return a.runs > b.runs;
  if (a.wickets !== b.wickets) return a.wickets > b.wickets;
  if (Math.abs(a.sr - b.sr) > 0.01) return a.sr > b.sr;
  return a.econ < b.econ;
}

// playerTeams: Map<playerId, 1|2> — optional, used for winning-team tiebreak
export function pickMotm(playerIds, battingCards, bowlingCards, fieldingCards, playerTeams = new Map(), winningTeam = null) {
  let best = null;
  for (const pid of playerIds) {
    const pts = calcMotmScore(pid, battingCards, bowlingCards, fieldingCards);
    const { runs, wickets, sr, econ } = calcMotmDetail(pid, battingCards, bowlingCards);
    const candidate = { pid, pts, runs, wickets, sr, econ, team: playerTeams.get(pid) ?? null };
    if (!best || motmBetter(candidate, best, winningTeam)) best = candidate;
  }
  return best && best.pts > 0 ? best.pid : null;
}

// Itemised decomposition of calcMotmScore — explains how a MoTM/MoS total is built.
// Returns { total, groups: [{ title, subtotal, items: [{ label, detail, pts }] }] }.
// MUST stay in lockstep with calcMotmScore: the sum of all item pts equals calcMotmScore.
export function calcMotmBreakdown(playerId, battingCards = [], bowlingCards = [], fieldingCards = []) {
  // ── Batting aggregates ──
  let runs = 0, fours = 0, sixes = 0;
  let m30 = 0, m50 = 0, m100 = 0, srBonus = 0, notOutBonus = 0, duckPenalty = 0;
  for (const b of battingCards.filter(c => c.player_id === playerId)) {
    const r = b.runs || 0, balls = b.balls_faced || 0;
    runs += r; fours += b.fours || 0; sixes += b.sixes || 0;
    if (r >= 100) m100++; else if (r >= 50) m50++; else if (r >= 30) m30++;
    if (balls >= 6) {
      const sr = calcStrikeRate(r, balls);
      if (sr >= 200) srBonus += 20; else if (sr >= 150) srBonus += 12; else if (sr >= 125) srBonus += 6;
    }
    const isNotOut = b.status && b.status !== 'out' && b.status !== 'retired_out';
    if (isNotOut && r >= 10) notOutBonus += 5;
    if (r === 0 && b.status === 'out') duckPenalty += 5;
  }
  const batItems = [];
  if (runs)        batItems.push({ label: 'Runs',            detail: `${runs} × 1`,  pts: runs });
  if (fours)       batItems.push({ label: 'Fours',           detail: `${fours} × 1`, pts: fours });
  if (sixes)       batItems.push({ label: 'Sixes',           detail: `${sixes} × 2`, pts: sixes * 2 });
  if (m100)        batItems.push({ label: 'Centuries',       detail: `${m100} × 30`, pts: m100 * 30 });
  if (m50)         batItems.push({ label: 'Half-centuries',  detail: `${m50} × 15`,  pts: m50 * 15 });
  if (m30)         batItems.push({ label: 'Thirties',        detail: `${m30} × 5`,   pts: m30 * 5 });
  if (srBonus)     batItems.push({ label: 'Strike-rate bonus', detail: 'fast scoring', pts: srBonus });
  if (notOutBonus) batItems.push({ label: 'Not-out bonus',   detail: '10+ & unbeaten', pts: notOutBonus });
  if (duckPenalty) batItems.push({ label: 'Ducks',           detail: 'out for 0',    pts: -duckPenalty });

  // ── Bowling aggregates ──
  let wickets = 0, maidens = 0, haul3 = 0, haul5 = 0, econBonus = 0;
  for (const bwl of bowlingCards.filter(c => c.player_id === playerId)) {
    const wk = bwl.wickets || 0, legal = bwl.legal_balls || 0;
    wickets += wk; maidens += bwl.maidens || 0;
    if (wk >= 5) haul5++; else if (wk >= 3) haul3++;
    if (legal >= 6) {
      const econ = calcEconomy(bwl.runs_conceded, legal);
      if (econ !== null && econ <= 5) econBonus += 15;
      else if (econ !== null && econ <= 6) econBonus += 10;
      else if (econ !== null && econ <= 8) econBonus += 5;
    }
  }
  const bowlItems = [];
  if (wickets)   bowlItems.push({ label: 'Wickets',       detail: `${wickets} × 25`, pts: wickets * 25 });
  if (maidens)   bowlItems.push({ label: 'Maiden overs',  detail: `${maidens} × 6`,  pts: maidens * 6 });
  if (haul5)     bowlItems.push({ label: '5-wicket hauls', detail: `${haul5} × 20`,  pts: haul5 * 20 });
  if (haul3)     bowlItems.push({ label: '3-wicket hauls', detail: `${haul3} × 10`,  pts: haul3 * 10 });
  if (econBonus) bowlItems.push({ label: 'Economy bonus', detail: 'tight bowling',   pts: econBonus });

  // ── Fielding aggregates ──
  let catches = 0, stumpings = 0, runOuts = 0;
  for (const f of fieldingCards.filter(c => c.player_id === playerId)) {
    catches += f.catches || 0; stumpings += f.stumpings || 0; runOuts += f.run_outs || 0;
  }
  const fieldItems = [];
  if (catches)   fieldItems.push({ label: 'Catches',   detail: `${catches} × 8`,   pts: catches * 8 });
  if (stumpings) fieldItems.push({ label: 'Stumpings', detail: `${stumpings} × 10`, pts: stumpings * 10 });
  if (runOuts)   fieldItems.push({ label: 'Run outs',  detail: `${runOuts} × 8`,   pts: runOuts * 8 });

  const sub = items => items.reduce((s, it) => s + it.pts, 0);
  const groups = [
    { title: 'BATTING',  subtotal: sub(batItems),   items: batItems },
    { title: 'BOWLING',  subtotal: sub(bowlItems),  items: bowlItems },
    { title: 'FIELDING', subtotal: sub(fieldItems), items: fieldItems },
  ].filter(g => g.items.length > 0);

  return { total: groups.reduce((s, g) => s + g.subtotal, 0), groups };
}

// Build calcMotmScore-shaped scorecards from raw deliveries (the immutable source
// of truth). Use instead of the stored *_scorecards aggregates when those may have
// drifted from the ball-by-ball log. Returns { battingCards, bowlingCards, fieldingCards }
// with the same field names the stored rows use, so it's a drop-in replacement.
const _BOWLER_WICKET_TYPES = ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'hit_twice', 'obstructing', 'timed_out', 'handled_ball'];
export function buildScorecardsFromDeliveries(deliveries = []) {
  const bat = new Map(), bowl = new Map(), field = new Map();
  const dismissed = new Set();

  for (const d of deliveries) {
    if (d.batsman_id) {
      const b = bat.get(d.batsman_id) || { player_id: d.batsman_id, runs: 0, balls_faced: 0, fours: 0, sixes: 0, status: 'not_out', is_not_out: true };
      if (d.extra_type !== 'wide') {
        b.balls_faced += 1;
        const r = d.runs_off_bat || 0;
        b.runs += r;
        if (r === 4) b.fours += 1;
        if (r === 6) b.sixes += 1;
      }
      bat.set(d.batsman_id, b);
    }
    if (d.bowler_id) {
      const w = bowl.get(d.bowler_id) || { player_id: d.bowler_id, wickets: 0, legal_balls: 0, runs_conceded: 0, maidens: 0 };
      if (d.is_legal_delivery) w.legal_balls += 1;
      const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
      w.runs_conceded += isBye ? 0 : (d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0)));
      if (d.is_wicket && _BOWLER_WICKET_TYPES.includes(d.wicket_type)) w.wickets += 1;
      bowl.set(d.bowler_id, w);
    }
    if (d.is_wicket && d.fielder_id) {
      const f = field.get(d.fielder_id) || { player_id: d.fielder_id, catches: 0, stumpings: 0, run_outs: 0 };
      if (d.wicket_type === 'caught') f.catches += 1;
      else if (d.wicket_type === 'stumped') f.stumpings += 1;
      else if (d.wicket_type === 'run_out') f.run_outs += 1;
      field.set(d.fielder_id, f);
    }
    if (d.is_wicket) {
      const o = d.batsman_out_id || d.batsman_id;
      if (o) dismissed.add(o);
    }
  }

  // Maidens: an over (per bowler) with 0 runs conceded (byes/leg-byes don't count against the bowler)
  const overRuns = new Map();
  for (const d of deliveries) {
    if (!d.bowler_id) continue;
    const key = `${d.bowler_id}_${d.over_number}`;
    const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    overRuns.set(key, (overRuns.get(key) || 0) + (isBye ? 0 : (d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0)))));
  }
  for (const [key, runs] of overRuns) {
    if (runs === 0) {
      const bid = key.split('_')[0];
      const w = bowl.get(bid);
      if (w) w.maidens += 1;
    }
  }

  for (const pid of dismissed) {
    const b = bat.get(pid);
    if (b) { b.status = 'out'; b.is_not_out = false; }
  }

  return {
    battingCards: [...bat.values()],
    bowlingCards: [...bowl.values()],
    fieldingCards: [...field.values()],
  };
}

// ── MVP score (career/series leaderboard) ──────────────────────────────────────
// Weighted aggregate across all of a player's matches (from player_career_stats /
// player_tournament_stats rows). Distinct from calcMotmScore (per-innings impact).
export function calcMvpScore(s = {}) {
  return (
    (s.bat_runs || 0) * 0.5 +
    (s.bowl_wickets || 0) * 20 +
    (s.bat_fours || 0) * 1 +
    (s.bat_sixes || 0) * 2 +
    (s.bat_thirties || 0) * 5 +
    (s.bat_fifties || 0) * 10 +
    (s.bat_hundreds || 0) * 25 +
    (s.field_catches || 0) * 5 +
    (s.field_stumpings || 0) * 5 +
    (s.field_run_outs || 0) * 3
  );
}

// Itemised decomposition of calcMvpScore — same shape as calcMotmBreakdown.
// The sum of all item pts equals calcMvpScore (test-enforced).
export function calcMvpBreakdown(s = {}) {
  const runs = s.bat_runs || 0, fours = s.bat_fours || 0, sixes = s.bat_sixes || 0;
  const thirties = s.bat_thirties || 0, fifties = s.bat_fifties || 0, hundreds = s.bat_hundreds || 0;
  const wickets = s.bowl_wickets || 0;
  const catches = s.field_catches || 0, stumpings = s.field_stumpings || 0, runOuts = s.field_run_outs || 0;

  const batItems = [];
  if (runs)     batItems.push({ label: 'Runs',           detail: `${runs} × 0.5`,    pts: runs * 0.5 });
  if (fours)    batItems.push({ label: 'Fours',          detail: `${fours} × 1`,     pts: fours });
  if (sixes)    batItems.push({ label: 'Sixes',          detail: `${sixes} × 2`,     pts: sixes * 2 });
  if (hundreds) batItems.push({ label: 'Centuries',      detail: `${hundreds} × 25`, pts: hundreds * 25 });
  if (fifties)  batItems.push({ label: 'Half-centuries', detail: `${fifties} × 10`,  pts: fifties * 10 });
  if (thirties) batItems.push({ label: 'Thirties',       detail: `${thirties} × 5`,  pts: thirties * 5 });

  const bowlItems = [];
  if (wickets)  bowlItems.push({ label: 'Wickets',       detail: `${wickets} × 20`,  pts: wickets * 20 });

  const fieldItems = [];
  if (catches)   fieldItems.push({ label: 'Catches',    detail: `${catches} × 5`,    pts: catches * 5 });
  if (stumpings) fieldItems.push({ label: 'Stumpings',  detail: `${stumpings} × 5`,  pts: stumpings * 5 });
  if (runOuts)   fieldItems.push({ label: 'Run outs',   detail: `${runOuts} × 3`,    pts: runOuts * 3 });

  const sub = items => items.reduce((acc, it) => acc + it.pts, 0);
  const groups = [
    { title: 'BATTING',  subtotal: sub(batItems),   items: batItems },
    { title: 'BOWLING',  subtotal: sub(bowlItems),  items: bowlItems },
    { title: 'FIELDING', subtotal: sub(fieldItems), items: fieldItems },
  ].filter(g => g.items.length > 0);

  return { total: groups.reduce((acc, g) => acc + g.subtotal, 0), groups };
}

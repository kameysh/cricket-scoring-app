import { describe, it, expect } from 'vitest';
import {
  formatOvers, calcCRR, calcRRR, calcNRR,
  calcStrikeRate, calcBattingAverage, calcBowlingAverage,
  calcEconomy, calcBowlingStrikeRate,
  formatBestFigures, isMaiden, detectHatTrick,
  deriveRunType, applyStrikerSwap,
  calcWinByWickets, calcWinByRuns,
  round, fmt,
  computeBadges, calcMotmScore, calcMotmDetail, pickMotm,
} from './cricketUtils';

// ── formatOvers ────────────────────────────────────────────────────────────────

describe('formatOvers', () => {
  it('returns 0.0 for 0 balls', () => expect(formatOvers(0)).toBe('0.0'));
  it('returns 0.0 for null/undefined', () => expect(formatOvers(null)).toBe('0.0'));
  it('returns 1.0 for 6 balls (one complete over)', () => expect(formatOvers(6)).toBe('1.0'));
  it('returns 1.1 for 7 balls', () => expect(formatOvers(7)).toBe('1.1'));
  it('returns 4.1 for 25 balls', () => expect(formatOvers(25)).toBe('4.1'));
  it('returns 8.0 for 48 balls (8 overs)', () => expect(formatOvers(48)).toBe('8.0'));
});

// ── calcCRR ───────────────────────────────────────────────────────────────────

describe('calcCRR', () => {
  it('returns 0 when no balls bowled', () => expect(calcCRR(60, 0)).toBe(0));
  it('calculates correctly: 60 runs in 12 balls = 30 per over', () => expect(calcCRR(60, 12)).toBe(30));
  it('calculates correctly: 45 runs in 30 balls = 9 per over', () => expect(calcCRR(45, 30)).toBeCloseTo(9));
  it('returns 0 for 0 runs', () => expect(calcCRR(0, 12)).toBe(0));
});

// ── calcRRR ───────────────────────────────────────────────────────────────────

describe('calcRRR', () => {
  it('returns 0 when no balls remaining', () => expect(calcRRR(30, 0)).toBe(0));
  it('returns 0 when needed is 0 or negative', () => {
    expect(calcRRR(0, 12)).toBe(0);
    expect(calcRRR(-5, 12)).toBe(0);
  });
  it('calculates: 30 needed in 12 balls = 15 per over', () => expect(calcRRR(30, 12)).toBe(15));
});

// ── calcNRR ───────────────────────────────────────────────────────────────────

describe('calcNRR', () => {
  it('calculates net run rate across matches', () => {
    const matches = [
      { runsScored: 120, oversFaced: 12, runsConceded: 100, oversBowled: 12 },
    ];
    const nrr = calcNRR(matches);
    expect(nrr).toBeCloseTo(10); // 60/over for - 50/over against = +10
  });
  it('returns 0 when no balls faced or bowled', () => {
    expect(calcNRR([{ runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 }])).toBe(0);
  });
});

// ── calcStrikeRate ─────────────────────────────────────────────────────────────

describe('calcStrikeRate', () => {
  it('returns null when balls is 0', () => expect(calcStrikeRate(50, 0)).toBeNull());
  it('calculates: 50 runs in 40 balls = 125', () => expect(calcStrikeRate(50, 40)).toBe(125));
  it('calculates: 0 runs in 10 balls = 0', () => expect(calcStrikeRate(0, 10)).toBe(0));
  it('calculates: 6 runs in 1 ball = 600', () => expect(calcStrikeRate(6, 1)).toBe(600));
});

// ── calcBattingAverage ────────────────────────────────────────────────────────

describe('calcBattingAverage', () => {
  it('returns null when all innings are not-outs (no dismissals)', () =>
    expect(calcBattingAverage(100, 5, 5)).toBeNull());
  it('calculates correctly: 300 runs, 10 innings, 2 not-outs = 37.5', () =>
    expect(calcBattingAverage(300, 10, 2)).toBe(37.5));
  it('calculates correctly: 50 runs, 1 innings, 0 not-outs = 50', () =>
    expect(calcBattingAverage(50, 1, 0)).toBe(50));
});

// ── calcBowlingAverage ────────────────────────────────────────────────────────

describe('calcBowlingAverage', () => {
  it('returns null when wickets is 0', () => expect(calcBowlingAverage(30, 0)).toBeNull());
  it('calculates: 50 runs, 5 wickets = 10', () => expect(calcBowlingAverage(50, 5)).toBe(10));
});

// ── calcEconomy ───────────────────────────────────────────────────────────────

describe('calcEconomy', () => {
  it('returns null when no balls bowled', () => expect(calcEconomy(5, 0)).toBeNull());
  it('calculates: 24 runs in 12 balls (2 overs) = 12', () => expect(calcEconomy(24, 12)).toBe(12));
  it('calculates: 15 runs in 6 balls (1 over) = 15', () => expect(calcEconomy(15, 6)).toBe(15));
});

// ── calcBowlingStrikeRate ─────────────────────────────────────────────────────

describe('calcBowlingStrikeRate', () => {
  it('returns null when wickets is 0', () => expect(calcBowlingStrikeRate(12, 0)).toBeNull());
  it('calculates: 12 balls, 2 wickets = 6 balls per wicket', () =>
    expect(calcBowlingStrikeRate(12, 2)).toBe(6));
});

// ── formatBestFigures ─────────────────────────────────────────────────────────

describe('formatBestFigures', () => {
  it('formats as W/R', () => expect(formatBestFigures(3, 25)).toBe('3/25'));
  it('handles zero wickets', () => expect(formatBestFigures(0, 10)).toBe('0/10'));
});

// ── calcWinByWickets / calcWinByRuns ──────────────────────────────────────────

describe('calcWinByWickets', () => {
  it('returns teamSize - 1 - wicketsFallen', () => {
    expect(calcWinByWickets(11, 3)).toBe(7);
    expect(calcWinByWickets(6, 5)).toBe(0);
    expect(calcWinByWickets(11, 0)).toBe(10);
  });
});

describe('calcWinByRuns', () => {
  it('returns absolute difference', () => {
    expect(calcWinByRuns(100, 87)).toBe(13);
    expect(calcWinByRuns(50, 50)).toBe(0);
  });
});

// ── deriveRunType ─────────────────────────────────────────────────────────────

describe('deriveRunType', () => {
  it.each([
    [0, 'dot'], [1, 'one'], [2, 'two'], [3, 'three'],
    [4, 'four'], [5, 'other'], [6, 'six'], [7, 'other'],
  ])('maps %i → %s', (runs, type) => expect(deriveRunType(runs)).toBe(type));
});

// ── applyStrikerSwap ──────────────────────────────────────────────────────────

describe('applyStrikerSwap', () => {
  describe('normal delivery (extraType = none)', () => {
    it('swaps on odd runs', () => expect(applyStrikerSwap(1, 'none', 0, false)).toBe(true));
    it('does not swap on even runs', () => expect(applyStrikerSwap(2, 'none', 0, false)).toBe(false));
    it('does not swap on 0 runs (dot)', () => expect(applyStrikerSwap(0, 'none', 0, false)).toBe(false));
  });
  describe('wide', () => {
    it('never swaps on a wide regardless of extra runs', () => {
      expect(applyStrikerSwap(0, 'wide', 1, false)).toBe(false);
      expect(applyStrikerSwap(0, 'wide', 3, false)).toBe(false);
    });
  });
  describe('no_ball', () => {
    it('swaps when runs_off_bat is odd', () => expect(applyStrikerSwap(1, 'no_ball', 1, false)).toBe(true));
    it('does not swap when runs_off_bat is even', () => expect(applyStrikerSwap(2, 'no_ball', 1, false)).toBe(false));
  });
  describe('bye / leg_bye', () => {
    it('swaps when extraRuns is odd', () => expect(applyStrikerSwap(0, 'bye', 1, false)).toBe(true));
    it('does not swap when extraRuns is even', () => expect(applyStrikerSwap(0, 'leg_bye', 4, false)).toBe(false));
  });
  describe('penalty', () => {
    it('never swaps for penalty_batting', () => expect(applyStrikerSwap(0, 'penalty_batting', 5, false)).toBe(false));
    it('never swaps for penalty_fielding', () => expect(applyStrikerSwap(0, 'penalty_fielding', 5, false)).toBe(false));
  });
  describe('endOfOver flips the result', () => {
    it('flips: normal even (no swap) → swap on end of over', () =>
      expect(applyStrikerSwap(2, 'none', 0, true)).toBe(true));
    it('flips: normal odd (swap) → no swap on end of over', () =>
      expect(applyStrikerSwap(1, 'none', 0, true)).toBe(false));
    it('flips: wide (no swap) → swap on end of over', () =>
      expect(applyStrikerSwap(0, 'wide', 1, true)).toBe(true));
  });
});

// ── isMaiden ─────────────────────────────────────────────────────────────────

describe('isMaiden', () => {
  const dot = { runs_off_bat: 0, extra_type: 'none' };
  const runScored = { runs_off_bat: 1, extra_type: 'none' };
  const wide = { runs_off_bat: 0, extra_type: 'wide' };
  const noBall = { runs_off_bat: 0, extra_type: 'no_ball' };
  const bye = { runs_off_bat: 0, extra_type: 'bye' };

  it('all dot balls → maiden', () => expect(isMaiden([dot, dot, dot, dot, dot, dot])).toBe(true));
  it('any run off bat → not maiden', () => expect(isMaiden([dot, dot, runScored, dot, dot, dot])).toBe(false));
  it('wide in over → not maiden (counts against bowler)', () =>
    expect(isMaiden([dot, dot, dot, dot, dot, wide])).toBe(false));
  it('no-ball in over → not maiden', () =>
    expect(isMaiden([dot, dot, dot, dot, dot, noBall])).toBe(false));
  it('bye (0 runs off bat) → maiden (bye does not count against bowler)', () =>
    expect(isMaiden([dot, dot, dot, dot, dot, bye])).toBe(true));
});

// ── detectHatTrick ────────────────────────────────────────────────────────────

describe('detectHatTrick', () => {
  const wicket = (bowlerId) => ({ bowler_id: bowlerId, is_wicket: true, is_legal_delivery: true });
  const notWicket = (bowlerId) => ({ bowler_id: bowlerId, is_wicket: false, is_legal_delivery: true });

  it('returns false for empty/null array', () => {
    expect(detectHatTrick([])).toBe(false);
    expect(detectHatTrick(null)).toBe(false);
    expect(detectHatTrick(undefined)).toBe(false);
  });
  it('returns false for fewer than 3 balls', () =>
    expect(detectHatTrick([wicket('b1'), wicket('b1')])).toBe(false));
  it('returns true for 3 wickets by same bowler', () =>
    expect(detectHatTrick([wicket('b1'), wicket('b1'), wicket('b1')])).toBe(true));
  it('returns false when different bowler on one delivery', () =>
    expect(detectHatTrick([wicket('b1'), wicket('b2'), wicket('b1')])).toBe(false));
  it('returns false when one ball is not a wicket', () =>
    expect(detectHatTrick([wicket('b1'), notWicket('b1'), wicket('b1')])).toBe(false));
  it('uses last 3 of a longer array', () => {
    const balls = [wicket('b2'), wicket('b1'), wicket('b1'), wicket('b1')];
    expect(detectHatTrick(balls)).toBe(true);
  });
});

// ── round / fmt ───────────────────────────────────────────────────────────────

describe('round', () => {
  it('rounds to specified decimal places', () => {
    expect(round(1.555, 2)).toBe(1.56);
    expect(round(3.14159, 2)).toBe(3.14);
  });
  it('returns null for null/undefined/NaN', () => {
    expect(round(null)).toBeNull();
    expect(round(undefined)).toBeNull();
    expect(round(NaN)).toBeNull();
  });
  it('defaults to 2 dp', () => expect(round(1.2345)).toBe(1.23));
});

describe('fmt', () => {
  it('returns "—" for null', () => expect(fmt(null)).toBe('—'));
  it('returns "—" for undefined', () => expect(fmt(undefined)).toBe('—'));
  it('formats number with default 2dp', () => expect(fmt(125)).toBe('125.00'));
  it('formats number with 1dp', () => expect(fmt(125, 1)).toBe('125.0'));
  it('formats 0', () => expect(fmt(0, 1)).toBe('0.0'));
});

// ── computeBadges ─────────────────────────────────────────────────────────────

describe('computeBadges', () => {
  it('returns empty array for null stats', () => expect(computeBadges(null)).toEqual([]));

  it('half_century: earned when bat_fifties > 0', () => {
    const badges = computeBadges({ bat_fifties: 1, bat_hundreds: 0, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'half_century').earned).toBe(true);
  });

  it('half_century: earned when bat_hundreds > 0 (century implies fifty)', () => {
    const badges = computeBadges({ bat_fifties: 0, bat_hundreds: 1, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'half_century').earned).toBe(true);
  });

  it('half_century: not earned when both are 0', () => {
    const badges = computeBadges({ bat_fifties: 0, bat_hundreds: 0, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'half_century').earned).toBe(false);
  });

  it('century: earned when bat_hundreds > 0', () => {
    const badges = computeBadges({ bat_hundreds: 1, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'century').earned).toBe(true);
  });

  it('century: not earned when bat_hundreds is 0', () => {
    const badges = computeBadges({ bat_hundreds: 0, bat_fifties: 2, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'century').earned).toBe(false);
  });

  it('five_fer: earned when bowl_five_wicket_hauls > 0', () => {
    const badges = computeBadges({ bowl_five_wicket_hauls: 1, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'five_fer').earned).toBe(true);
  });

  it('hat_trick: earned when bowl_hat_tricks > 0', () => {
    const badges = computeBadges({ bowl_hat_tricks: 2, bat_balls: 0 }, 0, []);
    expect(badges.find(b => b.id === 'hat_trick').earned).toBe(true);
  });

  it('duck_hunter: NOT earned at 4 ducks dismissed', () => {
    const badges = computeBadges({ bat_balls: 0 }, 4, []);
    expect(badges.find(b => b.id === 'duck_hunter').earned).toBe(false);
  });

  it('duck_hunter: earned at 5 ducks dismissed', () => {
    const badges = computeBadges({ bat_balls: 0 }, 5, []);
    expect(badges.find(b => b.id === 'duck_hunter').earned).toBe(true);
  });

  describe('accumulator badge', () => {
    it('earned when player has most 30s (min 2) and is the leader', () => {
      const stats = { bat_thirties: 3, bat_balls: 30, bat_runs: 90 };
      const allStats = [
        stats,
        { bat_thirties: 2, bat_balls: 20, bat_runs: 60 },
      ];
      expect(computeBadges(stats, 0, allStats).find(b => b.id === 'accumulator').earned).toBe(true);
    });

    it('NOT earned when another player has more 30s', () => {
      const stats = { bat_thirties: 2, bat_balls: 20, bat_runs: 60 };
      const allStats = [
        { bat_thirties: 3, bat_balls: 30, bat_runs: 90 },
        stats,
      ];
      expect(computeBadges(stats, 0, allStats).find(b => b.id === 'accumulator').earned).toBe(false);
    });

    it('NOT earned when bat_thirties is 1 (min 2 required)', () => {
      const stats = { bat_thirties: 1, bat_balls: 20, bat_runs: 30 };
      const allStats = [stats];
      expect(computeBadges(stats, 0, allStats).find(b => b.id === 'accumulator').earned).toBe(false);
    });
  });

  describe('highest_sr badge', () => {
    it('earned when player has the highest SR with 20+ balls', () => {
      const stats = { bat_runs: 150, bat_balls: 60 }; // SR = 250
      const allStats = [
        stats,
        { bat_runs: 80, bat_balls: 50 }, // SR = 160
      ];
      expect(computeBadges(stats, 0, allStats).find(b => b.id === 'highest_sr').earned).toBe(true);
    });

    it('NOT earned when another player has higher SR', () => {
      const stats = { bat_runs: 80, bat_balls: 50 }; // SR = 160
      const allStats = [
        { bat_runs: 150, bat_balls: 60 }, // SR = 250
        stats,
      ];
      expect(computeBadges(stats, 0, allStats).find(b => b.id === 'highest_sr').earned).toBe(false);
    });

    it('NOT counted for highest SR when balls < 20', () => {
      const stats = { bat_runs: 50, bat_balls: 5 }; // SR = 1000 but < 20 balls
      const other = { bat_runs: 100, bat_balls: 50 }; // SR = 200 with 50 balls
      const allStats = [stats, other];
      // stats player has <20 balls so their SR is excluded from maxSR but also their own sr=0
      expect(computeBadges(stats, 0, allStats).find(b => b.id === 'highest_sr').earned).toBe(false);
    });
  });
});

// ── calcMotmScore ─────────────────────────────────────────────────────────────

describe('calcMotmScore', () => {
  const pid = 'p1';

  it('scores runs + boundary bonuses + milestone + SR bonus + not-out bonus', () => {
    const battingCards = [{
      player_id: pid, runs: 50, balls_faced: 30,
      fours: 1, sixes: 1, status: 'not_out',
    }];
    const score = calcMotmScore(pid, battingCards, [], []);
    // 50 runs + 1 four + 2 six + 15 (50 milestone) + 12 (SR≥150, 30 balls) + 5 (not-out ≥10)
    expect(score).toBe(85);
  });

  it('applies duck penalty (-5) when out for 0', () => {
    const battingCards = [{ player_id: pid, runs: 0, balls_faced: 3, fours: 0, sixes: 0, status: 'out' }];
    expect(calcMotmScore(pid, battingCards, [], [])).toBe(-5);
  });

  it('does NOT apply not-out bonus when runs < 10', () => {
    const battingCards = [{ player_id: pid, runs: 5, balls_faced: 4, fours: 0, sixes: 0, status: 'not_out' }];
    expect(calcMotmScore(pid, battingCards, [], [])).toBe(5); // just 5 runs, no bonus
  });

  it('scores bowling: wickets + 3-fer bonus + economy bonus', () => {
    const bowlingCards = [{
      player_id: pid, wickets: 3, legal_balls: 12,
      runs_conceded: 9, maidens: 0, // econ = 4.5 (≤5 → +15)
    }];
    const score = calcMotmScore(pid, [], bowlingCards, []);
    // 3×25 + 10 (3-fer) + 15 (econ ≤5) = 100
    expect(score).toBe(100);
  });

  it('scores 5-fer bonus (20 pts) for 5 wickets', () => {
    const bowlingCards = [{ player_id: pid, wickets: 5, legal_balls: 6, runs_conceded: 20, maidens: 0 }];
    const score = calcMotmScore(pid, [], bowlingCards, []);
    // 5×25 + 20 (5-fer) + econ bonus (20/6*6=20 per over, >8 no bonus)
    expect(score).toBe(145); // 125 + 20
  });

  it('scores maiden overs (+6 each)', () => {
    const bowlingCards = [{ player_id: pid, wickets: 0, legal_balls: 6, runs_conceded: 0, maidens: 2 }];
    const score = calcMotmScore(pid, [], bowlingCards, []);
    // 0 wickets + 2×6 maidens + 15 (econ=0 ≤5)
    expect(score).toBe(27);
  });

  it('scores fielding: catches, stumpings, run-outs', () => {
    const fieldingCards = [{ player_id: pid, catches: 2, stumpings: 1, run_outs: 1 }];
    const score = calcMotmScore(pid, [], [], fieldingCards);
    // 2×8 + 1×10 + 1×8 = 16 + 10 + 8 = 34
    expect(score).toBe(34);
  });

  it('returns 0 for a player with no contributions', () => {
    expect(calcMotmScore(pid, [], [], [])).toBe(0);
  });

  it('scores century milestone (+30)', () => {
    const battingCards = [{ player_id: pid, runs: 100, balls_faced: 80, fours: 5, sixes: 2, status: 'not_out' }];
    const score = calcMotmScore(pid, battingCards, [], []);
    // 100 + 5×1 + 2×2 + 30(century) + 6(SR≥125) + 5(not-out) = 150
    expect(score).toBe(150);
  });
});

// ── pickMotm ──────────────────────────────────────────────────────────────────

describe('pickMotm', () => {
  const bat = (pid, runs, balls = 20, status = 'not_out') => ({ player_id: pid, runs, balls_faced: balls, fours: 0, sixes: 0, status });
  const bowl = (pid, wkts, legal = 12, runs = 30) => ({ player_id: pid, wickets: wkts, legal_balls: legal, runs_conceded: runs, maidens: 0 });

  it('returns null when all players score 0', () => {
    expect(pickMotm(['p1', 'p2'], [], [], [])).toBeNull();
  });

  it('returns the single best scorer', () => {
    expect(pickMotm(['p1', 'p2'], [bat('p1', 50, 30)], [], [])).toBe('p1');
  });

  it('on pts tie, prefers winning team player', () => {
    const batting = [bat('p1', 30, 20), bat('p2', 30, 20)];
    const teams = new Map([['p1', 1], ['p2', 2]]);
    expect(pickMotm(['p1', 'p2'], batting, [], [], teams, 2)).toBe('p2');
  });

  it('on pts + team tie, prefers higher runs', () => {
    const batting = [bat('p1', 25, 20), bat('p2', 30, 25)]; // different pts so this tests different scenario
    // Give same pts by making p1 have exactly same score as p2
    const b1 = [{ player_id: 'p1', runs: 30, balls_faced: 20, fours: 2, sixes: 0, status: 'out' }]; // 30+2+0+5=37
    const b2 = [{ player_id: 'p2', runs: 31, balls_faced: 20, fours: 1, sixes: 0, status: 'out' }]; // 31+1+0+5=37
    expect(pickMotm(['p1', 'p2'], [...b1, ...b2], [], [])).toBe('p2'); // p2 has more runs on tie
  });

  it('returns null when playerIds is empty', () => {
    expect(pickMotm([], [bat('p1', 50)], [], [])).toBeNull();
  });

  it('works with a single player', () => {
    expect(pickMotm(['p1'], [bat('p1', 10, 8)], [], [])).toBe('p1');
  });
});

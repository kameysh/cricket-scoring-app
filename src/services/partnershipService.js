import { supabase } from '../lib/supabase';

/**
 * Compute partnerships from a sorted deliveries array for one innings.
 * Returns array of { batsman1Id, batsman2Id, runs, balls, broken } sorted by runs desc.
 */
export function computePartnerships(deliveries) {
  const partnerships = [];
  let currentRuns = 0;
  let currentBalls = 0;
  let pair = new Set(); // the two batsmen currently at the crease

  for (const d of deliveries) {
    const b1 = d.batsman_id;
    const b2 = d.non_striker_before ?? d.striker_after ?? null; // partner this ball

    // Add both batsmen on every ball. After a wicket the pair holds only the
    // survivor; this is how the *incoming* batsman gets recorded (previously the
    // new partner was never captured → "Unrecorded" on every post-wicket stand).
    if (b1) pair.add(b1);
    if (b2) pair.add(b2);

    const runsThisBall = d.total_runs_on_delivery ?? 0;
    const isWide = d.extra_type === 'wide';
    if (!isWide) currentBalls += 1;
    currentRuns += runsThisBall;

    if (d.is_wicket) {
      // Record this partnership
      if (pair.size > 0) {
        const [p1, p2] = Array.from(pair);
        partnerships.push({ batsman1Id: p1, batsman2Id: p2 || null, runs: currentRuns, balls: currentBalls, broken: true });
      }
      // Start new partnership: the survivor stays; the incoming batsman is added
      // on the next delivery via the b1/b2 accumulation above.
      const outId = d.batsman_out_id || d.batsman_id;
      const survivor = b1 === outId ? (d.non_striker_before || null) : b1;
      pair = survivor ? new Set([survivor]) : new Set();
      currentRuns = 0;
      currentBalls = 0;
    }
  }

  // Unbroken partnership at end
  if (pair.size > 0 && (currentRuns > 0 || currentBalls > 0)) {
    const [p1, p2] = Array.from(pair);
    partnerships.push({ batsman1Id: p1, batsman2Id: p2 || null, runs: currentRuns, balls: currentBalls, broken: false });
  }

  return partnerships.sort((a, b) => b.runs - a.runs);
}

/**
 * Fetch top partnerships across all completed matches.
 * Returns top `limit` partnerships enriched with player names and match info.
 */
export async function getTopPartnerships(limit = 10) {
  // Fetch all deliveries with player joins and innings/match context
  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select(`
      innings_id, over_number, ball_number,
      batsman_id, non_striker_before, striker_after,
      is_wicket, batsman_out_id,
      total_runs_on_delivery, extra_type,
      innings!inner(id, innings_number, match_id,
        matches!inner(id, team1_name, team2_name, status)
      )
    `)
    .eq('innings.matches.status', 'completed')
    .order('innings_id')
    .order('over_number')
    .order('ball_number');

  if (error) throw error;

  // Fetch player names map
  const { data: players } = await supabase.from('players').select('id, name, nickname, photo_url');
  const playerMap = Object.fromEntries((players || []).map(p => [p.id, p]));

  // Group deliveries by innings
  const byInnings = new Map();
  for (const d of deliveries || []) {
    const iid = d.innings_id;
    if (!byInnings.has(iid)) byInnings.set(iid, { deliveries: [], meta: d.innings });
    byInnings.get(iid).deliveries.push(d);
  }

  const all = [];
  for (const [, { deliveries: inDels, meta }] of byInnings) {
    const parts = computePartnerships(inDels);
    for (const p of parts) {
      all.push({
        ...p,
        matchId: meta.match_id,
        inningsNumber: meta.innings_number,
        team1: meta.matches.team1_name,
        team2: meta.matches.team2_name,
        player1: playerMap[p.batsman1Id] || null,
        player2: playerMap[p.batsman2Id] || null,
      });
    }
  }

  return all.sort((a, b) => b.runs - a.runs).slice(0, limit);
}

import { useState, useMemo } from 'react';
import PlayerLink from '../player/PlayerLink';
import { calcStrikeRate, calcEconomy, formatOvers, fmt } from '../../lib/cricketUtils';

function dismissalText(b) {
  if (!b) return '';
  if (b.status === 'not_out') return 'not out';
  if (b.status === 'retired_hurt') return 'retired hurt';
  if (b.status === 'retired_out') return 'retired out';
  if (b.status === 'out') {
    switch (b.dismissal_type) {
      case 'bowled': return `b ${b.bowler_name || b.players?.name || ''}`.trim();
      case 'caught': return `c ${b.fielder_name || ''} b ${b.bowler_name || ''}`.trim();
      case 'lbw': return `lbw b ${b.bowler_name || ''}`.trim();
      case 'run_out': return `run out (${b.fielder_name || ''})`.trim();
      case 'stumped': return `st ${b.fielder_name || ''} b ${b.bowler_name || ''}`.trim();
      case 'hit_wicket': return `hit wkt b ${b.bowler_name || ''}`.trim();
      default: return b.dismissal_type?.replace(/_/g, ' ') || 'out';
    }
  }
  return '';
}

function dismissalFromDeliveries(deliveries, pid, allPlayers) {
  const wkt = deliveries.find(
    d => d.is_wicket && (d.batsman_out_id === pid || (!d.batsman_out_id && d.batsman_id === pid))
  );
  if (!wkt) return null;
  const playerName = id => allPlayers.find(p => p.id === id)?.name
    || wkt.bowler?.name || wkt.fielder?.name || '';
  const bowlerName = playerName(wkt.bowler_id);
  const fielderName = playerName(wkt.fielder_id);
  switch (wkt.wicket_type) {
    case 'bowled': return `b ${bowlerName}`.trim();
    case 'caught': return `c ${fielderName} b ${bowlerName}`.trim();
    case 'lbw': return `lbw b ${bowlerName}`.trim();
    case 'run_out': return `run out${fielderName ? ` (${fielderName})` : ''}`;
    case 'stumped': return `st ${fielderName} b ${bowlerName}`.trim();
    case 'hit_wicket': return `hit wkt b ${bowlerName}`.trim();
    case 'retired_hurt': return 'retired hurt';
    case 'retired_out': return 'retired out';
    default: return wkt.wicket_type?.replace(/_/g, ' ') || 'out';
  }
}

export default function LiveScorecardPanel({
  battingTeamPlayers = [],
  bowlingTeamPlayers = [],
  battingScorecards,
  bowlingScorecards,
  striker,
  nonStriker,
  bowler,
  currentInnings,
  deliveries = [],
}) {
  const [tab, setTab] = useState('bat');
  const allPlayers = [...battingTeamPlayers, ...bowlingTeamPlayers];

  // Compute live batting stats directly from deliveries (more reliable than DB scorecards mid-innings)
  const liveBattingStats = useMemo(() => {
    const map = new Map();
    for (const d of deliveries) {
      const pid = d.batsman_id;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, { runs: 0, balls: 0, fours: 0, sixes: 0 });
      const s = map.get(pid);
      if (d.extra_type !== 'wide') s.balls += 1;
      const r = d.runs_off_bat || 0;
      s.runs += r;
      if (r === 4) s.fours += 1;
      if (r === 6) s.sixes += 1;
    }
    return map;
  }, [deliveries]);

  // Compute live bowling stats from deliveries
  const liveBowlingStats = useMemo(() => {
    const map = new Map();
    for (const d of deliveries) {
      const pid = d.bowler_id;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, { legal_balls: 0, runs: 0, wickets: 0 });
      const s = map.get(pid);
      if (d.is_legal_delivery) s.legal_balls += 1;
      const isByeOrLB = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
      const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
      s.runs += isByeOrLB ? 0 : total;
      if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type)) {
        s.wickets += 1;
      }
    }
    return map;
  }, [deliveries]);

  // Ordered batting rows: active → batted (from scorecards order) → yet to bat
  const activePids = [striker, nonStriker].filter(Boolean);
  const battedIds = new Set([
    ...battingScorecards.map(b => b.player_id),
    ...Array.from(liveBattingStats.keys()),
  ]);
  const yetToBat = battingTeamPlayers.filter(p => !battedIds.has(p.id) && !activePids.includes(p.id));

  const seenPids = new Set();
  const battingRows = [];
  for (const pid of activePids) {
    if (seenPids.has(pid)) continue;
    seenPids.add(pid);
    const sc = battingScorecards.find(b => b.player_id === pid);
    const pl = battingTeamPlayers.find(p => p.id === pid);
    if (pl) battingRows.push({ sc, pl, pid, active: true });
  }
  const dismissedScs = battingScorecards.filter(b => !activePids.includes(b.player_id));
  for (const sc of dismissedScs) {
    if (seenPids.has(sc.player_id)) continue;
    seenPids.add(sc.player_id);
    const pl = battingTeamPlayers.find(p => p.id === sc.player_id);
    battingRows.push({ sc, pl, pid: sc.player_id, active: false });
  }
  for (const [pid] of liveBattingStats) {
    if (seenPids.has(pid)) continue;
    seenPids.add(pid);
    if (activePids.includes(pid)) continue;
    const pl = battingTeamPlayers.find(p => p.id === pid);
    if (pl) battingRows.push({ sc: null, pl, pid, active: false });
  }

  // Extras from deliveries
  const extras = deliveries.reduce(
    (acc, d) => {
      if (d.extra_type === 'wide') acc.wides += d.extra_runs || 0;
      else if (d.extra_type === 'no_ball') acc.no_balls += d.extra_runs || 0;
      else if (d.extra_type === 'bye') acc.byes += d.extra_runs || 0;
      else if (d.extra_type === 'leg_bye') acc.leg_byes += d.extra_runs || 0;
      else if (d.extra_type === 'penalty_batting' || d.extra_type === 'penalty_fielding') acc.penalty += d.extra_runs || 0;
      return acc;
    },
    { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, penalty: 0 }
  );
  const totalExtras = extras.wides + extras.no_balls + extras.byes + extras.leg_byes + extras.penalty;
  const extrasBreakdown = [
    extras.no_balls > 0 ? `NB ${extras.no_balls}` : null,
    extras.wides > 0 ? `W ${extras.wides}` : null,
    extras.byes > 0 ? `B ${extras.byes}` : null,
    extras.leg_byes > 0 ? `LB ${extras.leg_byes}` : null,
    extras.penalty > 0 ? `Pen ${extras.penalty}` : null,
  ].filter(Boolean).join(', ');

  // Fall of wickets
  const fowEntries = [];
  let runningTotal = 0;
  let wicketCount = 0;
  for (const d of deliveries) {
    const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
    runningTotal += total;
    if (d.is_wicket) {
      wicketCount++;
      const dismissedPid = d.batsman_out_id || d.batsman_id;
      const pl = battingTeamPlayers.find(p => p.id === dismissedPid);
      const lastName = pl ? pl.name.split(' ').pop() : '?';
      fowEntries.push(`${runningTotal}/${wicketCount} (${lastName}, ${d.over_number}.${d.ball_number} ov)`);
    }
  }

  const totalRuns = currentInnings?.total_runs ?? 0;
  const totalWickets = currentInnings?.total_wickets ?? 0;
  const totalLegalBalls = currentInnings?.total_legal_balls ?? 0;
  const oversStr = formatOvers(totalLegalBalls);

  // All bowlers seen in deliveries (for ordering) + those in bowlingScorecards
  const allBowlerIds = Array.from(new Set([
    ...deliveries.map(d => d.bowler_id).filter(Boolean),
    ...bowlingScorecards.map(b => b.player_id),
  ]));

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b border-ink-100 dark:border-white/10">
        {[['bat', 'Batting'], ['bowl', 'Bowling']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === key
                ? 'text-ink-900 dark:text-white border-b-2 border-ink-900 dark:border-white -mb-px'
                : 'text-ink-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bat' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-400 border-b border-ink-100 dark:border-white/10">
                <th className="py-2 pl-3 pr-2 font-medium text-left">Batter</th>
                <th className="py-2 px-2 font-medium text-right">R</th>
                <th className="py-2 px-2 font-medium text-right">B</th>
                <th className="py-2 px-2 font-medium text-right">4s</th>
                <th className="py-2 px-2 font-medium text-right">6s</th>
                <th className="py-2 px-2 pr-3 font-medium text-right">SR</th>
              </tr>
            </thead>
            <tbody>
              {battingRows.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-ink-400">No batsmen yet</td></tr>
              )}
              {battingRows.map(({ sc, pl, pid, active }, i) => {
                const live = liveBattingStats.get(pid);
                const runs = live?.runs ?? sc?.runs ?? 0;
                const balls = live?.balls ?? sc?.balls_faced ?? 0;
                const fours = live?.fours ?? sc?.fours ?? 0;
                const sixes = live?.sixes ?? sc?.sixes ?? 0;
                const howOut = active
                  ? 'batting'
                  : (dismissalFromDeliveries(deliveries, pid, allPlayers) || (sc ? dismissalText(sc) : 'not out'));
                return (
                  <tr key={`bat-${i}`} className="border-b border-ink-50 dark:border-white/[0.05]">
                    <td className="py-2 pl-3 pr-2">
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] leading-none flex-shrink-0 ${active && pid === striker ? 'text-brand-green' : 'text-transparent'}`}>●</span>
                        <PlayerLink
                          id={pid}
                          name={pl?.name || sc?.players?.name || ''}
                          liveScoring
                          className={active ? 'font-bold text-ink-900 dark:text-white' : 'text-ink-700 dark:text-ink-200'}
                        />
                      </div>
                      <div className={`text-[10px] leading-tight pl-3 ${active ? 'text-brand-green dark:text-cricket-gold' : 'text-ink-400'}`}>
                        {howOut}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-bold tabular-nums">{runs}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{balls}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{fours}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{sixes}</td>
                    <td className="py-2 px-2 pr-3 text-right tabular-nums text-ink-500">
                      {balls > 0 ? fmt(calcStrikeRate(runs, balls), 2) : '-'}
                    </td>
                  </tr>
                );
              })}

              {/* Extras */}
              {deliveries.length > 0 && (
                <tr className="border-b border-ink-50 dark:border-white/[0.05]">
                  <td className="py-2 pl-5 pr-2 text-ink-500" colSpan={5}>
                    Extras{extrasBreakdown ? <span className="text-ink-400 ml-1">({extrasBreakdown})</span> : ''}
                  </td>
                  <td className="py-2 px-2 pr-3 text-right font-semibold tabular-nums">{totalExtras}</td>
                </tr>
              )}

              {/* Total */}
              {deliveries.length > 0 && (
                <tr className="font-semibold">
                  <td className="py-2 pl-5 pr-2 text-ink-700 dark:text-ink-200" colSpan={2}>Total</td>
                  <td className="py-2 px-2 pr-3 text-right tabular-nums text-ink-700 dark:text-ink-200" colSpan={4}>
                    {totalRuns} ({totalWickets} wkts, {oversStr} ov)
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Yet to bat */}
          {yetToBat.length > 0 && (
            <div className="px-3 py-2 border-t border-ink-50 dark:border-white/[0.05]">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mr-2">Yet to bat</span>
              <span className="text-xs text-ink-400">
                {yetToBat.map((p, i) => (
                  <span key={p.id}>
                    <PlayerLink id={p.id} name={p.name} liveScoring className="text-ink-400" />
                    {i < yetToBat.length - 1 && <span> · </span>}
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Fall of wickets */}
          {fowEntries.length > 0 && (
            <div className="px-3 py-2 border-t border-ink-50 dark:border-white/[0.05]">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Fall of wickets</div>
              <div className="text-[11px] text-ink-400 leading-relaxed">{fowEntries.join(' · ')}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'bowl' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-400 border-b border-ink-100 dark:border-white/10">
                <th className="py-2 pl-3 pr-2 font-medium text-left">Bowler</th>
                <th className="py-2 px-2 font-medium text-right">O</th>
                <th className="py-2 px-2 font-medium text-right">M</th>
                <th className="py-2 px-2 font-medium text-right">R</th>
                <th className="py-2 px-2 font-medium text-right">W</th>
                <th className="py-2 px-2 pr-3 font-medium text-right">Econ</th>
              </tr>
            </thead>
            <tbody>
              {allBowlerIds.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-ink-400">No bowlers yet</td></tr>
              )}
              {allBowlerIds.map((pid, i) => {
                const p = bowlingTeamPlayers.find(x => x.id === pid);
                const sc = bowlingScorecards.find(b => b.player_id === pid);
                const live = liveBowlingStats.get(pid);
                const isCurrent = pid === bowler;
                const legalBalls = live?.legal_balls ?? sc?.legal_balls ?? 0;
                const runsConceded = live?.runs ?? sc?.runs_conceded ?? 0;
                const wickets = live?.wickets ?? sc?.wickets ?? 0;
                const maidens = sc?.maidens ?? 0;
                return (
                  <tr key={`bowl-${i}`} className="border-b border-ink-50 dark:border-white/[0.05]">
                    <td className="py-2 pl-3 pr-2">
                      <PlayerLink
                        id={pid}
                        name={p?.name || sc?.players?.name || ''}
                        liveScoring
                        className={isCurrent ? 'font-bold text-ink-900 dark:text-white' : 'text-ink-700 dark:text-ink-200'}
                      />
                      {isCurrent && <div className="text-[10px] text-brand-green dark:text-cricket-gold">bowling</div>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatOvers(legalBalls)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{maidens}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{runsConceded}</td>
                    <td className="py-2 px-2 text-right font-bold tabular-nums">{wickets}</td>
                    <td className="py-2 px-2 pr-3 text-right tabular-nums text-ink-500">
                      {legalBalls > 0 ? fmt(calcEconomy(runsConceded, legalBalls), 2) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

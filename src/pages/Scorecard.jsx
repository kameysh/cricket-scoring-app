import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as matchService from '../services/matchService';
import PlayerLink from '../components/player/PlayerLink';
import { calcStrikeRate, calcEconomy, formatOvers, fmt } from '../lib/cricketUtils';
import MomentumGraph from '../components/match/MomentumGraph';
import HighlightsFeed from '../components/match/HighlightsFeed';
import OverByOverTable from '../components/match/OverByOverTable';
import BatterSRChart from '../components/player/BatterSRChart';
import BottomSheet from '../components/shared/BottomSheet';

function buildStatsFromDeliveries(deliveries) {
  // Batting: ordered by first appearance
  const batOrder = [];
  const batMap = new Map();
  for (const d of deliveries) {
    const pid = d.batsman_id;
    if (!pid) continue;
    if (!batMap.has(pid)) {
      batOrder.push(pid);
      batMap.set(pid, { name: d.batsman?.name || pid, runs: 0, balls: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, dots: 0 });
    }
    const s = batMap.get(pid);
    if (d.extra_type !== 'wide') {
      s.balls += 1;
      const r = d.runs_off_bat || 0;
      s.runs += r;
      if (r === 0) s.dots += 1;
      if (r === 1) s.ones += 1;
      if (r === 2) s.twos += 1;
      if (r === 3) s.threes += 1;
      if (r === 4) s.fours += 1;
      if (r === 6) s.sixes += 1;
    }
  }

  // Dismissal info per batsman
  const dismissalMap = new Map();
  for (const d of deliveries) {
    if (!d.is_wicket) continue;
    const outId = d.batsman_out_id || d.batsman_id;
    if (!outId || dismissalMap.has(outId)) continue;
    dismissalMap.set(outId, {
      type: d.wicket_type,
      bowlerName: d.bowler?.name || '',
      fielderName: d.fielder?.name || '',
      bowlerId: d.bowler_id,
      fielderId: d.fielder_id,
    });
  }

  // Bowling: ordered by first appearance
  const bowlOrder = [];
  const bowlMap = new Map();
  for (const d of deliveries) {
    const pid = d.bowler_id;
    if (!pid) continue;
    if (!bowlMap.has(pid)) {
      bowlOrder.push(pid);
      bowlMap.set(pid, { name: d.bowler?.name || pid, legal_balls: 0, runs: 0, wickets: 0, wides: 0, no_balls: 0, maiden_overs: new Set() });
    }
    const s = bowlMap.get(pid);
    if (d.is_legal_delivery) s.legal_balls += 1;
    const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
    s.runs += isBye ? 0 : total;
    if (d.extra_type === 'wide') s.wides += d.extra_runs || 1;
    if (d.extra_type === 'no_ball') s.no_balls += 1;
    if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'hit_twice', 'obstructing', 'timed_out', 'handled_ball'].includes(d.wicket_type)) {
      s.wickets += 1;
    }
  }

  // Compute maidens per bowler per over
  const overRuns = new Map();
  for (const d of deliveries) {
    if (!d.bowler_id) continue;
    const key = `${d.bowler_id}_${d.over_number}`;
    if (!overRuns.has(key)) overRuns.set(key, 0);
    const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    if (!isBye) {
      const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
      overRuns.set(key, overRuns.get(key) + total);
    }
  }
  const maidenMap = new Map();
  for (const [key, runs] of overRuns) {
    const bowlerId = key.split('_')[0];
    if (runs === 0) maidenMap.set(bowlerId, (maidenMap.get(bowlerId) || 0) + 1);
  }

  return { batOrder, batMap, dismissalMap, bowlOrder, bowlMap, maidenMap };
}

function dismissalText(info) {
  if (!info) return 'not out';
  switch (info.type) {
    case 'bowled': return `b ${info.bowlerName}`.trim();
    case 'caught': return `c ${info.fielderName} b ${info.bowlerName}`.trim();
    case 'lbw': return `lbw b ${info.bowlerName}`.trim();
    case 'run_out': return `run out${info.fielderName ? ` (${info.fielderName})` : ''}`;
    case 'stumped': return `st ${info.fielderName} b ${info.bowlerName}`.trim();
    case 'hit_wicket': return `hit wkt b ${info.bowlerName}`.trim();
    case 'retired_hurt': return 'retired hurt';
    case 'retired_out': return 'retired out';
    default: return info.type?.replace(/_/g, ' ') || 'out';
  }
}

// playerMeta: Map<playerId, { isCaptain, isWicketKeeper }>
function PlayerBadges({ pid, playerMeta }) {
  const meta = playerMeta?.get(pid);
  if (!meta) return null;
  return (
    <>
      {meta.isCaptain && (
        <span className="ml-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 py-0.5 rounded">(C)</span>
      )}
      {meta.isWicketKeeper && (
        <span className="ml-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded">(WK)</span>
      )}
    </>
  );
}

function InningsBlock({ innings, deliveries, playerMeta, playersMap, onBatterClick, motmId }) {
  const { batOrder, batMap, dismissalMap, bowlOrder, bowlMap, maidenMap } = buildStatsFromDeliveries(deliveries);

  const extras = deliveries.reduce((acc, d) => {
    if (d.extra_type === 'wide') acc.wides += d.extra_runs || 0;
    else if (d.extra_type === 'no_ball') acc.no_balls += d.extra_runs || 0;
    else if (d.extra_type === 'bye') acc.byes += d.extra_runs || 0;
    else if (d.extra_type === 'leg_bye') acc.leg_byes += d.extra_runs || 0;
    else if (d.extra_type === 'penalty_batting' || d.extra_type === 'penalty_fielding') acc.penalty += d.extra_runs || 0;
    return acc;
  }, { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, penalty: 0 });
  const totalExtras = extras.wides + extras.no_balls + extras.byes + extras.leg_byes + extras.penalty;

  return (
    <div className="space-y-4">
      <HighlightsFeed deliveries={deliveries} playersMap={playersMap} />
      <OverByOverTable deliveries={deliveries} playersMap={playersMap} />

      {/* Batting */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-1">Batsman</th>
              <th className="py-2 px-1">How Out</th>
              <th className="py-2 px-1 text-center">R</th>
              <th className="py-2 px-1 text-center">B</th>
              <th className="py-2 px-1 text-center">1s</th>
              <th className="py-2 px-1 text-center">2s</th>
              <th className="py-2 px-1 text-center">3s</th>
              <th className="py-2 px-1 text-center">4s</th>
              <th className="py-2 px-1 text-center">6s</th>
              <th className="py-2 px-1 text-center">Dots</th>
              <th className="py-2 px-1 text-center">SR</th>
            </tr>
          </thead>
          <tbody>
            {batOrder.length === 0 && (
              <tr><td colSpan={11} className="py-3 text-center text-gray-400">No deliveries</td></tr>
            )}
            {batOrder.map((pid, i) => {
              const s = batMap.get(pid);
              const dis = dismissalMap.get(pid);
              return (
                <tr
                  key={i}
                  className="border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  onClick={() => onBatterClick && onBatterClick(pid, s.name)}
                >
                  <td className="py-2 pr-1 font-medium">
                    <span className="inline-flex items-center gap-0.5 flex-wrap">
                      <PlayerLink id={pid} name={s.name} />
                      <PlayerBadges pid={pid} playerMeta={playerMeta} />
                      {pid === motmId && <span className="ml-0.5 text-[10px] text-cricket-gold" title="Man of the Match">★</span>}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-gray-500 text-[11px]">{dismissalText(dis)}</td>
                  <td className="py-2 px-1 text-center font-semibold">{s.runs}</td>
                  <td className="py-2 px-1 text-center">{s.balls}</td>
                  <td className="py-2 px-1 text-center">{s.ones}</td>
                  <td className="py-2 px-1 text-center">{s.twos}</td>
                  <td className="py-2 px-1 text-center">{s.threes}</td>
                  <td className="py-2 px-1 text-center">{s.fours}</td>
                  <td className="py-2 px-1 text-center">{s.sixes}</td>
                  <td className="py-2 px-1 text-center">{s.dots}</td>
                  <td className="py-2 px-1 text-center">{s.balls > 0 ? fmt(calcStrikeRate(s.runs, s.balls)) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 flex justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
        <span>Extras: wd {extras.wides} nb {extras.no_balls} b {extras.byes} lb {extras.leg_byes} pen {extras.penalty}</span>
        <span className="font-semibold">Total {totalExtras}</span>
      </div>

      <div className="text-sm font-bold text-center bg-cricket-green/10 rounded-lg p-2">
        {innings.total_runs}/{innings.total_wickets} ({formatOvers(innings.total_legal_balls)} ov)
      </div>

      {/* Bowling */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-1">Bowler</th>
              <th className="py-2 px-1 text-center">O</th>
              <th className="py-2 px-1 text-center">M</th>
              <th className="py-2 px-1 text-center">R</th>
              <th className="py-2 px-1 text-center">W</th>
              <th className="py-2 px-1 text-center">Econ</th>
              <th className="py-2 px-1 text-center">Wd</th>
              <th className="py-2 px-1 text-center">NB</th>
            </tr>
          </thead>
          <tbody>
            {bowlOrder.length === 0 && (
              <tr><td colSpan={8} className="py-3 text-center text-gray-400">No deliveries</td></tr>
            )}
            {bowlOrder.map((pid, i) => {
              const s = bowlMap.get(pid);
              const maidens = maidenMap.get(pid) || 0;
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-1 font-medium">
                    <span className="inline-flex items-center gap-0.5">
                      <PlayerLink id={pid} name={s.name} />
                      <PlayerBadges pid={pid} playerMeta={playerMeta} />
                    </span>
                  </td>
                  <td className="py-2 px-1 text-center">{formatOvers(s.legal_balls)}</td>
                  <td className="py-2 px-1 text-center">{maidens}</td>
                  <td className="py-2 px-1 text-center">{s.runs}</td>
                  <td className="py-2 px-1 text-center font-semibold">{s.wickets}</td>
                  <td className="py-2 px-1 text-center">{s.legal_balls > 0 ? fmt(calcEconomy(s.runs, s.legal_balls)) : '-'}</td>
                  <td className="py-2 px-1 text-center">{s.wides}</td>
                  <td className="py-2 px-1 text-center">{s.no_balls}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Scorecard() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [inningsList, setInningsList] = useState([]);
  const [deliveriesMap, setDeliveriesMap] = useState({});
  const [playerMeta, setPlayerMeta] = useState(new Map());
  const [playersMap, setPlayersMap] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [srBatter, setSrBatter] = useState(null);

  useEffect(() => {
    matchService.getMatch(id).then(setMatch);
    matchService.getInnings(id).then(async list => {
      setInningsList(list);
      const all = {};
      for (const inn of list) all[inn.id] = await matchService.getDeliveries(inn.id);
      setDeliveriesMap(all);
    });
    // Build playerMeta and playersMap from match_players
    matchService.getMatchPlayers(id).then(rows => {
      const meta = new Map();
      const pMap = {};
      for (const row of rows) {
        meta.set(row.player_id, {
          isCaptain: row.is_captain === true,
          isWicketKeeper: row.players?.role === 'wicket_keeper',
        });
        if (row.players) pMap[row.player_id] = row.players;
      }
      setPlayerMeta(meta);
      setPlayersMap(pMap);
    });
  }, [id]);

  if (!match || inningsList.length === 0) return <div className="p-4">Loading…</div>;

  const active = inningsList[activeTab];

  const motmId = match?.man_of_match?.id;
  const activeDeliveries = deliveriesMap[active?.id] ?? [];

  return (
    <div className="p-4 space-y-4 page-transition">
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">{match.team1_name} vs {match.team2_name}</h1>

      {match.man_of_match && (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-cricket-gold/10 border border-cricket-gold/30">
          <span className="text-cricket-gold text-lg">★</span>
          <div>
            <p className="text-[11px] font-semibold text-cricket-gold uppercase tracking-wider">Man of the Match</p>
            <PlayerLink id={match.man_of_match.id} name={match.man_of_match.name} className="font-bold text-ink-900 dark:text-white" />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {inningsList.map((inn, i) => (
          <button key={inn.id} onClick={() => setActiveTab(i)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${activeTab === i ? 'bg-cricket-green text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
            Innings {inn.innings_number}
          </button>
        ))}
      </div>

      <MomentumGraph deliveries={activeDeliveries} />

      {active && (
        <InningsBlock
          innings={active}
          deliveries={activeDeliveries}
          playerMeta={playerMeta}
          playersMap={playersMap}
          motmId={motmId}
          onBatterClick={(pid, name) => setSrBatter({ id: pid, name })}
        />
      )}

      {playerMeta.size > 0 && (
        <p className="text-[11px] text-ink-400 text-center pt-1">(C) Captain · (WK) Wicket Keeper · Tap a batsman row for SR chart</p>
      )}

      <BottomSheet
        open={!!srBatter}
        onClose={() => setSrBatter(null)}
        title={srBatter ? `${srBatter.name} — SR by Over` : ''}
        heightClass="h-[50vh]"
      >
        {srBatter && (
          <BatterSRChart deliveries={activeDeliveries} batsmanId={srBatter.id} />
        )}
      </BottomSheet>
    </div>
  );
}

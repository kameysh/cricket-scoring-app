import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import * as matchService from '../services/matchService';
import { supabase } from '../lib/supabase';
import PlayerLink from '../components/player/PlayerLink';
import PlayerAvatar from '../components/player/PlayerAvatar';
import { calcStrikeRate, calcEconomy, formatOvers, fmt } from '../lib/cricketUtils';
import MomentumGraph from '../components/match/MomentumGraph';
import HighlightsFeed from '../components/match/HighlightsFeed';
import OverByOverTable from '../components/match/OverByOverTable';
import PlayerMatchCardSheet from '../components/match/PlayerMatchCardSheet';

function buildStatsFromDeliveries(deliveries, playersMap = {}) {
  // Batting: ordered by first appearance
  const batOrder = [];
  const batMap = new Map();
  for (const d of deliveries) {
    const pid = d.batsman_id;
    if (!pid) continue;
    if (!batMap.has(pid)) {
      batOrder.push(pid);
      batMap.set(pid, { name: d.batsman?.name || playersMap[pid]?.name || pid, runs: 0, balls: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, dots: 0 });
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
      bowlerName: d.bowler?.name || playersMap[d.bowler_id]?.name || '',
      fielderName: d.fielder?.name || playersMap[d.fielder_id]?.name || '',
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
      bowlMap.set(pid, { name: d.bowler?.name || playersMap[pid]?.name || pid, legal_balls: 0, runs: 0, wickets: 0, wides: 0, no_balls: 0, maiden_overs: new Set() });
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

function InningsBlock({ innings, deliveries, playerMeta, playersMap, onBatterClick, onBowlerShare, motmId }) {
  const { batOrder, batMap, dismissalMap, bowlOrder, bowlMap, maidenMap } = buildStatsFromDeliveries(deliveries, playersMap);

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
      <div>
        <p className="text-[11px] font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">Batting</p>
        <div className="flex items-center text-[11px] font-medium text-ink-400 pb-1.5 border-b border-ink-100 dark:border-white/10">
          <div className="flex-1">Batter</div>
          <div className="w-8 text-right">R</div>
          <div className="w-7 text-right">B</div>
          <div className="w-7 text-right">4s</div>
          <div className="w-7 text-right">6s</div>
          <div className="w-12 text-right">S/R</div>
        </div>

        {batOrder.length === 0 && (
          <p className="text-xs text-ink-400 text-center py-6">No deliveries recorded</p>
        )}

        {batOrder.map(pid => {
          const s = batMap.get(pid);
          const dis = dismissalMap.get(pid);
          const p = playersMap[pid];
          const isNotOut = !dis;
          const sr = s.balls > 0 ? fmt(calcStrikeRate(s.runs, s.balls)) : '-';
          return (
            <div
              key={pid}
              className="flex items-center gap-2.5 py-2.5 border-b border-ink-50 dark:border-white/5 cursor-pointer hover:bg-ink-50 dark:hover:bg-white/5 -mx-1 px-1 rounded-lg transition-colors"
              onClick={() => onBatterClick?.(pid, s.name)}
            >
              <div className="shrink-0">
                <PlayerAvatar name={s.name} photoUrl={p?.photo_url} size={30} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</span>
                  <PlayerBadges pid={pid} playerMeta={playerMeta} />
                  {pid === motmId && <span className="text-[11px] text-cricket-gold ml-0.5">★</span>}
                </div>
                <p className="text-[11px] text-ink-400 mt-0.5 truncate">{dismissalText(dis)}</p>
              </div>
              <div className="flex items-center shrink-0">
                <div className="w-8 text-right text-sm font-bold text-ink-900 dark:text-white">{s.runs}{isNotOut ? '*' : ''}</div>
                <div className="w-7 text-right text-xs text-ink-500">{s.balls}</div>
                <div className="w-7 text-right text-xs text-ink-500">{s.fours}</div>
                <div className="w-7 text-right text-xs text-ink-500">{s.sixes}</div>
                <div className="w-12 text-right text-xs text-ink-500">{sr}</div>
              </div>
            </div>
          );
        })}

        <div className="flex justify-between text-xs text-ink-500 py-2 mt-1 border-t border-ink-100 dark:border-white/10">
          <span>Extras: wd {extras.wides} nb {extras.no_balls} b {extras.byes} lb {extras.leg_byes}{extras.penalty > 0 ? ` pen ${extras.penalty}` : ''}</span>
          <span className="font-semibold">{totalExtras}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-t border-ink-200 dark:border-white/10 font-semibold text-sm text-ink-900 dark:text-white">
          <span>Total ({formatOvers(innings.total_legal_balls)} ov)</span>
          <span>{innings.total_runs}/{innings.total_wickets}</span>
        </div>
      </div>

      {/* Bowling */}
      <div>
        <p className="text-[11px] font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">Bowling</p>
        <div className="flex items-center text-[11px] font-medium text-ink-400 pb-1.5 border-b border-ink-100 dark:border-white/10">
          <div className="flex-1">Bowler</div>
          <div className="w-8 text-right">O</div>
          <div className="w-7 text-right">M</div>
          <div className="w-8 text-right">R</div>
          <div className="w-7 text-right">W</div>
          <div className="w-12 text-right">Econ</div>
          <div className="w-7"></div>
        </div>

        {bowlOrder.length === 0 && (
          <p className="text-xs text-ink-400 text-center py-6">No deliveries recorded</p>
        )}

        {bowlOrder.map(pid => {
          const s = bowlMap.get(pid);
          const maidens = maidenMap.get(pid) || 0;
          const p = playersMap[pid];
          const econ = s.legal_balls > 0 ? fmt(calcEconomy(s.runs, s.legal_balls)) : '-';
          return (
            <div key={pid} className="flex items-center gap-2.5 py-2.5 border-b border-ink-50 dark:border-white/5">
              <div className="shrink-0">
                <PlayerAvatar name={s.name} photoUrl={p?.photo_url} size={30} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-0.5">
                  <PlayerLink id={pid} name={s.name} className="text-sm font-medium" />
                  <PlayerBadges pid={pid} playerMeta={playerMeta} />
                </span>
              </div>
              <div className="flex items-center shrink-0">
                <div className="w-8 text-right text-xs text-ink-700 dark:text-ink-300">{formatOvers(s.legal_balls)}</div>
                <div className="w-7 text-right text-xs text-ink-500">{maidens}</div>
                <div className="w-8 text-right text-xs text-ink-500">{s.runs}</div>
                <div className="w-7 text-right text-xs font-bold text-ink-900 dark:text-white">{s.wickets}</div>
                <div className="w-12 text-right text-xs text-ink-500">{econ}</div>
                <div className="w-7 flex justify-end">
                  <button
                    onClick={() => onBowlerShare?.(pid, s.name)}
                    className="p-1 rounded-full text-ink-400 hover:text-brand-green hover:bg-brand-green/10 transition-colors"
                    title="Share performance"
                  >
                    <Share2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
  const [cardPlayer, setCardPlayer] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const inningsIdsRef = useRef([]);

  const reloadInnings = useCallback(async () => {
    const list = await matchService.getInnings(id);
    setInningsList(list);
    inningsIdsRef.current = list.map(i => i.id);
    const all = {};
    await Promise.all(list.map(async inn => {
      all[inn.id] = await matchService.getDeliveries(inn.id);
    }));
    setDeliveriesMap(all);
  }, [id]);

  useEffect(() => {
    matchService.getMatch(id).then(m => {
      setMatch(m);
      setIsLive(m?.status === 'live' || m?.status === 'paused');
    });
    reloadInnings();
    matchService.getMatchPlayers(id).then(rows => {
      const meta = new Map();
      const pMap = {};
      for (const row of rows) {
        meta.set(row.player_id, {
          isCaptain: row.is_captain === true,
          isWicketKeeper: row.players?.role === 'wicket_keeper',
          team: row.team,
        });
        if (row.players) pMap[row.player_id] = { ...row.players, team: row.team };
      }
      setPlayerMeta(meta);
      setPlayersMap(pMap);
    });
  }, [id, reloadInnings]);

  // ── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    // Match status changes (live → completed, etc.)
    const matchChannel = supabase
      .channel(`scorecard:match:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        payload => {
          setMatch(prev => ({ ...prev, ...payload.new }));
          setIsLive(payload.new.status === 'live' || payload.new.status === 'paused');
        }
      )
      .subscribe();

    // Innings score updates (total_runs, total_wickets change on every ball)
    const inningsChannel = supabase
      .channel(`scorecard:innings:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'innings', filter: `match_id=eq.${id}` },
        payload => {
          setInningsList(prev => prev.map(inn => inn.id === payload.new.id ? { ...inn, ...payload.new } : inn));
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'innings', filter: `match_id=eq.${id}` },
        () => reloadInnings()
      )
      .subscribe();

    // New deliveries (ball-by-ball feed) — filter by innings_id IN is not supported,
    // so we subscribe to all inserts and filter by known innings ids client-side
    const deliveriesChannel = supabase
      .channel(`scorecard:deliveries:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries' },
        payload => {
          const inningsId = payload.new.innings_id;
          if (!inningsIdsRef.current.includes(inningsId)) return;
          setDeliveriesMap(prev => ({
            ...prev,
            [inningsId]: [...(prev[inningsId] || []), payload.new],
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(inningsChannel);
      supabase.removeChannel(deliveriesChannel);
    };
  }, [id, reloadInnings]);

  function openPlayerCard(pid) {
    const allDeliveries = Object.values(deliveriesMap).flat();
    const { batMap, dismissalMap, bowlMap, maidenMap } = buildStatsFromDeliveries(allDeliveries, playersMap);
    const player = playersMap[pid] || { id: pid, name: batMap.get(pid)?.name || bowlMap.get(pid)?.name || pid };
    setCardPlayer({
      player,
      batStats: batMap.get(pid) || null,
      dismissal: dismissalMap.get(pid) || null,
      bowlStats: bowlMap.get(pid) || null,
      bowlMaidens: maidenMap.get(pid) || 0,
    });
  }

  if (!match || inningsList.length === 0) return <div className="p-4">Loading…</div>;

  const active = inningsList[activeTab];

  const motmId = match?.man_of_match?.id;
  const activeDeliveries = deliveriesMap[active?.id] ?? [];

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{match.team1_name} vs {match.team2_name}</h1>
        {isLive && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-600 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

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
            {inn.is_super_over ? `⚡ Super Over ${inn.innings_number === 3 ? '1' : '2'}` : `Innings ${inn.innings_number}`}
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
          onBatterClick={(pid) => openPlayerCard(pid)}
          onBowlerShare={(pid) => openPlayerCard(pid)}
        />
      )}

      {playerMeta.size > 0 && (
        <p className="text-[11px] text-ink-400 text-center pt-1">(C) Captain · (WK) Wicket Keeper · Tap a batsman row to share performance</p>
      )}

      {cardPlayer && (
        <PlayerMatchCardSheet
          open
          onClose={() => setCardPlayer(null)}
          player={cardPlayer.player}
          match={match}
          inningsList={inningsList}
          batStats={cardPlayer.batStats}
          dismissal={cardPlayer.dismissal}
          bowlStats={cardPlayer.bowlStats}
          bowlMaidens={cardPlayer.bowlMaidens}
          deliveries={activeDeliveries}
        />
      )}
    </div>
  );
}

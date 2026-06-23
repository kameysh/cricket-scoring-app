import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Share2, Trash2, ChevronDown } from 'lucide-react';
import * as matchService from '../services/matchService';
import { calcMotmScore, formatOvers, fmt, calcStrikeRate, calcEconomy, displayName } from '../lib/cricketUtils';
import { useRole } from '../hooks/useRole';
import PlayerLink from '../components/player/PlayerLink';
import PlayerAvatar from '../components/player/PlayerAvatar';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import PlayerMatchCardSheet from '../components/match/PlayerMatchCardSheet';
import HighlightsFeed from '../components/match/HighlightsFeed';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function buildStatsFromDeliveries(deliveries) {
  const batOrder = [];
  const batMap = new Map();
  for (const d of deliveries) {
    const pid = d.batsman_id;
    if (!pid) continue;
    if (!batMap.has(pid)) {
      batOrder.push(pid);
      batMap.set(pid, { name: displayName(d.batsman) || pid, runs: 0, balls: 0, fours: 0, sixes: 0 });
    }
    const s = batMap.get(pid);
    if (d.extra_type !== 'wide') {
      s.balls += 1;
      const r = d.runs_off_bat || 0;
      s.runs += r;
      if (r === 4) s.fours += 1;
      if (r === 6) s.sixes += 1;
    }
  }

  const dismissalMap = new Map();
  for (const d of deliveries) {
    if (!d.is_wicket) continue;
    const outId = d.batsman_out_id || d.batsman_id;
    if (!outId || dismissalMap.has(outId)) continue;
    dismissalMap.set(outId, {
      type: d.wicket_type,
      bowlerName: displayName(d.bowler) || '',
      fielderName: displayName(d.fielder) || '',
    });
  }

  const bowlOrder = [];
  const bowlMap = new Map();
  for (const d of deliveries) {
    const pid = d.bowler_id;
    if (!pid) continue;
    if (!bowlMap.has(pid)) {
      bowlOrder.push(pid);
      bowlMap.set(pid, { name: displayName(d.bowler) || pid, legal_balls: 0, runs: 0, wickets: 0 });
    }
    const s = bowlMap.get(pid);
    if (d.is_legal_delivery) s.legal_balls += 1;
    const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
    s.runs += isBye ? 0 : total;
    if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'hit_twice', 'obstructing', 'timed_out', 'handled_ball'].includes(d.wicket_type)) {
      s.wickets += 1;
    }
  }

  const overRuns = new Map();
  for (const d of deliveries) {
    if (!d.bowler_id) continue;
    const key = `${d.bowler_id}_${d.over_number}`;
    if (!overRuns.has(key)) overRuns.set(key, 0);
    const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    if (!isBye) overRuns.set(key, overRuns.get(key) + (d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0))));
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

// ── Scorecard innings view — Google-style ──────────────────────────────────────

function ScorecardInnings({ innings, deliveries, playerMeta, playersMap, matchPlayers, motmId, onBatterClick }) {
  const { batOrder, batMap, dismissalMap, bowlOrder, bowlMap, maidenMap } = useMemo(
    () => buildStatsFromDeliveries(deliveries),
    [deliveries]
  );

  const extras = useMemo(() => deliveries.reduce((acc, d) => {
    if (d.extra_type === 'wide') acc.wides += d.extra_runs || 0;
    else if (d.extra_type === 'no_ball') acc.no_balls += d.extra_runs || 0;
    else if (d.extra_type === 'bye') acc.byes += d.extra_runs || 0;
    else if (d.extra_type === 'leg_bye') acc.leg_byes += d.extra_runs || 0;
    else if (d.extra_type === 'penalty_batting' || d.extra_type === 'penalty_fielding') acc.penalty += d.extra_runs || 0;
    return acc;
  }, { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, penalty: 0 }), [deliveries]);
  const totalExtras = extras.wides + extras.no_balls + extras.byes + extras.leg_byes + extras.penalty;

  const yetToBat = useMemo(() => {
    const battedSet = new Set(batOrder);
    return (matchPlayers || [])
      .filter(mp => (mp.team === innings.batting_team || mp.team === 0) && mp.is_active !== false && !battedSet.has(mp.player_id))
      .map(mp => displayName(mp.players) || mp.player_id)
      .filter(Boolean);
  }, [batOrder, matchPlayers, innings.batting_team]);

  const fow = useMemo(() => {
    let runs = 0;
    const result = [];
    for (const d of deliveries) {
      runs += d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
      if (d.is_wicket) {
        const pid = d.batsman_out_id || d.batsman_id;
        const name = displayName(playersMap[pid]) || batMap.get(pid)?.name || '';
        const shortName = name.split(' ').slice(-1)[0];
        result.push({ runs, wickets: result.length + 1, over: d.over_number !== undefined ? `${d.over_number + 1}.${d.ball_number || 0}` : '', shortName });
      }
    }
    return result;
  }, [deliveries, playersMap, batMap]);

  return (
    <div>
      {/* Batting header */}
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
        const meta = playerMeta?.get(pid);
        const isNotOut = !dis;
        const sr = s.balls > 0 ? fmt(calcStrikeRate(s.runs, s.balls)) : '-';
        return (
          <div
            key={pid}
            className="flex items-center gap-2.5 py-2.5 border-b border-ink-50 dark:border-white/5 cursor-pointer hover:bg-ink-50 dark:hover:bg-white/5 -mx-1 px-1 rounded-lg transition-colors"
            onClick={() => onBatterClick?.(pid)}
          >
            <div className="shrink-0"><PlayerAvatar name={s.name} photoUrl={p?.photo_url} size={30} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-0.5 flex-wrap">
                <span className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</span>
                {meta?.isCaptain && <span className="text-[10px] font-bold text-amber-600 ml-0.5">(C)</span>}
                {meta?.isWicketKeeper && <span className="text-[10px] font-bold text-sky-600 ml-0.5">(Wk)</span>}
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

      {yetToBat.length > 0 && (
        <p className="text-[11px] text-ink-400 py-2">
          <span className="font-semibold text-ink-500">Yet to bat: </span>{yetToBat.join(', ')}
        </p>
      )}

      <div className="flex justify-between text-xs text-ink-500 py-2 mt-1 border-t border-ink-100 dark:border-white/10">
        <span>Extras: wd {extras.wides} nb {extras.no_balls} b {extras.byes} lb {extras.leg_byes}{extras.penalty > 0 ? ` pen ${extras.penalty}` : ''}</span>
        <span className="font-semibold">{totalExtras}</span>
      </div>

      <div className="flex justify-between items-center py-2 border-t border-ink-200 dark:border-white/10 font-semibold text-sm text-ink-900 dark:text-white">
        <span>Total ({formatOvers(innings.total_legal_balls)} ov)</span>
        <span>{innings.total_runs}/{innings.total_wickets}</span>
      </div>

      {fow.length > 0 && (
        <div className="py-2 border-t border-ink-100 dark:border-white/10">
          <p className="text-[11px] font-semibold text-ink-400 mb-1">Fall of wickets</p>
          <p className="text-[11px] text-ink-500 leading-5 break-words">
            {fow.map((w, i) => (
              <span key={i}>
                {w.runs}/{w.wickets} <span className="text-ink-400">({w.shortName}{w.over ? `, ${w.over} ov` : ''})</span>
                {i < fow.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Bowling */}
      <div className="mt-5">
        <p className="text-[11px] font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">Bowling</p>
        <div className="flex items-center text-[11px] font-medium text-ink-400 pb-1.5 border-b border-ink-100 dark:border-white/10">
          <div className="flex-1">Bowler</div>
          <div className="w-8 text-right">O</div>
          <div className="w-7 text-right">M</div>
          <div className="w-8 text-right">R</div>
          <div className="w-7 text-right">W</div>
          <div className="w-12 text-right">Econ</div>
        </div>
        {bowlOrder.map(pid => {
          const s = bowlMap.get(pid);
          const maidens = maidenMap.get(pid) || 0;
          const p = playersMap[pid];
          const econ = s.legal_balls > 0 ? fmt(calcEconomy(s.runs, s.legal_balls)) : '-';
          return (
            <div key={pid} className="flex items-center gap-2.5 py-2.5 border-b border-ink-50 dark:border-white/5">
              <div className="shrink-0"><PlayerAvatar name={s.name} photoUrl={p?.photo_url} size={30} /></div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink-900 dark:text-white">{s.name}</span>
              </div>
              <div className="flex items-center shrink-0">
                <div className="w-8 text-right text-xs text-ink-700 dark:text-ink-300">{formatOvers(s.legal_balls)}</div>
                <div className="w-7 text-right text-xs text-ink-500">{maidens}</div>
                <div className="w-8 text-right text-xs text-ink-500">{s.runs}</div>
                <div className="w-7 text-right text-xs font-bold text-ink-900 dark:text-white">{s.wickets}</div>
                <div className="w-12 text-right text-xs text-ink-500">{econ}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MatchSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canScore } = useRole();

  const [match, setMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [inningsList, setInningsList] = useState([]);
  const [deliveriesMap, setDeliveriesMap] = useState({});
  const [playerMeta, setPlayerMeta] = useState(new Map());
  const [playersMap, setPlayersMap] = useState({});
  const [battingCards, setBattingCards] = useState([]);
  const [bowlingCards, setBowlingCards] = useState([]);
  const [fieldingCards, setFieldingCards] = useState([]);

  const [activeTab, setActiveTab] = useState('summary');
  const [scorecardInningsIdx, setScorecardInningsIdx] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingMotm, setSavingMotm] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cardPlayer, setCardPlayer] = useState(null);
  const [matchNumber, setMatchNumber] = useState(null);

  useEffect(() => { matchService.getMatchNumber(id).then(n => setMatchNumber(n)).catch(() => {}); }, [id]);

  useEffect(() => {
    matchService.getMatch(id).then(m => {
      setMatch(m);
      if (m?.status === 'completed' && !m.man_of_match_id) {
        matchService.autoAssignManOfMatch(id).then(() => matchService.getMatch(id).then(setMatch));
      }
    });

    matchService.getMatchPlayers(id).then(mps => {
      setMatchPlayers(mps);
      const meta = new Map();
      const pMap = {};
      for (const row of mps) {
        meta.set(row.player_id, { isCaptain: row.is_captain === true, isWicketKeeper: row.players?.role === 'wicket_keeper', team: row.team });
        if (row.players) pMap[row.player_id] = { ...row.players, team: row.team };
      }
      setPlayerMeta(meta);
      setPlayersMap(pMap);
    });

    matchService.getInnings(id).then(async list => {
      setInningsList(list);
      try {
        const results = await Promise.all(list.map(inn => matchService.getScorecards(inn.id)));
        const allBatting = [], allBowling = [], allFielding = [];
        results.forEach(cards => {
          allBatting.push(...cards.batting);
          allBowling.push(...cards.bowling);
          allFielding.push(...(cards.fielding || []));
        });
        setBattingCards(allBatting);
        setBowlingCards(allBowling);
        setFieldingCards(allFielding);
      } catch { toast.error('Failed to load scorecards'); }

      const delivMap = {};
      await Promise.all(list.map(async inn => {
        delivMap[inn.id] = await matchService.getDeliveries(inn.id);
      }));
      setDeliveriesMap(delivMap);
    });
  }, [id]);

  // Must be before early return (Rules of Hooks)
  const scoredPlayers = useMemo(() => {
    if (!matchPlayers.length) return [];
    const seen = new Set();
    return matchPlayers
      .filter(mp => { if (seen.has(mp.player_id)) return false; seen.add(mp.player_id); return true; })
      .map(mp => ({
        id: mp.player_id,
        name: displayName(mp.players) || mp.player_id,
        pts: calcMotmScore(mp.player_id, battingCards, bowlingCards, fieldingCards),
      }))
      .sort((a, b) => b.pts - a.pts);
  }, [matchPlayers, battingCards, bowlingCards, fieldingCards]);

  if (!match) return null;

  const inn1 = inningsList.find(i => i.batting_team === 1);
  const inn2 = inningsList.find(i => i.batting_team === 2);
  const motmId = match.man_of_match_id || match.man_of_match?.id;
  const motmName = displayName(matchPlayers.find(mp => mp.player_id === motmId)?.players) || displayName(match.man_of_match);
  const motmPhotoUrl = matchPlayers.find(mp => mp.player_id === motmId)?.players?.photo_url;
  const motmBat = battingCards.find(c => c.player_id === motmId);
  const motmBowl = bowlingCards.find(c => c.player_id === motmId);
  const motmStats = [
    motmBat?.runs != null ? `${motmBat.runs}${motmBat.is_not_out ? '*' : ''} (${motmBat.balls_faced || 0})` : null,
    motmBowl?.wickets ? `${motmBowl.wickets}/${motmBowl.runs_conceded || 0} (${formatOvers(motmBowl.legal_balls || 0)})` : null,
  ].filter(Boolean).join(' · ');

  const playerNameMap = new Map(matchPlayers.map(mp => [mp.player_id, displayName(mp.players) || mp.player_id]));
  const playerTeamMap = new Map(matchPlayers.map(mp => [mp.player_id, mp.team]));

  const topBatters = teamId => battingCards
    .filter(c => playerTeamMap.get(c.player_id) === teamId)
    .sort((a, b) => (b.runs || 0) - (a.runs || 0))
    .slice(0, 3);

  const topBowlers = teamId => bowlingCards
    .filter(c => playerTeamMap.get(c.player_id) === teamId)
    .sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runs_conceded || 0) - (b.runs_conceded || 0))
    .slice(0, 3);

  async function handleMotmChange(playerId) {
    if (!playerId || savingMotm) return;
    setSavingMotm(true);
    try {
      await matchService.updateMatch(id, { man_of_match_id: playerId });
      setMatch(m => ({ ...m, man_of_match_id: playerId }));
      toast.success(`${scoredPlayers.find(p => p.id === playerId)?.name} set as Man of the Match`);
    } catch { toast.error('Failed to update Man of the Match'); }
    finally { setSavingMotm(false); }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await matchService.deleteMatch(id);
      navigate('/matches');
    } catch (e) {
      toast.error(e.message || 'Failed to delete match');
      setDeleting(false);
    }
  }

  async function shareResult() {
    if (sharing) return;
    setSharing(true);
    try {
      const text = [
        `${match.team1_name} vs ${match.team2_name}`,
        match.result_summary || '',
        motmName ? `Player of the Match: ${motmName}` : '',
      ].filter(Boolean).join('\n');
      if (navigator.share) {
        await navigator.share({ title: `${match.team1_name} vs ${match.team2_name}`, text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
      }
    } catch { /* user cancelled */ }
    finally { setSharing(false); }
  }

  function openPlayerCard(pid) {
    const allDeliveries = Object.values(deliveriesMap).flat();
    const { batMap, dismissalMap, bowlMap, maidenMap } = buildStatsFromDeliveries(allDeliveries);
    const player = playersMap[pid] || { id: pid, name: batMap.get(pid)?.name || bowlMap.get(pid)?.name || pid };
    setCardPlayer({
      player,
      batStats: batMap.get(pid) || null,
      dismissal: dismissalMap.get(pid) || null,
      bowlStats: bowlMap.get(pid) || null,
      bowlMaidens: maidenMap.get(pid) || 0,
    });
  }

  const scorecardActive = inningsList[scorecardInningsIdx];
  const scorecardDeliveries = deliveriesMap[scorecardActive?.id] ?? [];
  const allDeliveries = Object.values(deliveriesMap).flat();

  return (
    <div className="pb-8 page-transition">
      {/* Nav row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => navigate('/matches')} className="text-sm text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white">
          ← Matches
        </button>
        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      {/* Match score header */}
      {matchNumber != null && (
        <p className="px-4 pt-2 text-[10px] font-semibold tracking-widest text-ink-400 uppercase">
          Match {String(matchNumber).padStart(2, '0')}
          {match.tournaments?.name ? ` · ${match.tournaments.name}` : ''}
        </p>
      )}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 items-center">
        <div className="text-left">
          <p className="text-xs text-ink-400 font-medium truncate">{match.team1_name}</p>
          <p className="text-xl font-bold text-ink-900 dark:text-white leading-tight">
            {inn1 ? `${inn1.total_runs}/${inn1.total_wickets}` : '—'}
          </p>
          {inn1 && <p className="text-[11px] text-ink-400">({formatOvers(inn1.total_legal_balls)} ov)</p>}
        </div>
        <div className="text-center px-1">
          <p className="text-[11px] font-semibold text-ink-500 dark:text-ink-400 leading-tight">
            {match.result_summary || 'In Progress'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400 font-medium truncate">{match.team2_name}</p>
          <p className="text-xl font-bold text-ink-900 dark:text-white leading-tight">
            {inn2 ? `${inn2.total_runs}/${inn2.total_wickets}` : '—'}
          </p>
          {inn2 && <p className="text-[11px] text-ink-400">({formatOvers(inn2.total_legal_balls)} ov)</p>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-ink-200 dark:border-white/10 px-4 sticky top-0 bg-white dark:bg-ink-950 z-10">
        {['Summary', 'Scorecard', 'Commentary'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`py-3 mr-6 text-xs font-bold border-b-2 transition-colors tracking-wide ${
              activeTab === tab.toLowerCase()
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-ink-400 dark:text-ink-500'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── SUMMARY ── */}
      {activeTab === 'summary' && (
        <div className="px-4 pt-4 space-y-4">
          {/* MoTM blue card */}
          {motmId && motmName && (
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-blue-100 uppercase tracking-wider mb-1">Player of the Match</p>
                <PlayerLink id={motmId} name={motmName} className="font-bold text-white text-base block truncate" />
                {motmStats ? <p className="text-blue-100 text-xs mt-1">{motmStats}</p> : null}
              </div>
              <div className="shrink-0 ring-2 ring-white/30 rounded-full overflow-hidden">
                <PlayerAvatar name={motmName} photoUrl={motmPhotoUrl} size={52} />
              </div>
            </div>
          )}

          {/* Team performance */}
          {[1, 2].map(teamId => {
            const teamName = teamId === 1 ? match.team1_name : match.team2_name;
            const teamInn = teamId === 1 ? inn1 : inn2;
            const batters = topBatters(teamId);
            const bowlers = topBowlers(teamId);
            if (!batters.length && !bowlers.length) return null;
            return (
              <div key={teamId} className="bg-white dark:bg-ink-900/60 rounded-2xl p-4 border border-ink-100 dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm text-ink-900 dark:text-white">{teamName}</span>
                  {teamInn && (
                    <span className="text-xs text-ink-400">
                      {teamInn.total_runs}/{teamInn.total_wickets} ({formatOvers(teamInn.total_legal_balls)} ov)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    {batters.length > 0 && <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">Top Bat</p>}
                    {batters.map(c => {
                      const name = playerNameMap.get(c.player_id) || c.player_id;
                      const p = playersMap[c.player_id];
                      return (
                        <div key={c.player_id} className="flex items-center gap-2 mb-2.5">
                          <div className="shrink-0"><PlayerAvatar name={name} photoUrl={p?.photo_url} size={26} /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-900 dark:text-white truncate">{name}</p>
                            <p className="text-[11px] text-ink-400">{c.runs ?? '—'}{c.is_not_out ? '*' : ''}{c.balls_faced != null ? ` (${c.balls_faced})` : ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    {bowlers.length > 0 && <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">Top Bowl</p>}
                    {bowlers.map(c => {
                      const name = playerNameMap.get(c.player_id) || c.player_id;
                      const p = playersMap[c.player_id];
                      return (
                        <div key={c.player_id} className="flex items-center gap-2 mb-2.5">
                          <div className="shrink-0"><PlayerAvatar name={name} photoUrl={p?.photo_url} size={26} /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-900 dark:text-white truncate">{name}</p>
                            <p className="text-[11px] text-ink-400">{c.wickets ?? '0'}/{c.runs_conceded ?? '0'} ({formatOvers(c.legal_balls || 0)})</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* MoTM override */}
          {canScore && scoredPlayers.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1.5">
                {motmId ? 'Override Man of the Match' : 'Select Man of the Match'}
              </label>
              <div className="relative">
                <select
                  value={motmId || ''}
                  onChange={e => handleMotmChange(e.target.value)}
                  disabled={savingMotm}
                  className="field-input appearance-none pr-8 disabled:opacity-50"
                >
                  <option value="">— Select player —</option>
                  {scoredPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.pts > 0 ? ` — ${p.pts} pts` : ' — 0 pts'}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </div>
          )}

          <button
            onClick={shareResult}
            disabled={sharing}
            className="btn-secondary w-full flex items-center justify-center gap-2 !py-2.5 disabled:opacity-50"
          >
            <Share2 size={15} /> {sharing ? 'Sharing…' : 'Share Result'}
          </button>
        </div>
      )}

      {/* ── SCORECARD ── */}
      {activeTab === 'scorecard' && (
        <div className="px-4 pt-4">
          {inningsList.length === 0 ? (
            <p className="text-ink-400 text-center py-8 text-sm">Loading…</p>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                {inningsList.map((inn, i) => (
                  <button
                    key={inn.id}
                    onClick={() => setScorecardInningsIdx(i)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      scorecardInningsIdx === i ? 'bg-brand-green text-white' : 'bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300'
                    }`}
                  >
                    {inn.is_super_over ? `⚡ SO ${inn.innings_number === 3 ? '1' : '2'}` : (inn.batting_team === 1 ? match.team1_name : match.team2_name)}
                  </button>
                ))}
              </div>
              {scorecardActive && (
                <ScorecardInnings
                  innings={scorecardActive}
                  deliveries={scorecardDeliveries}
                  playerMeta={playerMeta}
                  playersMap={playersMap}
                  matchPlayers={matchPlayers}
                  motmId={motmId}
                  onBatterClick={openPlayerCard}
                />
              )}
              {playerMeta.size > 0 && (
                <p className="text-[11px] text-ink-400 text-center pt-4">(C) Captain · (Wk) Wicket Keeper · Tap a batter row to share their performance card</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── COMMENTARY ── */}
      {activeTab === 'commentary' && (
        <div className="px-4 pt-4 space-y-4">
          {inningsList.length === 0 ? (
            <p className="text-ink-400 text-center py-8 text-sm">Loading…</p>
          ) : (
            inningsList.map((inn, i) => (
              <div key={inn.id}>
                <p className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-2">
                  {inn.is_super_over ? `⚡ Super Over ${inn.innings_number === 3 ? '1' : '2'}` : `Innings ${i + 1}`} — {inn.batting_team === 1 ? match.team1_name : match.team2_name}
                </p>
                <HighlightsFeed deliveries={deliveriesMap[inn.id] ?? []} playersMap={playersMap} />
              </div>
            ))
          )}
        </div>
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
          deliveries={allDeliveries}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this match?"
        message={`${match.team1_name} vs ${match.team2_name} — this permanently deletes all deliveries and scorecards. This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        disabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

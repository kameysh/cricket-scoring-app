import { useEffect, useState, useMemo, useRef } from 'react';
import { calcStrikeRate, calcEconomy, formatOvers, fmt } from '../lib/cricketUtils';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useMatchStore } from '../stores/matchStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useWinCondition } from '../hooks/useWinCondition';
import Scoreboard from '../components/scoring/Scoreboard';
import PowerplayBanner from '../components/scoring/PowerplayBanner';
import FreehitBanner from '../components/scoring/FreehitBanner';
import StrikerIndicator from '../components/scoring/StrikerIndicator';
import LiveScorecardPanel from '../components/scoring/LiveScorecardPanel';
import BallInputPanel from '../components/scoring/BallInputPanel';
import BallLog from '../components/scoring/BallLog';
import JokerPanel from '../components/scoring/JokerPanel';
import WicketModal from '../components/scoring/WicketModal';
import NewBatsmanModal from '../components/scoring/NewBatsmanModal';
import BowlerSelectModal from '../components/scoring/BowlerSelectModal';
import MatchResultBanner from '../components/scoring/MatchResultBanner';
import PlayerStatsDrawer from '../components/scoring/PlayerStatsDrawer';
import OfflineBanner from '../components/shared/OfflineBanner';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import BottomSheet from '../components/shared/BottomSheet';
import * as matchService from '../services/matchService';


// Derive a dismissal description from the wicket delivery for a given batsman
function wicketDismissalText(deliveries, batsmanId) {
  const wkt = deliveries.find(d => d.is_wicket && (d.batsman_out_id === batsmanId || (!d.batsman_out_id && d.batsman_id === batsmanId)));
  if (!wkt) return 'not out';
  const bowlerName = wkt.bowler?.name || '';
  const fielderName = wkt.fielder?.name || '';
  switch (wkt.wicket_type) {
    case 'bowled': return `b ${bowlerName}`.trim();
    case 'caught': return `c ${fielderName} b ${bowlerName}`.trim();
    case 'lbw': return `lbw b ${bowlerName}`.trim();
    case 'run_out': return `run out${fielderName ? ` (${fielderName})` : ''}`.trim();
    case 'stumped': return `st ${fielderName} b ${bowlerName}`.trim();
    case 'hit_wicket': return `hit wkt b ${bowlerName}`.trim();
    default: return wkt.wicket_type?.replace(/_/g, ' ') || 'out';
  }
}

function FirstInningsScorecard({ data }) {
  const { innings, deliveries } = data;
  const [tab, setTab] = useState('bat');

  // Build batting rows from deliveries — deliveries are the single source of truth
  const batOrder = [];
  const batMap = new Map();
  for (const d of deliveries) {
    const pid = d.batsman_id;
    if (!pid) continue;
    if (!batMap.has(pid)) {
      batOrder.push(pid);
      batMap.set(pid, { name: d.batsman?.name || pid, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false });
    }
    const s = batMap.get(pid);
    if (d.extra_type !== 'wide') s.balls += 1;
    const r = d.runs_off_bat || 0;
    s.runs += r;
    if (r === 4) s.fours += 1;
    if (r === 6) s.sixes += 1;
  }
  // Mark dismissed batsmen
  for (const d of deliveries) {
    if (!d.is_wicket) continue;
    const outId = d.batsman_out_id || d.batsman_id;
    if (batMap.has(outId)) batMap.get(outId).isOut = true;
  }

  // Build bowling rows from deliveries
  const bowlOrder = [];
  const bowlMap = new Map();
  for (const d of deliveries) {
    const pid = d.bowler_id;
    if (!pid) continue;
    if (!bowlMap.has(pid)) {
      bowlOrder.push(pid);
      bowlMap.set(pid, { name: d.bowler?.name || pid, legal_balls: 0, runs: 0, wickets: 0 });
    }
    const s = bowlMap.get(pid);
    if (d.is_legal_delivery) s.legal_balls += 1;
    const isBye = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
    s.runs += isBye ? 0 : total;
    if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type)) s.wickets += 1;
  }

  const extras = deliveries.reduce((acc, d) => {
    if (d.extra_type === 'wide') acc.wides += d.extra_runs || 0;
    else if (d.extra_type === 'no_ball') acc.no_balls += d.extra_runs || 0;
    else if (d.extra_type === 'bye') acc.byes += d.extra_runs || 0;
    else if (d.extra_type === 'leg_bye') acc.leg_byes += d.extra_runs || 0;
    return acc;
  }, { wides: 0, no_balls: 0, byes: 0, leg_byes: 0 });
  const totalExtras = extras.wides + extras.no_balls + extras.byes + extras.leg_byes;
  const extrasStr = [
    extras.no_balls > 0 ? `NB ${extras.no_balls}` : null,
    extras.wides > 0 ? `W ${extras.wides}` : null,
    extras.byes > 0 ? `B ${extras.byes}` : null,
    extras.leg_byes > 0 ? `LB ${extras.leg_byes}` : null,
  ].filter(Boolean).join(', ');

  return (
    <div className="border-t border-ink-100 dark:border-white/10">
      <div className="flex border-b border-ink-100 dark:border-white/10">
        {[['bat', 'Batting'], ['bowl', 'Bowling']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === key ? 'text-ink-900 dark:text-white border-b-2 border-ink-900 dark:border-white -mb-px' : 'text-ink-400'}`}
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
              {batOrder.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-ink-400">No deliveries recorded</td></tr>
              )}
              {batOrder.map((pid, i) => {
                const s = batMap.get(pid);
                return (
                  <tr key={i} className="border-b border-ink-50 dark:border-white/[0.05]">
                    <td className="py-2 pl-3 pr-2">
                      <div className="font-medium text-ink-800 dark:text-ink-100">{s.name}</div>
                      <div className="text-[10px] text-ink-400">{wicketDismissalText(deliveries, pid)}</div>
                    </td>
                    <td className="py-2 px-2 text-right font-bold tabular-nums">{s.runs}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{s.balls}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{s.fours}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{s.sixes}</td>
                    <td className="py-2 px-2 pr-3 text-right tabular-nums text-ink-500">
                      {s.balls > 0 ? fmt(calcStrikeRate(s.runs, s.balls), 1) : '-'}
                    </td>
                  </tr>
                );
              })}
              {deliveries.length > 0 && (
                <tr className="border-b border-ink-50 dark:border-white/[0.05]">
                  <td className="py-2 pl-5 pr-2 text-ink-500" colSpan={5}>
                    Extras{extrasStr ? <span className="text-ink-400 ml-1">({extrasStr})</span> : ''}
                  </td>
                  <td className="py-2 px-2 pr-3 text-right font-semibold tabular-nums">{totalExtras}</td>
                </tr>
              )}
              <tr className="font-semibold">
                <td className="py-2 pl-5 pr-2 text-ink-700 dark:text-ink-200" colSpan={2}>Total</td>
                <td className="py-2 px-2 pr-3 text-right tabular-nums text-ink-700 dark:text-ink-200" colSpan={4}>
                  {innings.total_runs}/{innings.total_wickets} ({formatOvers(innings.total_legal_balls)} ov)
                </td>
              </tr>
            </tbody>
          </table>
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
              {bowlOrder.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-ink-400">No deliveries recorded</td></tr>
              )}
              {bowlOrder.map((pid, i) => {
                const s = bowlMap.get(pid);
                return (
                  <tr key={i} className="border-b border-ink-50 dark:border-white/[0.05]">
                    <td className="py-2 pl-3 pr-2 font-medium text-ink-800 dark:text-ink-100">{s.name}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatOvers(s.legal_balls)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">-</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-500">{s.runs}</td>
                    <td className="py-2 px-2 text-right font-bold tabular-nums">{s.wickets}</td>
                    <td className="py-2 px-2 pr-3 text-right tabular-nums text-ink-500">
                      {s.legal_balls > 0 ? fmt(calcEconomy(s.runs, s.legal_balls), 2) : '-'}
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

export default function LiveScoring() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useOfflineSync();
  const store = useMatchStore();
  const { match, matchPlayers, currentInnings, innings, battingScorecards, bowlingScorecards, striker, nonStriker, bowler, prevBowler, freeHit, deliveries, undoAvailable } = store;

  const [wicketOpen, setWicketOpen] = useState(false);
  const [newBatsmanOpen, setNewBatsmanOpen] = useState(false);
  const [bowlerModalOpen, setBowlerModalOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [firstInningsData, setFirstInningsData] = useState(null);
  const [showFirstInnings, setShowFirstInnings] = useState(false);
  const [batsmanOutId, setBatsmanOutId] = useState(null);
  const [winConfirmOpen, setWinConfirmOpen] = useState(false);
  const [winConfirmInfo, setWinConfirmInfo] = useState(null);
  const endingMatchRef = useRef(false);

  useEffect(() => { store.loadMatch(id); return () => store.reset(); }, [id]);

  // Load first innings scorecards when viewing second innings
  useEffect(() => {
    const firstInnings = innings.find(i => i.innings_number === 1);
    if (!firstInnings || currentInnings?.innings_number !== 2) return;
    (async () => {
      try {
        const [cards, dels] = await Promise.all([
          matchService.getScorecards(firstInnings.id),
          matchService.getDeliveries(firstInnings.id),
        ]);
        setFirstInningsData({ innings: firstInnings, batting: cards.batting, bowling: cards.bowling, deliveries: dels });
      } catch { /* non-critical — panel stays empty */ }
    })();
  }, [innings.length, currentInnings?.innings_number]);

  const battingTeam = currentInnings?.batting_team;
  const bowlingTeam = battingTeam === 1 ? 2 : 1;

  const jokerId = match?.joker_player_id;
  const unique = arr => [...new Map(arr.map(p => [p.id, p])).values()];
  const teamPlayers = team => unique(matchPlayers.filter(mp => mp.team === team || mp.team === 0).map(mp => mp.players));

  // Exclude joker from batting side when joker is currently bowling (and vice versa)
  const battingTeamPlayers = teamPlayers(battingTeam).filter(p =>
    !(p.id === jokerId && p.id === bowler)
  );
  const bowlingTeamPlayers = teamPlayers(bowlingTeam).filter(p =>
    !(p.id === jokerId && (p.id === striker || p.id === nonStriker))
  );

  // Derive dismissed batsmen from deliveries (DB batting_scorecards not reliably updated by RPC)
  // Union of two sources — deliveries are accurate for current session; DB scorecards catch cross-session or RPC-written data
  const outIdsFromDeliveries = deliveries
    .filter(d => d.is_wicket)
    .map(d => d.batsman_out_id || d.batsman_id)
    .filter(Boolean);
  const outIdsFromDB = battingScorecards
    .filter(b => b.status === 'out' || b.status === 'retired_out')
    .map(b => b.player_id);
  const outIds = [...new Set([...outIdsFromDeliveries, ...outIdsFromDB])];

  // Players who have batted but are currently off field (retired hurt) — they can return but shouldn't appear as "new" batsman
  const retiredHurtIds = battingScorecards
    .filter(b => b.status === 'retired_hurt')
    .map(b => b.player_id)
    .filter(id => id !== striker && id !== nonStriker);

  const batsmenCandidates = battingTeamPlayers.filter(
    p => p.id !== striker && p.id !== nonStriker && !outIds.includes(p.id) && !retiredHurtIds.includes(p.id)
  );

  // True only when the literal last batsman is alone mid-innings (LMS mode, no candidates, play has started)
  const lastManAlone = !!(match?.last_man_standing && batsmenCandidates.length === 0 && outIds.length > 0 && striker);

  const overNumber = currentInnings ? Math.floor(currentInnings.total_legal_balls / 6) + 1 : 1;
  const maxOvers = match?.max_overs_per_bowler;
  const bowlerLegalBalls = id2 => bowlingScorecards.find(b => b.player_id === id2)?.legal_balls || 0;
  const bowlerEligible = p => {
    if (p.id === prevBowler) return false;
    if (match?.joker_player_id === p.id && (match.joker_player_id === striker || match.joker_player_id === nonStriker)) return false;
    if (maxOvers && Math.floor(bowlerLegalBalls(p.id) / 6) >= maxOvers) return false;
    return true;
  };
  const eligibleBowlers = bowlingTeamPlayers.filter(bowlerEligible);

  useEffect(() => {
    if (winConfirmOpen) { setBowlerModalOpen(false); return; }
    if (currentInnings && !currentInnings.is_completed && !bowler) setBowlerModalOpen(true);
  }, [bowler, currentInnings, winConfirmOpen]);

  const winInfo = useWinCondition({ match, currentInnings, innings });

  // End innings when all batsmen are out
  useEffect(() => {
    if (!currentInnings || currentInnings.is_completed || !match) return;
    const teamSize = match.team_size || 11;
    const wicketLimit = match.last_man_standing ? teamSize : teamSize - 1;
    if (currentInnings.total_wickets >= wicketLimit) {
      if (currentInnings.innings_number === 1) {
        // 1st innings all-out: transition straight to 2nd innings, no confirmation
        handleEndInnings();
      } else {
        // 2nd innings all-out: bowling team wins — ask before ending match
        setWinConfirmInfo({ summary: null, winInfo: null, reason: 'allout' });
        setWinConfirmOpen(true);
      }
    }
  }, [currentInnings?.total_wickets, match?.last_man_standing]);

  useEffect(() => {
    if (winInfo?.won && match.status !== 'completed' && !endingMatchRef.current) {
      // Show confirmation sheet — scorer may need to undo a no-ball re-bowl etc.
      setWinConfirmInfo({ summary: winInfo.summary, winInfo });
      setWinConfirmOpen(true);
    }
  }, [winInfo]);

  async function confirmEndMatch() {
    endingMatchRef.current = true;
    setWinConfirmOpen(false);
    if (winConfirmInfo?.winInfo) {
      setResult(winConfirmInfo.summary);
      await store.endInnings();
      await store.setMatchStatus('completed', {
        result_type: winConfirmInfo.winInfo.type,
        result_summary: winConfirmInfo.winInfo.summary,
        winning_team_name: winConfirmInfo.winInfo.winner,
        winning_margin: winConfirmInfo.winInfo.margin,
      });
    } else {
      // All-out in 2nd innings — end innings then navigate to summary
      await handleEndInnings();
    }
  }

  async function undoFromWinConfirm() {
    endingMatchRef.current = false;
    setWinConfirmOpen(false);
    setWinConfirmInfo(null);
    await store.undo();
  }

  if (!match || !currentInnings) return <div className="p-4">Loading…</div>;

  const battingTeamName = battingTeam === 1 ? match.team1_name : match.team2_name;
  const strikerObj = battingTeamPlayers.find(p => p.id === striker);
  const nonStrikerObj = battingTeamPlayers.find(p => p.id === nonStriker);
  const bowlerObj = bowlingTeamPlayers.find(p => p.id === bowler);
  const bowlerCard = bowlingScorecards.find(b => b.player_id === bowler);

  // Compute live batting + bowling stats from deliveries (DB scorecards lag mid-over)
  const liveBatMap = deliveries.reduce((map, d) => {
    const pid = d.batsman_id;
    if (!pid) return map;
    if (!map[pid]) map[pid] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    if (d.extra_type !== 'wide') map[pid].balls += 1;
    const r = d.runs_off_bat || 0;
    map[pid].runs += r;
    if (r === 4) map[pid].fours += 1;
    if (r === 6) map[pid].sixes += 1;
    return map;
  }, {});

  const liveBowlMap = deliveries.reduce((map, d) => {
    const pid = d.bowler_id;
    if (!pid) return map;
    if (!map[pid]) map[pid] = { legal_balls: 0, runs_conceded: 0, wickets: 0 };
    if (d.is_legal_delivery) map[pid].legal_balls += 1;
    const isByeOrLB = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
    const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
    map[pid].runs_conceded += isByeOrLB ? 0 : total;
    if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type)) {
      map[pid].wickets += 1;
    }
    return map;
  }, {});

  function liveCard(pid) {
    const db = battingScorecards.find(b => b.player_id === pid);
    const live = liveBatMap[pid];
    if (!live && !db) return null;
    return { ...(db || {}), runs: live?.runs ?? db?.runs ?? 0, balls_faced: live?.balls ?? db?.balls_faced ?? 0 };
  }

  const strikerCard = liveCard(striker);
  const nonStrikerCard = liveCard(nonStriker);

  const liveBowlerCard = bowler ? liveBowlMap[bowler] : null;

  // Current-over stats for the active bowler (resets each over, so header never inherits previous-over balls)
  const currentOverNumber = Math.floor((currentInnings?.total_legal_balls ?? 0) / 6);
  const currentOverStats = bowler
    ? deliveries
        .filter(d => d.bowler_id === bowler && d.over_number === currentOverNumber)
        .reduce(
          (acc, d) => {
            if (d.is_legal_delivery) acc.legal_balls += 1;
            const isByeOrLB = d.extra_type === 'bye' || d.extra_type === 'leg_bye';
            const total = d.total_runs_on_delivery ?? ((d.runs_off_bat || 0) + (d.extra_runs || 0));
            acc.runs_conceded += isByeOrLB ? 0 : total;
            if (d.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(d.wicket_type))
              acc.wickets += 1;
            return acc;
          },
          { legal_balls: 0, runs_conceded: 0, wickets: 0 }
        )
    : null;

  const joker = jokerId ? matchPlayers.find(mp => mp.player_id === jokerId)?.players : null;

  async function needOpeners() {
    if (!striker || (!nonStriker && !lastManAlone)) {
      toast.error('Select opening batsmen first');
      return true;
    }
    return false;
  }

  async function handleRuns(runs) {
    if (await needOpeners()) return;
    if (!bowler) { toast.error('Select a bowler'); return; }
    await store.scoreBall({ runsOffBat: runs });
  }

  async function handleExtra(extraType, extraRuns) {
    if (await needOpeners()) return;
    if (!bowler) { toast.error('Select a bowler'); return; }
    const runsOffBat = extraType === 'bye' || extraType === 'leg_bye' ? 0 : 0;
    await store.scoreBall({ runsOffBat, extraType, extraRuns: extraType === 'wide' || extraType === 'no_ball' ? Math.max(extraRuns, 1) : extraRuns });
  }

  function handleWicketConfirm({ wicketType, fielderId, batsmanOutId: outId, crossed }) {
    const resolvedOutId = outId || striker;
    setWicketOpen(false);
    setBatsmanOutId(resolvedOutId);
    store.scoreBall({ runsOffBat: 0, isWicket: true, wicketType, fielderId, batsmanOutId: resolvedOutId }).then(() => {
      // After scoreBall, batsmenCandidates reflects updated state.
      // In last_man_standing, if no candidates remain, set the survivor as sole striker (no modal needed).
      const candidates = batsmenCandidates;
      if (match?.last_man_standing && candidates.length === 0) {
        const survivor = resolvedOutId === store.striker ? store.nonStriker : store.striker;
        if (survivor) store.setOpeners(survivor, null);
        // innings will auto-end via the wicket-limit useEffect
      } else {
        setNewBatsmanOpen(true);
      }
    });
  }

  function handleNewBatsman(playerId) {
    setNewBatsmanOpen(false);
    // striker/nonStriker here are post-scoreBall values (component re-renders before user picks batsman).
    // If scoreBall ran an over-end swap, these already reflect the swapped positions.
    if (!store.nonStriker || batsmanOutId === store.striker) {
      store.setOpeners(playerId, store.nonStriker);
    } else {
      store.setOpeners(store.striker, playerId);
    }
    setBatsmanOutId(null);
  }

  async function handleRetire(playerId) {
    await store.retireBatsman(playerId);
    setNewBatsmanOpen(true);
  }

  function handleBowlerSelect(bowlerId) {
    store.setBowler(bowlerId);
    setBowlerModalOpen(false);
  }

  async function handleAbandon() {
    await matchService.deleteMatch(id);
    navigate('/matches');
  }

  async function handleEndInnings() {
    await store.endInnings('manual');
    if (currentInnings.innings_number === 1) {
      await store.startInnings(bowlingTeam, currentInnings.total_runs + 1);
      toast.success('Second innings started');
    } else {
      navigate(`/matches/${id}/summary`);
    }
  }

  return (
    <div className="pb-72">
      <OfflineBanner visible={!isOnline} />
      <div className="flex items-center justify-between px-4 pt-3 pb-1 gap-2">
        <button onClick={() => navigate('/matches')} className="flex items-center gap-1 text-sm text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white flex-shrink-0">
          ← Matches
        </button>
        <button onClick={handleEndInnings} className="flex-1 text-xs font-semibold text-ink-600 dark:text-ink-200 border border-ink-200 dark:border-white/20 px-3 py-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
          End Innings
        </button>
        <button onClick={() => setAbandonOpen(true)} className="flex-shrink-0 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
          Abandon
        </button>
      </div>
      <Scoreboard match={match} innings={currentInnings} battingTeamName={battingTeamName} />
      <PowerplayBanner match={match} innings={currentInnings} />
      <FreehitBanner active={freeHit} />

      <div className="p-3 space-y-3">
        {(!striker || (!nonStriker && !lastManAlone)) ? (
          <div className="card p-3 space-y-2">
            <p className="text-sm font-medium">Select opening batsmen</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                onChange={e => {
                  if (e.target.value && e.target.value === nonStriker) {
                    toast.error('Striker and non-striker must be different players');
                    return;
                  }
                  store.setOpeners(e.target.value, nonStriker);
                }}
                value={striker || ''}
                className="field-input !py-2 text-sm"
              >
                <option value="">Striker</option>
                {battingTeamPlayers.filter(p => p.id !== nonStriker).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                onChange={e => {
                  if (e.target.value && e.target.value === striker) {
                    toast.error('Non-striker and striker must be different players');
                    return;
                  }
                  store.setOpeners(striker, e.target.value);
                }}
                value={nonStriker || ''}
                className="field-input !py-2 text-sm"
              >
                <option value="">Non-striker</option>
                {battingTeamPlayers.filter(p => p.id !== striker).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <StrikerIndicator
            striker={strikerObj} nonStriker={nonStrikerObj}
            strikerCard={strikerCard} nonStrikerCard={nonStrikerCard}
            onSwap={store.swapStriker}
            onRetire={handleRetire}
          />
        )}

        {bowlerObj ? (
          <div className="card p-3 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-sm">Bowler: <strong>{bowlerObj.name}</strong></span>
              {currentOverStats && (
                <span className="text-xs text-gray-500 ml-2">
                  {currentOverStats.legal_balls}/6 balls · {currentOverStats.runs_conceded}R
                  {currentOverStats.wickets > 0 && ` · ${currentOverStats.wickets}W`}
                  {liveBowlerCard && liveBowlerCard.legal_balls > currentOverStats.legal_balls && (
                    <span className="ml-1 text-gray-400">(spell: {Math.floor(liveBowlerCard.legal_balls / 6)}.{liveBowlerCard.legal_balls % 6} ov {liveBowlerCard.runs_conceded}R {liveBowlerCard.wickets}W)</span>
                  )}
                </span>
              )}
            </div>
            <button onClick={() => setBowlerModalOpen(true)} className="flex-shrink-0 text-xs font-medium text-brand-blue dark:text-cricket-gold hover:underline">
              Change
            </button>
          </div>
        ) : (
          <button
            onClick={() => setBowlerModalOpen(true)}
            className="w-full card p-3 flex items-center justify-between gap-2 border-2 border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/5"
          >
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">⚠ No bowler selected — tap to select</span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-lg">Select</span>
          </button>
        )}

        <JokerPanel
          joker={joker}
          isBatting={jokerId === striker || jokerId === nonStriker}
          isBowling={jokerId === bowler}
          onCallToBat={() => toast('Send joker in via "Select opening batsmen" / new batsman flow')}
          onCallToBowl={() => setBowlerModalOpen(true)}
        />

        {/* First innings summary — visible during 2nd innings */}
        {firstInningsData && (
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowFirstInnings(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink-700 dark:text-ink-200"
            >
              <span>
                1st Innings —{' '}
                {firstInningsData.innings.batting_team === 1 ? match.team1_name : match.team2_name}:{' '}
                <span className="text-ink-900 dark:text-white">
                  {firstInningsData.innings.total_runs}/{firstInningsData.innings.total_wickets}
                </span>
                <span className="text-ink-400 font-normal ml-1 text-xs">
                  ({Math.floor(firstInningsData.innings.total_legal_balls / 6)}.{firstInningsData.innings.total_legal_balls % 6} ov)
                </span>
              </span>
              <span className="text-xs text-ink-400">{showFirstInnings ? '▲' : '▼'}</span>
            </button>
            {showFirstInnings && (
              <FirstInningsScorecard data={firstInningsData} />
            )}
          </div>
        )}

        <LiveScorecardPanel
          battingTeamPlayers={battingTeamPlayers}
          bowlingTeamPlayers={bowlingTeamPlayers}
          battingScorecards={battingScorecards}
          bowlingScorecards={bowlingScorecards}
          striker={striker}
          nonStriker={nonStriker}
          bowler={bowler}
          currentInnings={currentInnings}
          deliveries={deliveries}
        />

        <BallLog deliveries={deliveries} />

      </div>

      <div className="fixed bottom-16 left-0 right-0">
        <BallInputPanel
          onRuns={handleRuns}
          onExtra={handleExtra}
          onWicket={() => setWicketOpen(true)}
          onUndo={store.undo}
          undoDisabled={!undoAvailable}
        />
      </div>

      <WicketModal
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        onConfirm={handleWicketConfirm}
        fielders={bowlingTeamPlayers}
        isFreeHit={freeHit}
        isNoBall={false}
        batsmenOnField={[strikerObj, nonStrikerObj].filter(Boolean)}
      />
      <NewBatsmanModal open={newBatsmanOpen} onClose={() => setNewBatsmanOpen(false)} candidates={batsmenCandidates} onSelect={handleNewBatsman} />
      <BowlerSelectModal open={bowlerModalOpen} onClose={() => setBowlerModalOpen(false)} eligible={eligibleBowlers} onSelect={handleBowlerSelect} forcedBowler={bowlingTeamPlayers.find(p => p.id === prevBowler)} />
      <MatchResultBanner summary={result} onClose={() => navigate(`/matches/${id}/summary`)} />
      <PlayerStatsDrawer />
      <ConfirmDialog
        open={abandonOpen}
        title="Abandon this match?"
        message="This will permanently delete the match and all deliveries. This cannot be undone."
        confirmLabel="Abandon & Delete"
        danger
        onConfirm={handleAbandon}
        onCancel={() => setAbandonOpen(false)}
      />

      <BottomSheet open={winConfirmOpen} onClose={() => {}} title="Match Result" heightClass="h-auto">
        <div className="space-y-4 pb-2">
          <div className="bg-gradient-to-br from-brand-green to-brand-teal rounded-2xl p-5 text-center text-white">
            <p className="text-lg font-bold">
              {winConfirmInfo?.summary || (winConfirmInfo?.reason === 'allout' ? 'All Out!' : 'Match Over!')}
            </p>
          </div>
          <p className="text-sm text-center text-ink-500 dark:text-ink-300">
            Was the last delivery correctly recorded? You can undo it if needed.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={undoFromWinConfirm}
              className="py-3 rounded-xl border border-ink-200 dark:border-white/10 text-sm font-semibold text-ink-700 dark:text-ink-200"
            >
              ↩ Undo Last Ball
            </button>
            <button
              onClick={confirmEndMatch}
              className="py-3 rounded-xl bg-brand-green text-white text-sm font-semibold"
            >
              End Match
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

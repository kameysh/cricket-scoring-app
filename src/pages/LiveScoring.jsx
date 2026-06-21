import { useEffect, useState, useMemo, useRef } from 'react';
import { calcStrikeRate, calcEconomy, formatOvers, fmt } from '../lib/cricketUtils';
import { supabase } from '../lib/supabase';
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
import * as playerService from '../services/playerService';
import PlayerSubSheet from '../components/match/PlayerSubSheet';
import { ArrowLeftRight } from 'lucide-react';


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
  const { match, matchPlayers, currentInnings, innings, battingScorecards, bowlingScorecards, striker, nonStriker, bowler, prevBowler, keeper, freeHit, deliveries, undoAvailable, scoringInProgress } = store;

  const [wicketOpen, setWicketOpen] = useState(false);
  const [newBatsmanOpen, setNewBatsmanOpen] = useState(false);
  const [bowlerModalOpen, setBowlerModalOpen] = useState(false);
  const [keeperModalOpen, setKeeperModalOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [firstInningsData, setFirstInningsData] = useState(null);
  const [showFirstInnings, setShowFirstInnings] = useState(false);
  const [batsmanOutId, setBatsmanOutId] = useState(null);
  const [crossedOnDismissal, setCrossedOnDismissal] = useState(false);
  const [winConfirmOpen, setWinConfirmOpen] = useState(false);
  const [winConfirmInfo, setWinConfirmInfo] = useState(null);
  const [oversLimitOpen, setOversLimitOpen] = useState(false);
  const [superOverOpen, setSuperOverOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [allPlayers, setAllPlayers] = useState([]);
  const [matchNumber, setMatchNumber] = useState(null);
  const endingMatchRef = useRef(false);
  const winHandledRef = useRef(false);
  const milestonesRef = useRef(new Set());
  useEffect(() => { store.loadMatch(id); return () => store.reset(); }, [id]);
  useEffect(() => { matchService.getMatchNumber(id).then(n => setMatchNumber(n)).catch(() => {}); }, [id]);

  // Redirect completed matches to summary — only kameshwaran26@gmail.com can re-enter
  useEffect(() => {
    if (!match) return;
    if (match.status === 'completed') {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email !== 'kameshwaran26@gmail.com') {
          navigate(`/matches/${id}/summary`, { replace: true });
        }
      });
    }
  }, [match]);

  // Reset milestone + win-handled tracking when innings changes
  useEffect(() => {
    milestonesRef.current = new Set();
    winHandledRef.current = false;
  }, [currentInnings?.id]);

  // Load first innings scorecards when viewing second innings
  useEffect(() => {
    const firstInnings = innings.find(i => i.innings_number === 1);
    if (!firstInnings || currentInnings?.innings_number !== 2) return;
    let cancelled = false;
    (async () => {
      try {
        const [cards, dels] = await Promise.all([
          matchService.getScorecards(firstInnings.id),
          matchService.getDeliveries(firstInnings.id),
        ]);
        if (!cancelled) setFirstInningsData({ innings: firstInnings, batting: cards.batting, bowling: cards.bowling, deliveries: dels });
      } catch { /* non-critical — panel stays empty */ }
    })();
    return () => { cancelled = true; };
  }, [innings.length, currentInnings?.innings_number]);

  const battingTeam = currentInnings?.batting_team;
  const bowlingTeam = battingTeam === 1 ? 2 : 1;

  const jokerId = match?.joker_player_id;
  const unique = arr => [...new Map(arr.map(p => [p.id, p])).values()];
  // Only include active players (is_active=false means subbed out). Treat missing/null as active for old rows.
  const teamPlayers = team => unique(matchPlayers.filter(mp => (mp.team === team || mp.team === 0) && mp.is_active !== false).map(mp => mp.players));

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

  const winInfo = useWinCondition({ match, currentInnings, innings });

  // Open bowler modal when bowler is unset — but not when a decision sheet is taking over
  useEffect(() => {
    if (winConfirmOpen) { setBowlerModalOpen(false); return; }
    if (!currentInnings || currentInnings.is_completed || !match) return;
    // Don't open when there's a win/tie result — winInfo effect handles the modal
    if (winInfo?.won) { setBowlerModalOpen(false); return; }
    // Don't open when the overs limit has been reached — oversLimitOpen sheet handles it
    const maxBalls = currentInnings.is_super_over ? 6 : match.total_overs * 6;
    if (currentInnings.total_legal_balls >= maxBalls) { setBowlerModalOpen(false); return; }
    if (!bowler) setBowlerModalOpen(true);
  }, [bowler, currentInnings, winConfirmOpen, winInfo?.won, match?.total_overs, currentInnings?.total_legal_balls]);

  // End innings when all batsmen are out
  useEffect(() => {
    if (!currentInnings || currentInnings.is_completed || !match) return;
    const teamSize = match.team_size || 11;
    // Super over: 2 wickets = all out; regular: team_size - 1 (or full team for last_man_standing)
    const wicketLimit = currentInnings.is_super_over
      ? 2
      : match.last_man_standing ? teamSize : teamSize - 1;
    if (currentInnings.total_wickets >= wicketLimit) {
      // Odd innings (1, 3, 5…) = first of a pair → auto-advance to next innings
      // Even innings (2, 4, 6…) → winInfo effect handles win/tie/SO prompt
      if (currentInnings.innings_number % 2 === 1) {
        handleEndInnings();
      }
    }
  }, [currentInnings?.total_wickets, match?.last_man_standing, currentInnings?.is_super_over]);

  useEffect(() => {
    if (!winInfo?.won || match.status === 'completed' || endingMatchRef.current) return;
    if (winHandledRef.current) return; // already showing a modal for this win condition
    winHandledRef.current = true;
    // Always clear the overs-limit sheet — win condition takes priority
    setOversLimitOpen(false);
    if (winInfo.type === 'tie' && match.super_over_enabled) {
      setWinConfirmOpen(false);
      setSuperOverOpen(true);
      return;
    }
    setWinConfirmInfo({ summary: winInfo.summary, winInfo });
    setWinConfirmOpen(true);
  }, [winInfo]);

  // Auto-show end-innings modal when overs limit is reached
  useEffect(() => {
    if (!currentInnings || currentInnings.is_completed || !match || !match.total_overs) return;
    // Win condition takes full priority — winInfo effect handles the modal
    if (winConfirmOpen || winInfo?.won) return;
    const maxBalls = currentInnings.is_super_over ? 6 : match.total_overs * 6;
    if (currentInnings.total_legal_balls > 0 && currentInnings.total_legal_balls >= maxBalls) {
      setOversLimitOpen(true);
    }
  }, [currentInnings?.total_legal_balls, match?.total_overs, winConfirmOpen, currentInnings?.is_super_over, winInfo?.won]);

  // Milestone toasts — 50s, 100s, 3/4/5 wicket hauls (hat-trick handled in matchStore)
  useEffect(() => {
    if (!deliveries.length) return;
    const fired = milestonesRef.current;
    const getName = pid => matchPlayers.find(mp => mp.players?.id === pid)?.players?.name || 'Player';
    const batRuns = {};
    const bowlWkts = {};
    for (const d of deliveries) {
      if (d.batsman_id) batRuns[d.batsman_id] = (batRuns[d.batsman_id] || 0) + (d.runs_off_bat || 0);
      if (d.bowler_id && d.is_wicket && ['bowled','caught','lbw','stumped','hit_wicket'].includes(d.wicket_type)) {
        bowlWkts[d.bowler_id] = (bowlWkts[d.bowler_id] || 0) + 1;
      }
    }
    for (const [pid, runs] of Object.entries(batRuns)) {
      for (const m of [30, 50, 100]) {
        const key = `bat-${m}-${pid}`;
        if (runs >= m && !fired.has(key)) {
          fired.add(key);
          const label = m === 100 ? 'CENTURY' : m === 50 ? 'FIFTY' : 'THIRTY';
          toast.success(`🏏 ${getName(pid)} ${label}!`, { duration: 4000 });
        }
      }
    }
    for (const [pid, wkts] of Object.entries(bowlWkts)) {
      for (const t of [3, 4, 5]) {
        const key = `bowl-${t}w-${pid}`;
        if (wkts >= t && !fired.has(key)) {
          fired.add(key);
          toast.success(`🎳 ${getName(pid)} takes ${t} wickets!`, { duration: 4000 });
        }
      }
    }
  }, [deliveries]);

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
      await Promise.all([matchService.autoAssignManOfMatch(id), matchService.incrementMatchesPlayed(id)]);
      // Banner shows; its "Continue" navigates to summary
    } else {
      // All-out in 2nd innings — end innings, auto-assign MoTM, navigate
      await store.endInnings('manual');
      await Promise.all([matchService.autoAssignManOfMatch(id), matchService.incrementMatchesPlayed(id)]);
      navigate(`/matches/${id}/summary`);
    }
  }



  async function undoFromWinConfirm() {
    endingMatchRef.current = false;
    winHandledRef.current = false; // allow win condition to re-evaluate after undo
    setWinConfirmOpen(false);
    setWinConfirmInfo(null);
    await store.undo();
  }

  async function handleOversLimitEndInnings() {
    // Keep oversLimitOpen=true (BallInputPanel stays disabled) until transition completes.
    // Only close it once the innings is fully ended / new innings started.
    try {
      await handleEndInnings();
    } catch (e) {
      toast.error(e?.message || 'Failed to end innings');
      return; // leave sheet open so scoring stays blocked
    }
    setOversLimitOpen(false);
  }

  async function undoFromOversLimit() {
    setOversLimitOpen(false);
    await store.undo();
  }

  if (!match || !currentInnings) return <div className="p-4">Loading…</div>;

  const battingTeamName = battingTeam === 1 ? match.team1_name : match.team2_name;
  const strikerObj = battingTeamPlayers.find(p => p.id === striker);
  const nonStrikerObj = battingTeamPlayers.find(p => p.id === nonStriker);
  const bowlerObj = bowlingTeamPlayers.find(p => p.id === bowler);
  const keeperObj = bowlingTeamPlayers.find(p => p.id === keeper);
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

  // Partnership: runs + balls since the last wicket
  const partnershipStats = (() => {
    let lastWicketIdx = -1;
    for (let i = deliveries.length - 1; i >= 0; i--) {
      if (deliveries[i].is_wicket) { lastWicketIdx = i; break; }
    }
    const since = deliveries.slice(lastWicketIdx + 1);
    const runs = since.reduce((s, d) => s + (d.total_runs_on_delivery ?? 0), 0);
    const balls = since.filter(d => d.extra_type !== 'wide').length;
    return { runs, balls };
  })();

  // Chase meter: only in 2nd innings with a target
  const chaseStats = (() => {
    const isChasing = (currentInnings?.innings_number === 2 || currentInnings?.is_super_over) && currentInnings?.target;
    if (!isChasing) return null;
    if (!match?.total_overs) return null;
    const { target, total_runs: currentRuns, total_legal_balls: ballsUsed } = currentInnings;
    const totalBalls = currentInnings.is_super_over ? 6 : match.total_overs * 6;
    const ballsRemaining = Math.max(0, totalBalls - ballsUsed);
    const runsNeeded = Math.max(0, target - currentRuns);
    const crr = ballsUsed > 0 ? (currentRuns / ballsUsed) * 6 : 0;
    const rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 0;
    return { target, currentRuns, runsNeeded, ballsRemaining, ballsUsed, crr, rrr, progress: Math.min(1, currentRuns / target) };
  })();

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
    try {
      let runsOffBat = 0;
      let finalExtraRuns = extraRuns;
      if (extraType === 'no_ball') {
        runsOffBat = extraRuns;   // runs scored by batsman (count to their score)
        finalExtraRuns = 1;        // no-ball penalty is always 1
      } else if (extraType === 'wide') {
        finalExtraRuns = extraRuns + 1; // 1 base penalty + additional runs
      }
      await store.scoreBall({ runsOffBat, extraType, extraRuns: finalExtraRuns });
    } catch (e) {
      toast.error(e?.message || 'Failed to record extra');
    }
  }

  function handleWicketConfirm({ wicketType, fielderId, batsmanOutId: outId, crossed }) {
    const resolvedOutId = outId || striker;
    setWicketOpen(false);
    setBatsmanOutId(resolvedOutId);
    setCrossedOnDismissal(crossed ?? false);
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
    // Determine where the new batsman goes:
    // - dismissed was striker + not crossed → new batsman is striker
    // - dismissed was striker + crossed     → batsmen crossed so survivor is now at striker end;
    //                                         new batsman replaces dismissed at non-striker end
    // - dismissed was non-striker + not crossed → new batsman is non-striker
    // - dismissed was non-striker + crossed     → survivor is now at non-striker end;
    //                                             new batsman replaces dismissed at striker end
    const dismissedWasStriker = batsmanOutId === store.striker ||
      (!store.nonStriker); // safety: if only one batsman was set

    const newIsStriker = dismissedWasStriker ? !crossedOnDismissal : crossedOnDismissal;

    if (newIsStriker) {
      store.setOpeners(playerId, store.nonStriker);
    } else {
      store.setOpeners(store.striker, playerId);
    }
    setBatsmanOutId(null);
    setCrossedOnDismissal(false);
  }

  async function handleRetire(playerId) {
    await store.retireBatsman(playerId);
    setNewBatsmanOpen(true);
  }

  function handleBowlerSelect(bowlerId) {
    store.setBowler(bowlerId);
    setBowlerModalOpen(false);
    // If the selected bowler is the current keeper, prompt for a new keeper
    if (bowlerId === keeper) {
      setKeeperModalOpen(true);
    }
  }

  function handleKeeperSelect(keeperId) {
    store.setKeeper(keeperId);
    setKeeperModalOpen(false);
  }

  async function handleOpenSub() {
    if (allPlayers.length === 0) {
      try {
        const ps = await playerService.listPlayers({ activeOnly: true });
        setAllPlayers(ps || []);
      } catch {
        toast.error('Could not load player list');
        return;
      }
    }
    setSubOpen(true);
  }

  async function handleSwapPlayer(outMatchPlayerId, inPlayerId, team) {
    try {
      await store.swapPlayer(outMatchPlayerId, inPlayerId, team);
      toast.success('Player swapped');
    } catch (err) {
      toast.error(err.message || 'Failed to swap player');
    }
  }

  async function handleSwapBack(benchedMatchPlayerId) {
    try {
      await store.swapBack(benchedMatchPlayerId);
      toast.success('Player returned to squad');
    } catch (err) {
      toast.error(err.message || 'Failed to swap back');
    }
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
    } else if (currentInnings.is_super_over && !currentInnings.target) {
      // First innings of any super over round — start second innings with target
      const soTarget = currentInnings.total_runs + 1;
      const otherTeam = currentInnings.batting_team === 1 ? 2 : 1;
      await store.startSuperOverInnings(otherTeam, soTarget);
      toast.success('Super Over — second team batting!');
    } else {
      // Final innings ended manually — complete the match
      await store.setMatchStatus('completed', {
        result_type: winInfo?.type ?? 'runs',
        result_summary: winInfo?.summary ?? '',
        winning_team_name: winInfo?.winner ?? null,
        winning_margin: winInfo?.margin ?? 0,
      });
      await Promise.all([matchService.autoAssignManOfMatch(id), matchService.incrementMatchesPlayed(id)]);
      navigate(`/matches/${id}/summary`);
    }
  }

  async function handleStartSuperOver() {
    // Keep superOverOpen=true (BallInputPanel stays disabled) until new innings is ready
    // Capture batting_team before endInnings clears currentInnings
    let soFirstBatter;
    if (currentInnings?.is_super_over) {
      // Successive SO: team that just batted second bats first next — order reverses each round
      soFirstBatter = currentInnings.batting_team;
    } else {
      // First SO: team that batted second in main match bats first
      const inn2 = innings.find(i => i.innings_number === 2);
      soFirstBatter = inn2?.batting_team ?? bowlingTeam;
    }
    await store.endInnings('manual');
    await store.startSuperOverInnings(soFirstBatter, null);
    // Only now close the modal — new innings state is in place
    setSuperOverOpen(false);
    setOversLimitOpen(false);
    winHandledRef.current = false; // allow the new innings' win condition to be handled
    toast.success('Super Over started! 1 over, 2 wickets max.');
    milestonesRef.current = new Set();
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
        <button onClick={handleOpenSub} className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors">
          <ArrowLeftRight size={13} /> Sub
        </button>
        <button onClick={() => setAbandonOpen(true)} className="flex-shrink-0 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
          Abandon
        </button>
      </div>
      <Scoreboard match={match} innings={currentInnings} battingTeamName={battingTeamName} matchNumber={matchNumber} />
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

        {/* Partnership tracker */}
        {striker && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-ink-50 dark:bg-white/5 text-xs">
            <span className="font-medium text-ink-600 dark:text-ink-300">Partnership</span>
            <span className="font-semibold tabular-nums text-ink-900 dark:text-white">
              {partnershipStats.runs} <span className="font-normal text-ink-400">({partnershipStats.balls}b)</span>
            </span>
          </div>
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

        <div className="card p-3 flex items-center justify-between gap-2">
          <span className="text-sm">
            Keeper:{' '}
            {keeperObj ? (
              <strong>{keeperObj.name}</strong>
            ) : (
              <span className="text-ink-400">Not set</span>
            )}
            {keeper && keeper === bowler && (
              <span className="ml-2 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">· bowling</span>
            )}
          </span>
          <button onClick={() => setKeeperModalOpen(true)} className="flex-shrink-0 text-xs font-medium text-brand-green hover:underline">
            Change
          </button>
        </div>

        <JokerPanel
          joker={joker}
          isBatting={jokerId === striker || jokerId === nonStriker}
          isBowling={jokerId === bowler}
          onCallToBat={() => toast('Send joker in via "Select opening batsmen" / new batsman flow')}
          onCallToBowl={() => setBowlerModalOpen(true)}
        />

        {/* Chase meter — 2nd innings only */}
        {chaseStats && (
          <div className="card p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-800 dark:text-white">
                Need {chaseStats.runsNeeded} off {chaseStats.ballsRemaining} ball{chaseStats.ballsRemaining !== 1 ? 's' : ''}
              </span>
              <span className="text-ink-400">Target {chaseStats.target}</span>
            </div>
            <div className="h-2 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-cricket-green transition-all duration-300"
                style={{ width: `${chaseStats.progress * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-ink-50 dark:bg-white/5 rounded-lg py-1.5">
                <p className="text-[10px] text-ink-400 uppercase tracking-wide">CRR</p>
                <p className="text-sm font-bold tabular-nums text-ink-900 dark:text-white">
                  {chaseStats.ballsUsed > 0 ? fmt(chaseStats.crr, 2) : '—'}
                </p>
              </div>
              <div className={`rounded-lg py-1.5 ${chaseStats.rrr > chaseStats.crr ? 'bg-red-50 dark:bg-red-500/10' : 'bg-green-50 dark:bg-green-500/10'}`}>
                <p className="text-[10px] text-ink-400 uppercase tracking-wide">RRR</p>
                <p className={`text-sm font-bold tabular-nums ${chaseStats.rrr > chaseStats.crr ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {chaseStats.ballsRemaining > 0 ? fmt(chaseStats.rrr, 2) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

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

        <BallLog deliveries={deliveries} matchPlayers={matchPlayers} />

      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-ink-900 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_12px_rgba(0,0,0,0.3)]">
        <BallInputPanel
          onRuns={handleRuns}
          onExtra={handleExtra}
          onWicket={() => setWicketOpen(true)}
          onUndo={store.undo}
          undoDisabled={!undoAvailable}
          disabled={scoringInProgress || oversLimitOpen || winConfirmOpen || superOverOpen}
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
        keeperId={keeper}
      />
      <NewBatsmanModal
        open={newBatsmanOpen}
        onClose={() => {
          if (batsmenCandidates.length > 0) {
            toast.error('Select a new batsman before continuing');
            return;
          }
          setNewBatsmanOpen(false);
        }}
        candidates={batsmenCandidates}
        onSelect={handleNewBatsman}
      />
      <BowlerSelectModal open={bowlerModalOpen} onClose={() => setBowlerModalOpen(false)} eligible={eligibleBowlers} onSelect={handleBowlerSelect} forcedBowler={bowlingTeamPlayers.find(p => p.id === prevBowler)} />
      <BowlerSelectModal open={keeperModalOpen} onClose={() => setKeeperModalOpen(false)} eligible={bowlingTeamPlayers.filter(p => p.id !== bowler)} onSelect={handleKeeperSelect} title="Select Wicket Keeper" />
      <MatchResultBanner summary={result} onClose={() => { setResult(null); navigate(`/matches/${id}/summary`); }} />
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

      <BottomSheet open={oversLimitOpen} onClose={() => {}} title={currentInnings?.is_super_over ? 'Super Over Complete' : `${match.total_overs} Overs Complete`} heightClass="h-auto">
        <div className="space-y-4 pb-2">
          <p className="text-sm text-center text-ink-600 dark:text-ink-300">
            {currentInnings?.is_super_over
              ? 'The super over is complete. End the innings to continue, or undo the last ball if needed.'
              : `All ${match.total_overs} overs have been bowled. End the innings to continue, or undo the last ball if a re-bowl is needed.`
            }
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={undoFromOversLimit}
              className="py-3 rounded-xl border border-ink-200 dark:border-white/10 text-sm font-semibold text-ink-700 dark:text-ink-200"
            >
              ↩ Undo Last Ball
            </button>
            <button
              onClick={handleOversLimitEndInnings}
              className="py-3 rounded-xl bg-brand-green text-white text-sm font-semibold"
            >
              End Innings
            </button>
          </div>
        </div>
      </BottomSheet>

      <PlayerSubSheet
        open={subOpen}
        onClose={() => setSubOpen(false)}
        match={match}
        matchPlayers={matchPlayers}
        allPlayers={allPlayers}
        onSwap={handleSwapPlayer}
        onSwapBack={handleSwapBack}
      />

      <BottomSheet open={superOverOpen} onClose={() => {}} title="Match Tied — Super Over!" heightClass="h-auto">
        <div className="space-y-4 pb-2">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-center text-white">
            <p className="text-2xl font-bold mb-1">⚡ Super Over</p>
            <p className="text-sm opacity-90">The match is tied. Each team faces 1 over (max 2 wickets).</p>
          </div>
          <p className="text-sm text-center text-ink-500 dark:text-ink-300">
            {(() => {
              const soFirstBatter = currentInnings?.is_super_over
                ? currentInnings.batting_team
                : (innings.find(i => i.innings_number === 2)?.batting_team ?? bowlingTeam);
              return soFirstBatter === 1 ? match.team1_name : match.team2_name;
            })()} will bat first in the super over.
          </p>
          <button
            onClick={handleStartSuperOver}
            className="w-full py-3 rounded-xl bg-brand-green text-white text-sm font-semibold"
          >
            Start Super Over ⚡
          </button>
        </div>
      </BottomSheet>

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

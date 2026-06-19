import { create } from 'zustand';
import toast from 'react-hot-toast';
import * as matchService from '../services/matchService';
import * as scoringService from '../services/scoringService';
import { detectHatTrick } from '../lib/cricketUtils';
import { supabase } from '../lib/supabase';

const OFFLINE_KEY = 'cricket_offline_queue';

function queueOffline(action) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  queue.push(action);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
}

export const useMatchStore = create((set, get) => ({
  match: null,
  matchPlayers: [],
  innings: [],
  currentInnings: null,
  battingScorecards: [],
  bowlingScorecards: [],
  fieldingScorecards: [],
  deliveries: [],
  striker: null,
  nonStriker: null,
  bowler: null,
  prevBowler: null,
  keeper: null,
  freeHit: false,
  ballsSinceWicket: [],
  undoAvailable: false,
  isOnline: navigator.onLine,
  isLoading: false,
  jokerCalledIn: false,
  statsDrawerPlayerId: null,

  setStatsDrawerPlayer(playerId) {
    set({ statsDrawerPlayerId: playerId });
  },

  async loadMatch(matchId) {
    set({ isLoading: true });
    const [match, matchPlayers, innings] = await Promise.all([
      matchService.getMatch(matchId),
      matchService.getMatchPlayers(matchId),
      matchService.getInnings(matchId),
    ]);
    const currentInnings = innings.find(i => !i.is_completed) || innings[innings.length - 1] || null;
    let battingScorecards = [], bowlingScorecards = [], fieldingScorecards = [], deliveries = [];
    if (currentInnings) {
      const cards = await matchService.getScorecards(currentInnings.id);
      battingScorecards = cards.batting;
      bowlingScorecards = cards.bowling;
      fieldingScorecards = cards.fielding;
      deliveries = await matchService.getDeliveries(currentInnings.id);
    }
    const lastBall = deliveries[deliveries.length - 1];
    const lastInnings = innings[innings.length - 1];
    const bowlingTeam = lastInnings ? (lastInnings.batting_team === 1 ? 2 : 1) : null;
    const keeperMp = matchPlayers.find(mp => mp.is_keeper && (mp.team === bowlingTeam || mp.team === 0));
    set({
      match, matchPlayers, innings, currentInnings,
      battingScorecards, bowlingScorecards, fieldingScorecards, deliveries,
      striker: lastBall?.striker_after || null,
      nonStriker: lastBall?.non_striker_after || null,
      bowler: lastBall?.bowler_id || null,
      keeper: keeperMp?.players?.id || null,
      freeHit: !!match.free_hit_on_no_ball && lastBall?.extra_type === 'no_ball' && lastBall?.is_legal_delivery === false,
      undoAvailable: deliveries.length > 0,
      isLoading: false,
    });
    return { match, currentInnings };
  },

  async startInnings(battingTeam, target = null) {
    const { match, innings, matchPlayers } = get();
    const inningsNumber = innings.length + 1;
    const newInnings = await matchService.createInnings(match.id, inningsNumber, battingTeam, target);
    const newBowlingTeam = battingTeam === 1 ? 2 : 1;
    const keeperMp = matchPlayers.find(mp => mp.is_keeper && (mp.team === newBowlingTeam || mp.team === 0));
    set({ innings: [...innings, newInnings], currentInnings: newInnings, battingScorecards: [], bowlingScorecards: [], fieldingScorecards: [], deliveries: [], striker: null, nonStriker: null, bowler: null, prevBowler: null, keeper: keeperMp?.players?.id || null, freeHit: false });
    return newInnings;
  },

  setOpeners(strikerId, nonStrikerId) {
    set({ striker: strikerId, nonStriker: nonStrikerId });
  },

  setBowler(bowlerId) {
    set({ bowler: bowlerId, prevBowler: get().bowler });
  },

  setKeeper(keeperId) {
    set({ keeper: keeperId });
  },

  swapStriker() {
    const { striker, nonStriker } = get();
    if (!nonStriker) return; // last man standing — nothing to swap
    set({ striker: nonStriker, nonStriker: striker });
  },

  async retireBatsman(playerId, status = 'retired_hurt') {
    const { currentInnings, striker, nonStriker } = get();
    if (!currentInnings) return;
    await supabase
      .from('batting_scorecards')
      .update({ status })
      .eq('innings_id', currentInnings.id)
      .eq('player_id', playerId);
    const newState = {};
    if (striker === playerId) newState.striker = null;
    if (nonStriker === playerId) newState.nonStriker = null;
    set(newState);
    await get().refreshScorecards();
    toast(`${status === 'retired_hurt' ? 'Retired hurt' : 'Retired'}`);
  },

  async scoreBall({ runsOffBat = 0, extraType = 'none', extraRuns = 0, isWicket = false, wicketType = null, fielderId = null, batsmanOutId = null, isJokerBatting = false, isJokerBowling = false }) {
    const state = get();
    const { currentInnings, striker, nonStriker, bowler, match, freeHit, deliveries } = state;
    // Allow nonStriker=null only when last man is batting alone (LMS mode + no remaining candidates)
    const outIdsSet = new Set(deliveries.filter(d => d.is_wicket).map(d => d.batsman_out_id || d.batsman_id).filter(Boolean));
    const lmsBattingTeam = currentInnings?.batting_team;
    const remaining = state.matchPlayers.filter(mp => mp.team === lmsBattingTeam || mp.team === 0)
      .filter(mp => mp.players?.id !== striker && mp.players?.id !== nonStriker && !outIdsSet.has(mp.players?.id));
    const lastManAlone = match?.last_man_standing && remaining.length === 0 && outIdsSet.size > 0;
    if (!currentInnings || !striker || (!nonStriker && !lastManAlone) || !bowler) {
      toast.error('Select batsmen and bowler first');
      return null;
    }

    const battingTeam = currentInnings.batting_team;
    const bowlingTeam = battingTeam === 1 ? 2 : 1;
    const legalSoFar = currentInnings.total_legal_balls;
    const overNumber = Math.floor(legalSoFar / 6);
    const ballNumber = (legalSoFar % 6) + 1;

    if (!state.isOnline) {
      queueOffline({ type: 'delivery', payload: { innings_id: currentInnings.id, over_number: overNumber, ball_number: ballNumber, batsman_id: striker, bowler_id: bowler, runs_off_bat: runsOffBat, extra_type: extraType, extra_runs: extraRuns, is_wicket: isWicket, wicket_type: wicketType, fielder_id: fielderId, batsman_out_id: batsmanOutId, striker_before: striker, non_striker_before: nonStriker, batting_team: battingTeam, bowling_team: bowlingTeam, is_free_hit: freeHit } });
      toast('Offline — ball queued, will sync on reconnect', { icon: '📶' });
      return null;
    }

    const result = await scoringService.recordDelivery({
      innings_id: currentInnings.id,
      over_number: overNumber,
      ball_number: ballNumber,
      batsman_id: striker,
      bowler_id: bowler,
      runs_off_bat: runsOffBat,
      extra_type: extraType,
      extra_runs: extraRuns,
      is_wicket: isWicket,
      wicket_type: wicketType,
      fielder_id: fielderId,
      batsman_out_id: batsmanOutId,
      striker_before: striker,
      non_striker_before: nonStriker,
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
      is_free_hit: freeHit,
      is_joker_batting: isJokerBatting,
      is_joker_bowling: isJokerBowling,
    });

    const updatedInnings = result.innings;
    let newStriker = isWicket ? striker : (result.swap ? nonStriker : striker);
    let newNonStriker = isWicket ? nonStriker : (result.swap ? striker : nonStriker);

    const newFreeHit = !!match.free_hit_on_no_ball && extraType === 'no_ball';

    const newDeliveries = [...deliveries, { ...result, over_number: overNumber, ball_number: ballNumber, runs_off_bat: runsOffBat, extra_type: extraType, extra_runs: extraRuns, total_runs_on_delivery: runsOffBat + extraRuns, is_wicket: isWicket, wicket_type: wicketType, batsman_out_id: batsmanOutId, bowler_id: bowler, batsman_id: striker, is_legal_delivery: result.isLegal }];

    set({
      currentInnings: updatedInnings,
      innings: get().innings.map(i => (i.id === updatedInnings.id ? updatedInnings : i)),
      striker: newStriker,
      nonStriker: newNonStriker,
      freeHit: newFreeHit,
      undoAvailable: true,
      deliveries: newDeliveries,
    });

    await get().refreshScorecards();

    const last3Legal = newDeliveries.filter(d => d.is_legal_delivery).slice(-3);
    if (detectHatTrick(last3Legal)) {
      toast.success('🎩 HAT-TRICK!', { duration: 5000 });
    }

    if (result.isLegal && updatedInnings.total_legal_balls % 6 === 0 && updatedInnings.total_legal_balls > 0) {
      await get().handleOverEnd(overNumber, bowler);
    }

    return { ...result, newStriker, newNonStriker };
  },

  async handleOverEnd(overNumber, bowlerId) {
    const isMaiden = await scoringService.finalizeOver(get().currentInnings.id, overNumber, bowlerId);
    get().swapStriker();
    await get().refreshScorecards();
    toast(`Over ${overNumber + 1} complete${isMaiden ? ' — MAIDEN!' : ''}`, { icon: '🏏' });
    set({ bowler: null, prevBowler: bowlerId });
  },

  async refreshScorecards() {
    const { currentInnings } = get();
    if (!currentInnings) return;
    const cards = await matchService.getScorecards(currentInnings.id);
    set({ battingScorecards: cards.batting, bowlingScorecards: cards.bowling, fieldingScorecards: cards.fielding });
  },

  async undo() {
    const { currentInnings, undoAvailable } = get();
    if (!undoAvailable || !currentInnings) return;
    const undone = await scoringService.undoLastDelivery(currentInnings.id);
    if (!undone) return;
    // loadMatch resets undoAvailable based on remaining deliveries count
    await get().loadMatch(get().match.id);
    const undoDesc = undone.is_wicket ? 'Wicket undone' : `${undone.runs_off_bat} run(s) undone`;
    toast(undoDesc, { icon: '↩️' });
  },

  async endInnings(reason = null) {
    const { currentInnings } = get();
    await matchService.completeInnings(currentInnings.id, reason);
    set({ currentInnings: { ...currentInnings, is_completed: true } });
  },

  async setMatchStatus(status, extra = {}) {
    const updated = await matchService.updateMatch(get().match.id, { status, ...extra });
    set({ match: updated });
    return updated;
  },

  setOnline(isOnline) {
    set({ isOnline });
  },

  async syncOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
    if (queue.length === 0) return;
    const failed = [];
    for (const action of queue) {
      if (action.type === 'delivery') {
        try {
          await scoringService.recordDelivery(action.payload);
        } catch {
          failed.push(action);
        }
      }
    }
    if (failed.length > 0) {
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(failed));
      toast.error(`${failed.length} ball(s) failed to sync — will retry`);
    } else {
      localStorage.removeItem(OFFLINE_KEY);
      toast.success(`Synced ${queue.length} offline ball(s)`);
    }
    if (get().match) await get().loadMatch(get().match.id);
  },

  reset() {
    set({
      match: null, matchPlayers: [], innings: [], currentInnings: null,
      battingScorecards: [], bowlingScorecards: [], fieldingScorecards: [], deliveries: [],
      striker: null, nonStriker: null, bowler: null, prevBowler: null, keeper: null, freeHit: false,
      undoAvailable: false, jokerCalledIn: false, statsDrawerPlayerId: null,
    });
  },
}));

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Star } from 'lucide-react';
import PlayerAvatar from '../components/player/PlayerAvatar';
import { BattingSummaryGrid, RunBreakdownGrid, BowlingSummaryGrid, FieldingSummaryGrid } from '../components/player/CareerStatCards';
import RunTypeChart from '../components/player/RunTypeChart';
import WicketTypeDonut from '../components/player/WicketTypeDonut';
import MatchHistoryTable from '../components/player/MatchHistoryTable';
import * as playerService from '../services/playerService';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import {
  calcBattingAverage, calcStrikeRate, calcBowlingAverage, calcEconomy,
  calcBowlingStrikeRate, formatOvers, formatBestFigures, fmt,
} from '../lib/cricketUtils';

const TABS = ['Batting', 'Bowling', 'Fielding', 'Match History'];

export default function PlayerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManagePlayers } = useRole();
  const [player, setPlayer] = useState(null);
  const [careerStats, setCareerStats] = useState(null);
  const [tournamentOptions, setTournamentOptions] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [scopedStats, setScopedStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [wicketCounts, setWicketCounts] = useState({});
  const [tab, setTab] = useState(0);
  const [isJoker, setIsJoker] = useState(false);

  useEffect(() => {
    playerService.getPlayer(id).then(setPlayer);
    playerService.getCareerStats(id).then(setCareerStats);
    playerService.getPlayerTournaments(id).then(rows => setTournamentOptions(rows.map(r => r.tournaments)));
    playerService.getMatchHistory(id).then(setHistory);

    supabase.from('match_players').select('team').eq('player_id', id).eq('team', 0).then(({ data }) => setIsJoker((data || []).length > 0));

    supabase
      .from('deliveries')
      .select('wicket_type')
      .eq('bowler_id', id)
      .eq('is_wicket', true)
      .in('wicket_type', ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'])
      .then(({ data }) => {
        const counts = {};
        (data || []).forEach(d => { counts[d.wicket_type] = (counts[d.wicket_type] || 0) + 1; });
        setWicketCounts(counts);
      });
  }, [id]);

  useEffect(() => {
    if (!selectedTournament) { setScopedStats(null); return; }
    playerService.getTournamentStats(id, selectedTournament).then(setScopedStats);
  }, [selectedTournament, id]);

  if (!player) return null;

  const stats = selectedTournament ? scopedStats : careerStats;
  const empty = {
    bat_matches: 0, bat_innings: 0, bat_not_outs: 0, bat_runs: 0, bat_balls: 0,
    bat_highest_score: 0, bat_ones: 0, bat_twos: 0, bat_threes: 0, bat_fours: 0,
    bat_sixes: 0, bat_dot_balls: 0, bat_ducks: 0, bat_fifties: 0, bat_hundreds: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0, bowl_wickets: 0,
    bowl_maidens: 0, bowl_best_wickets: 0, bowl_best_runs: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    field_matches: 0, field_catches: 0, field_stumpings: 0, field_run_outs: 0,
  };
  const s = stats || empty;

  const battingDerived = {
    average: fmt(calcBattingAverage(s.bat_runs, s.bat_innings, s.bat_not_outs)),
    strikeRate: fmt(calcStrikeRate(s.bat_runs, s.bat_balls)),
  };
  const bowlingDerived = {
    overs: formatOvers(s.bowl_legal_balls),
    average: fmt(calcBowlingAverage(s.bowl_runs, s.bowl_wickets)),
    economy: fmt(calcEconomy(s.bowl_runs, s.bowl_legal_balls)),
    strikeRate: fmt(calcBowlingStrikeRate(s.bowl_legal_balls, s.bowl_wickets)),
    bestFigures: formatBestFigures(s.bowl_best_wickets, s.bowl_best_runs),
  };

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/players');
  }

  return (
    <div className="p-4 space-y-4 page-transition">
      <button onClick={goBack} className="flex items-center gap-1.5 text-sm font-medium text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white mb-1">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex items-center gap-3">
        <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{player.name}</h1>
            {isJoker && <Star size={16} className="text-cricket-gold fill-cricket-gold" />}
          </div>
          <p className="text-xs text-gray-500">{[player.batting_style, player.bowling_style].filter(Boolean).join(' · ')}</p>
        </div>
        {canManagePlayers && (
          <Link to={`/players/${id}/edit`} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600">
            <Pencil size={16} />
          </Link>
        )}
      </div>

      <select value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm">
        <option value="">All time</option>
        {tournamentOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${tab === i ? 'bg-cricket-green text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="space-y-3">
          <BattingSummaryGrid stats={s} derived={battingDerived} />
          <RunBreakdownGrid stats={s} />
          <RunTypeChart stats={s} />
        </div>
      )}

      {tab === 1 && (
        <div className="space-y-3">
          <BowlingSummaryGrid stats={s} derived={bowlingDerived} />
          <WicketTypeDonut counts={wicketCounts} />
        </div>
      )}

      {tab === 2 && <FieldingSummaryGrid stats={s} />}

      {tab === 3 && <MatchHistoryTable history={history} />}
    </div>
  );
}

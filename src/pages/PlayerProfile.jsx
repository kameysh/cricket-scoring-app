import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Star, Repeat2, X } from 'lucide-react';
import * as seriesService from '../services/seriesService';
import PlayerAvatar from '../components/player/PlayerAvatar';
import RunTypeChart from '../components/player/RunTypeChart';
import WicketTypeDonut from '../components/player/WicketTypeDonut';
import MatchHistoryTable from '../components/player/MatchHistoryTable';
import FormSparkline from '../components/player/FormSparkline';
import HeadToHeadPanel from '../components/player/HeadToHeadPanel';
import PlayerBadges from '../components/player/PlayerBadges';
import * as playerService from '../services/playerService';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import {
  calcBattingAverage, calcStrikeRate, calcBowlingAverage, calcEconomy,
  calcBowlingStrikeRate, formatOvers, formatBestFigures, fmt,
} from '../lib/cricketUtils';

const TAB_LABELS = ['Bat', 'Bowl', 'Field', 'History', 'H2H'];

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-50 dark:border-white/5 last:border-0">
      <span className="text-sm text-ink-500 dark:text-ink-400">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-brand-green' : 'text-ink-900 dark:text-white'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function StatSection({ title, children }) {
  return (
    <div className="card px-4 py-1 mx-0">
      {title && <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-widest pt-3 pb-1">{title}</p>}
      {children}
    </div>
  );
}

export default function PlayerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManagePlayers, userId } = useRole();
  const [player, setPlayer] = useState(null);
  const [careerStats, setCareerStats] = useState(null);
  const [tournamentOptions, setTournamentOptions] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [scopedStats, setScopedStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [wicketCounts, setWicketCounts] = useState({});
  const [tab, setTab] = useState(0);
  const [isJoker, setIsJoker] = useState(false);
  const [duckHunterCount, setDuckHunterCount] = useState(0);
  const [allStats, setAllStats] = useState([]);
  const [searchParams] = useSearchParams();
  const seriesId = searchParams.get('series') || '';
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [seriesStats, setSeriesStats] = useState(null);
  const [seriesMatchIds, setSeriesMatchIds] = useState(null); // null = no filter
  const [seriesInningsIds, setSeriesInningsIds] = useState(null);
  const [seriesHistory, setSeriesHistory] = useState(null);

  useEffect(() => {
    playerService.getPlayer(id).then(setPlayer);
    playerService.getCareerStats(id).then(setCareerStats);
    playerService.getPlayerTournaments(id).then(rows => setTournamentOptions(rows.map(r => r.tournaments)));
    playerService.getMatchHistory(id).then(setHistory);
    playerService.getDuckHunterCount(id).then(setDuckHunterCount);
    playerService.getAllCareerStats().then(setAllStats);

    supabase.from('match_players').select('team').eq('player_id', id).eq('team', 0)
      .then(({ data }) => setIsJoker((data || []).length > 0));

    supabase
      .from('deliveries').select('wicket_type')
      .eq('bowler_id', id).eq('is_wicket', true)
      .in('wicket_type', ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'])
      .then(({ data }) => {
        const counts = {};
        (data || []).forEach(d => { counts[d.wicket_type] = (counts[d.wicket_type] || 0) + 1; });
        setWicketCounts(counts);
      });
  }, [id]);

  // Load series-scoped data when ?series= param present
  useEffect(() => {
    if (!seriesId) {
      setSeriesInfo(null); setSeriesStats(null);
      setSeriesMatchIds(null); setSeriesInningsIds(null); setSeriesHistory(null);
      return;
    }
    seriesService.getSeries(seriesId).then(setSeriesInfo).catch(() => {});
    playerService.getPlayerSeriesStats(id, seriesId).then(setSeriesStats).catch(() => {});
    playerService.getSeriesMatchIds(seriesId).then(async mIds => {
      setSeriesMatchIds(mIds);
      if (!mIds.length) { setSeriesInningsIds([]); setSeriesHistory([]); return; }
      const { data: inningsData } = await supabase.from('innings').select('id').in('match_id', mIds);
      setSeriesInningsIds((inningsData || []).map(i => i.id));
      // filter match history to series matches
      const { data: mpRows } = await supabase.from('match_players').select('match_id').eq('player_id', id).in('match_id', mIds);
      const playerMatchIds = (mpRows || []).map(r => r.match_id);
      if (!playerMatchIds.length) { setSeriesHistory([]); return; }
      const { data: matches } = await supabase.from('matches').select('*, venues(name,city), tournaments(name)').in('id', playerMatchIds).order('created_at', { ascending: false });
      const { data: inns } = await supabase.from('innings').select('id, match_id, innings_number').in('match_id', playerMatchIds);
      const innsIds = (inns || []).map(i => i.id);
      const [batting, bowling, fielding] = await Promise.all([
        supabase.from('batting_scorecards').select('*').eq('player_id', id).in('innings_id', innsIds),
        supabase.from('bowling_scorecards').select('*').eq('player_id', id).in('innings_id', innsIds),
        supabase.from('fielding_scorecards').select('*').eq('player_id', id).in('innings_id', innsIds),
      ]);
      const result = (matches || []).map(match => {
        const mInns = (inns || []).filter(i => i.match_id === match.id).map(i => i.id);
        return {
          match,
          batting: (batting.data || []).find(b => mInns.includes(b.innings_id)),
          bowling: (bowling.data || []).find(b => mInns.includes(b.innings_id)),
          fielding: (fielding.data || []).find(b => mInns.includes(b.innings_id)),
        };
      });
      setSeriesHistory(result);
    }).catch(() => {});
  }, [seriesId, id]);

  useEffect(() => {
    if (!selectedTournament) { setScopedStats(null); return; }
    playerService.getTournamentStats(id, selectedTournament).then(setScopedStats);
  }, [selectedTournament, id]);

  if (!player) return null;

  // Series scope takes priority over tournament scope
  const stats = seriesId
    ? (seriesStats || careerStats)
    : (selectedTournament ? scopedStats : careerStats);
  const empty = {
    bat_matches: 0, bat_innings: 0, bat_not_outs: 0, bat_runs: 0, bat_balls: 0,
    bat_highest_score: 0, bat_ones: 0, bat_twos: 0, bat_threes: 0, bat_fours: 0,
    bat_sixes: 0, bat_dot_balls: 0, bat_ducks: 0, bat_thirties: 0, bat_fifties: 0, bat_hundreds: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0, bowl_wickets: 0,
    bowl_maidens: 0, bowl_best_wickets: 0, bowl_best_runs: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    field_matches: 0, field_catches: 0, field_stumpings: 0, field_run_outs: 0,
  };
  const s = stats || empty;

  const batAvg = fmt(calcBattingAverage(s.bat_runs, s.bat_innings, s.bat_not_outs));
  const batSR  = fmt(calcStrikeRate(s.bat_runs, s.bat_balls));
  const bowlAvg = fmt(calcBowlingAverage(s.bowl_runs, s.bowl_wickets));
  const bowlEco = fmt(calcEconomy(s.bowl_runs, s.bowl_legal_balls));
  const bowlSR  = fmt(calcBowlingStrikeRate(s.bowl_legal_balls, s.bowl_wickets));
  const overs   = formatOvers(s.bowl_legal_balls);
  const best    = formatBestFigures(s.bowl_best_wickets, s.bowl_best_runs);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/players');
  }

  const canEdit = canManagePlayers || (player?.user_id && player.user_id === userId);

  return (
    <div className="page-transition">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-brand-green to-brand-teal">
        {/* Back / Edit row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          {canEdit && (
            <Link
              to={`/players/${id}/edit`}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <Pencil size={15} />
            </Link>
          )}
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center px-4 pb-4 text-center">
          <div className="ring-4 ring-white/30 rounded-full mb-3">
            <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={72} />
          </div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-white">{player.name}</h1>
            {isJoker && <Star size={15} className="text-yellow-300 fill-yellow-300" />}
          </div>
          <p className="text-[13px] text-white/70 mt-0.5">
            {[player.batting_style, player.bowling_style].filter(Boolean).join(' · ') || 'No style set'}
          </p>
        </div>

        {/* Key-stats strip */}
        <div className="flex border-t border-white/20">
          {[
            { label: 'Runs',    value: s.bat_runs },
            { label: 'Wickets', value: s.bowl_wickets },
            { label: 'Matches', value: s.bat_matches },
          ].map((st, i) => (
            <div key={st.label} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-white/20' : ''}`}>
              <p className="text-xl font-bold text-white tabular-nums">{st.value ?? 0}</p>
              <p className="text-[10px] text-white/65 mt-0.5 uppercase tracking-wide">{st.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="px-4 space-y-4 pb-8">

        {/* Series scope banner */}
        {seriesId && seriesInfo && (
          <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl bg-brand-green/10 dark:bg-brand-green/20 border border-brand-green/20">
            <Repeat2 size={14} className="text-brand-green shrink-0" />
            <span className="flex-1 text-xs font-semibold text-brand-green truncate">{seriesInfo.name} — Series Stats</span>
            <button onClick={() => navigate(`/players/${id}`, { replace: true })} className="text-brand-green/60 hover:text-brand-green">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tournament filter — only shown when not in series scope */}
        {!seriesId && tournamentOptions.length > 0 && (
          <select
            value={selectedTournament}
            onChange={e => setSelectedTournament(e.target.value)}
            className="field-input w-full mt-4"
          >
            <option value="">All time</option>
            {tournamentOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {/* Badges */}
        <div className={tournamentOptions.length > 0 ? '' : 'mt-4'}>
          <PlayerBadges stats={careerStats || empty} duckHunterCount={duckHunterCount} allStats={allStats} />
        </div>

        {/* Segmented tabs */}
        <div className="grid grid-cols-5 bg-ink-100 dark:bg-white/10 rounded-xl p-1">
          {TAB_LABELS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                tab === i
                  ? 'bg-white dark:bg-ink-800 text-brand-green shadow-sm'
                  : 'text-ink-500 dark:text-ink-300 hover:text-ink-700 dark:hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Batting ── */}
        {tab === 0 && (
          <div className="space-y-3">
            <StatSection>
              <StatRow label="Innings"      value={s.bat_innings} />
              <StatRow label="Not outs"     value={s.bat_not_outs} />
              <StatRow label="Average"      value={batAvg}  highlight />
              <StatRow label="Strike rate"  value={batSR}   highlight />
              <StatRow label="Highest score" value={s.bat_highest_score} />
              <StatRow label="30s / 50s / 100s" value={`${s.bat_thirties} / ${s.bat_fifties} / ${s.bat_hundreds}`} />
              <StatRow label="Fours"        value={s.bat_fours} />
              <StatRow label="Sixes"        value={s.bat_sixes} />
              <StatRow label="Dot balls"    value={s.bat_dot_balls} />
              <StatRow label="Ducks"        value={s.bat_ducks} />
            </StatSection>
            <FormSparkline history={history} />
            <RunTypeChart stats={s} />
          </div>
        )}

        {/* ── Bowling ── */}
        {tab === 1 && (
          <div className="space-y-3">
            <StatSection>
              <StatRow label="Overs"        value={overs} />
              <StatRow label="Wickets"      value={s.bowl_wickets} highlight />
              <StatRow label="Average"      value={bowlAvg} highlight />
              <StatRow label="Economy"      value={bowlEco} />
              <StatRow label="Strike rate"  value={bowlSR} />
              <StatRow label="Best figures" value={best} />
              <StatRow label="Maidens"      value={s.bowl_maidens} />
              <StatRow label="4-fers"       value={s.bowl_four_wicket_hauls} />
              <StatRow label="5-fers"       value={s.bowl_five_wicket_hauls} />
            </StatSection>
            <WicketTypeDonut counts={wicketCounts} />
          </div>
        )}

        {/* ── Fielding ── */}
        {tab === 2 && (
          <StatSection>
            <StatRow label="Catches"    value={s.field_catches} highlight />
            <StatRow label="Stumpings" value={s.field_stumpings} />
            <StatRow label="Run outs"  value={s.field_run_outs} />
          </StatSection>
        )}

        {/* ── Match History ── */}
        {tab === 3 && <MatchHistoryTable history={seriesId ? (seriesHistory || []) : history} />}

        {/* ── H2H ── */}
        {tab === 4 && <HeadToHeadPanel batsmanId={id} inningsIds={seriesInningsIds} />}
      </div>
    </div>
  );
}

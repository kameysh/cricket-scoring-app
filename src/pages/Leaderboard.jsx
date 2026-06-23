import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronUp, ChevronDown, Activity, X, Sparkles, Repeat2, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as playerService from '../services/playerService';
import * as seriesService from '../services/seriesService';
import { getTopPartnerships } from '../services/partnershipService';
import PlayerAvatar from '../components/player/PlayerAvatar';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import { displayName } from '../lib/cricketUtils';
import EmptyState from '../components/shared/EmptyState';

// ── MVP score formula ─────────────────────────────────────────────────────────
function calcMvpScore(s) {
  return (
    (s.bat_runs || 0) * 0.5 +
    (s.bowl_wickets || 0) * 20 +
    (s.bat_fours || 0) * 1 +
    (s.bat_sixes || 0) * 2 +
    (s.bat_thirties || 0) * 5 +
    (s.bat_fifties || 0) * 10 +
    (s.bat_hundreds || 0) * 25 +
    (s.field_catches || 0) * 5 +
    (s.field_stumpings || 0) * 5 +
    (s.field_run_outs || 0) * 3
  );
}

// ── Stat helpers ──────────────────────────────────────────────────────────────
const batAvg   = s => { const o = (s.bat_innings||0)-(s.bat_not_outs||0); return o>0 ? s.bat_runs/o : (s.bat_runs>0 ? 999 : 0); };
const batSR    = s => s.bat_balls>0 ? (s.bat_runs/s.bat_balls)*100 : 0;
const bowlAvg  = s => s.bowl_wickets>0 ? s.bowl_runs/s.bowl_wickets : Infinity;
const bowlEcon = s => s.bowl_legal_balls>0 ? (s.bowl_runs/s.bowl_legal_balls)*6 : Infinity;
const overs    = s => `${Math.floor((s.bowl_legal_balls||0)/6)}.${(s.bowl_legal_balls||0)%6}`;
const bb       = s => s.bowl_best_wickets!=null ? `${s.bowl_best_wickets}/${s.bowl_best_runs}` : '—';
const fmt      = (v, dec=2) => v===Infinity||v===999||v==null ? '—' : Number(v).toFixed(dec);

// ── Sort helpers ──────────────────────────────────────────────────────────────
const SORTS = {
  mvp: {
    default: (a, b) => calcMvpScore(b) - calcMvpScore(a),
    mvp_score: (a, b) => calcMvpScore(b) - calcMvpScore(a),
    bat_runs: (a, b) => (b.bat_runs || 0) - (a.bat_runs || 0),
    bowl_wickets: (a, b) => (b.bowl_wickets || 0) - (a.bowl_wickets || 0),
  },
  batting: {
    default: (a,b) => b.bat_runs-a.bat_runs || batAvg(b)-batAvg(a) || batSR(b)-batSR(a),
    bat_runs:    (a,b) => b.bat_runs-a.bat_runs,
    bat_innings: (a,b) => b.bat_innings-a.bat_innings,
    bat_matches: (a,b) => (b.matches_played??b.bat_matches??0)-(a.matches_played??a.bat_matches??0),
    avg:         (a,b) => batAvg(b)-batAvg(a),
    sr:          (a,b) => batSR(b)-batSR(a),
    bat_highest_score: (a,b) => (b.bat_highest_score||0)-(a.bat_highest_score||0),
    bat_fours:   (a,b) => (b.bat_fours||0)-(a.bat_fours||0),
    bat_sixes:   (a,b) => (b.bat_sixes||0)-(a.bat_sixes||0),
  },
  bowling: {
    default: (a,b) => b.bowl_wickets-a.bowl_wickets || bowlAvg(a)-bowlAvg(b) || bowlEcon(a)-bowlEcon(b),
    bowl_wickets: (a,b) => b.bowl_wickets-a.bowl_wickets,
    bowl_matches: (a,b) => (b.matches_played??b.bowl_matches??0)-(a.matches_played??a.bowl_matches??0),
    bowl_runs:    (a,b) => b.bowl_runs-a.bowl_runs,
    avg:          (a,b) => bowlAvg(a)-bowlAvg(b),
    econ:         (a,b) => bowlEcon(a)-bowlEcon(b),
  },
};

const MVP_FORMULA = [
  { icon: '🏏', label: 'Run scored',    pts: '+0.5 pts each',  note: '100 runs = 50 pts' },
  { icon: '🎳', label: 'Wicket taken',  pts: '+20 pts each',   note: '5 wickets = 100 pts' },
  { icon: '4️⃣', label: 'Four hit',      pts: '+1 pt each',     note: 'boundary bonus' },
  { icon: '6️⃣', label: 'Six hit',       pts: '+2 pts each',    note: 'big hit bonus' },
  { icon: '🎯', label: '30',            pts: '+5 pts',         note: '30–49 in an innings' },
  { icon: '⭐', label: 'Half-century',  pts: '+10 pts',        note: '50+ in an innings' },
  { icon: '💯', label: 'Century',       pts: '+25 pts',        note: '100+ in an innings' },
  { icon: '🧤', label: 'Catch',         pts: '+5 pts each',    note: 'fielding credit' },
  { icon: '🥅', label: 'Stumping',      pts: '+5 pts each',    note: 'keeper credit' },
  { icon: '🏃', label: 'Run out',       pts: '+3 pts each',    note: 'direct or assisted' },
];

function MvpFormulaModal({ onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-green to-brand-teal px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-white/80" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-widest">How it works</span>
              </div>
              <h2 className="text-white text-lg font-bold leading-tight">MVP Score Formula</h2>
              <p className="text-white/70 text-xs mt-1">Every action on the field earns points. The player with the highest total is crowned MVP.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors shrink-0 mt-0.5"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Formula rows */}
        <div className="px-5 py-4 space-y-1">
          {MVP_FORMULA.map(row => (
            <div key={row.label} className="flex items-center gap-3 py-2 border-b border-ink-50 dark:border-white/5 last:border-0">
              <span className="text-xl w-7 text-center shrink-0">{row.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-ink-900 dark:text-white">{row.label}</p>
                <p className="text-[11px] text-ink-400">{row.note}</p>
              </div>
              <span className="text-xs font-bold text-brand-green whitespace-nowrap">{row.pts}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <div className="bg-ink-50 dark:bg-white/5 rounded-xl px-4 py-3">
            <p className="text-[11px] text-ink-500 dark:text-ink-400 text-center leading-relaxed">
              MVP score accumulates across <span className="font-semibold text-ink-700 dark:text-ink-200">all matches</span> — not just a single game. Consistent all-round performers rise to the top.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const RANK_STYLES = [
  'bg-yellow-400 text-yellow-900',   // 1st
  'bg-gray-300 text-gray-800',       // 2nd
  'bg-amber-600 text-white',         // 3rd
];

function RankBadge({ rank }) {
  const style = rank <= 3 ? RANK_STYLES[rank-1] : 'bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-400';
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 ${style}`}>
      {rank}
    </span>
  );
}

function SortHeader({ label, sortKey, active, dir, onSort, className = '' }) {
  return (
    <th
      className={`px-2 py-2.5 text-right text-[10px] font-semibold text-ink-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        {active && (dir === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>)}
      </span>
    </th>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [careerStats, setCareerStats] = useState([]);
  const [stats, setStats]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('batting');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [liveMatch, setLiveMatch] = useState(false);
  const [mvpFormulaOpen, setMvpFormulaOpen] = useState(false);
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [partnerships, setPartnerships] = useState([]);
  const [partnershipsLoaded, setPartnershipsLoaded] = useState(false);

  useEffect(() => {
    // Initial load — single query, all counters from player_career_stats
    playerService.getAllCareerStats()
      .then(data => { setCareerStats(data); setStats(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Check for live match (one-shot)
    supabase.from('matches').select('id').eq('status', 'in_progress').limit(1)
      .then(({ data }) => setLiveMatch((data||[]).length > 0));

    // Load series for filter dropdown
    seriesService.listSeries().then(setSeriesList).catch(() => {});

    // Realtime: refresh career stats when innings completed (only when not in series view)
    const channel = supabase
      .channel('leaderboard:career_stats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_career_stats' },
        () => { if (!selectedSeries) playerService.getAllCareerStats().then(data => { setCareerStats(data); setStats(data); }); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // When series filter changes, load series-aggregated stats
  useEffect(() => {
    if (!selectedSeries) {
      setStats(careerStats);
      setSeriesName('');
      return;
    }
    setSeriesLoading(true);
    seriesService.getSeriesPlayerStats(selectedSeries)
      .then(data => {
        setStats(data);
        setSeriesName(seriesList.find(s => s.id === selectedSeries)?.name || '');
      })
      .catch(() => {})
      .finally(() => setSeriesLoading(false));
  }, [selectedSeries, careerStats]);

  // Lazy-load partnerships when tab is first opened
  useEffect(() => {
    if (tab !== 'partnerships' || partnershipsLoaded) return;
    getTopPartnerships(20)
      .then(data => { setPartnerships(data); setPartnershipsLoaded(true); })
      .catch(() => setPartnershipsLoaded(true));
  }, [tab, partnershipsLoaded]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function resetSort() { setSortKey(null); setSortDir('desc'); }
  useEffect(() => { setSortKey(null); setSortDir('desc'); }, [tab]);

  // ── Derive rows per tab ───────────────────────────────────────────────────
  const sorter = key => {
    const fns = SORTS[tab];
    if (!fns) return () => 0;
    const fn  = (key && fns[key]) ? fns[key] : fns.default;
    return sortDir === 'asc' ? (a,b) => fn(b,a) : fn;
  };

  const battingRows = stats
    .filter(s => (s.bat_innings||0) > 0)
    .sort(sorter(sortKey));

  const bowlingRows = stats
    .filter(s => (s.bowl_legal_balls||0) > 0)
    .sort(sorter(sortKey));

  const mvpRows = stats
    .filter(s => (s.bat_matches||0) >= 1)
    .map(s => ({ ...s, _mvp: calcMvpScore(s) }))
    .sort(sorter(sortKey));

  const rows = tab === 'batting' ? battingRows : tab === 'bowling' ? bowlingRows : mvpRows;

  const sh = (label, key, cls) => (
    <SortHeader
      label={label} sortKey={key} active={sortKey===key} dir={sortDir}
      onSort={handleSort} className={cls}
    />
  );

  const totalM   = row => row.matches_played ?? row.bat_matches ?? 0;

  const stickyBg = 'bg-white dark:bg-ink-900';

  const rankCell = rank => (
    <td className={`sticky left-0 z-10 ${stickyBg} px-2 py-2.5 w-10`}>
      <RankBadge rank={rank} />
    </td>
  );

  const playerCell = row => (
    <td className={`sticky left-10 z-10 ${stickyBg} px-2 py-2.5 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]`}>
      <button
        onClick={() => navigate(`/players/${row.players?.id}${selectedSeries ? `?series=${selectedSeries}` : ''}`)}
        className="flex items-center gap-2 text-left"
      >
        <PlayerAvatar name={row.players?.name} photoUrl={row.players?.photo_url} size={28} />
        <span className="text-xs font-semibold text-ink-900 dark:text-white truncate" style={{ maxWidth: '80px' }}>
          {displayName(row.players) || '—'}
        </span>
      </button>
    </td>
  );

  return (
    <div className="p-4 space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy size={20} className="text-brand-green shrink-0" />
        <h1 className="text-xl font-bold text-ink-900 dark:text-white flex-1">Leaderboard</h1>
        {liveMatch && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-green">
            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'batting', label: 'Batting' },
          { key: 'bowling', label: 'Bowling' },
          { key: 'mvp', label: '🏆 MVP' },
          { key: 'partnerships', label: '🤝 Partnerships' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
                : 'bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Series filter */}
      {seriesList.length > 0 && (
        <div className="flex items-center gap-2 -mt-1">
          <Repeat2 size={14} className="text-ink-400 shrink-0" />
          <select
            value={selectedSeries}
            onChange={e => { setSelectedSeries(e.target.value); setSortKey(null); setSortDir('desc'); }}
            className="flex-1 text-xs rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
          >
            <option value="">All time (Career)</option>
            {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedSeries && (
            <button onClick={() => setSelectedSeries('')} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/10">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {selectedSeries && seriesName && (
        <p className="text-[11px] text-brand-green font-medium -mt-1">
          Showing stats for <strong>{seriesName}</strong> — tap a player to view their series profile
        </p>
      )}

      {tab === 'mvp' && (
        <div className="flex items-center justify-end -mt-2">
          <button
            type="button"
            onClick={() => setMvpFormulaOpen(true)}
            className="flex items-center gap-1 text-xs text-brand-green font-medium hover:underline underline-offset-2"
          >
            <Sparkles size={12} />
            How is MVP calculated?
          </button>
        </div>
      )}

      {mvpFormulaOpen && <MvpFormulaModal onClose={() => setMvpFormulaOpen(false)} />}

      {tab === 'partnerships' ? (
        (loading || !partnershipsLoaded) ? (
          <LoadingSkeleton rows={6} />
        ) : partnerships.length === 0 ? (
          <EmptyState icon={Link2} title="No partnerships yet" message="Partnership records appear once matches are played." />
        ) : (
          <div className="space-y-2">
            {partnerships.map((p, i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <RankBadge rank={i + 1} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900 dark:text-white truncate">{displayName(p.player1) || '—'}</span>
                    <Link2 size={12} className="text-ink-300 shrink-0" />
                    <span className="text-sm font-semibold text-ink-900 dark:text-white truncate">{displayName(p.player2) || 'Unrecorded'}</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5 truncate">
                    {p.team1} vs {p.team2} · {p.broken ? 'Broken' : 'Unbroken'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{p.runs}</p>
                  <p className="text-xs text-ink-400 tabular-nums">{p.balls}b</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (loading || seriesLoading) ? (
        <LoadingSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Activity} title="No stats yet" message="Stats appear here once matches are played and innings are completed." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
          <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            {/* ── Batting ── */}
            {tab === 'batting' && (
              <>
                <thead>
                  <tr className="border-b border-ink-100 dark:border-white/10">
                    <th className={`sticky left-0 z-20 ${stickyBg} px-2 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide w-10`}>#</th>
                    <th className={`sticky left-10 z-20 ${stickyBg} px-2 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]`}>Player</th>
                    {sh('M',    'bat_matches', '')}
                    {sh('Inns', 'bat_innings', '')}
                    {sh('Runs', 'bat_runs',    '')}
                    {sh('HS',   'bat_highest_score', '')}
                    {sh('Avg',  'avg',          '')}
                    {sh('SR',   'sr',           '')}
                    {sh('4s',   'bat_fours',    '')}
                    {sh('6s',   'bat_sixes',    '')}
                  </tr>
                </thead>
                <tbody>
                  {battingRows.map((row, i) => (
                    <tr key={row.player_id} className="border-b border-ink-50 dark:border-white/5 last:border-0 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                      {rankCell(i+1)}
                      {playerCell(row)}
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{totalM(row)}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{row.bat_innings || 0}</td>
                      <td className="px-2 py-2.5 text-right text-xs font-bold text-ink-900 dark:text-white tabular-nums whitespace-nowrap">{row.bat_runs||0}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">
                        {row.bat_highest_score != null ? `${row.bat_highest_score}${row.bat_highest_score_not_out ? '*' : ''}` : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{fmt(batAvg(row))}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{fmt(batSR(row))}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{row.bat_fours||0}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap pr-4">{row.bat_sixes||0}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* ── Bowling ── */}
            {tab === 'bowling' && (
              <>
                <thead>
                  <tr className="border-b border-ink-100 dark:border-white/10">
                    <th className={`sticky left-0 z-20 ${stickyBg} px-2 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide w-10`}>#</th>
                    <th className={`sticky left-10 z-20 ${stickyBg} px-2 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]`}>Player</th>
                    {sh('M',    'bowl_matches',  '')}
                    {sh('W',    'bowl_wickets',  '')}
                    {sh('Ovrs', null,            '')}
                    {sh('Runs', 'bowl_runs',     '')}
                    {sh('Avg',  'avg',            '')}
                    {sh('Econ', 'econ',           '')}
                    {sh('BB',   null,             '')}
                  </tr>
                </thead>
                <tbody>
                  {bowlingRows.map((row, i) => (
                    <tr key={row.player_id} className="border-b border-ink-50 dark:border-white/5 last:border-0 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                      {rankCell(i+1)}
                      {playerCell(row)}
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{totalM(row)}</td>
                      <td className="px-2 py-2.5 text-right text-xs font-bold text-ink-900 dark:text-white tabular-nums whitespace-nowrap">{row.bowl_wickets||0}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{overs(row)}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{row.bowl_runs||0}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{fmt(bowlAvg(row))}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap">{fmt(bowlEcon(row))}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300 tabular-nums whitespace-nowrap pr-4">{bb(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* ── MVP ── */}
            {tab === 'mvp' && (
              <>
                <thead>
                  <tr className="border-b border-ink-100 dark:border-white/10">
                    <th className={`sticky left-0 z-20 ${stickyBg} px-2 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide w-10`}>#</th>
                    <th className={`sticky left-10 z-20 ${stickyBg} px-2 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]`}>Player</th>
                    {sh('Score', 'mvp_score', '')}
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap">Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {mvpRows.map((row, i) => (
                    <tr key={row.player_id} className="border-b border-ink-50 dark:border-white/5 last:border-0 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                      {rankCell(i+1)}
                      {playerCell(row)}
                      <td className="px-2 py-2.5 text-right text-xs font-bold text-ink-900 dark:text-white tabular-nums whitespace-nowrap">{row._mvp.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap pr-4">
                        {[
                          row.bat_runs > 0 && `${row.bat_runs}R`,
                          row.bowl_wickets > 0 && `${row.bowl_wickets}W`,
                          row.bat_sixes > 0 && `${row.bat_sixes}×6`,
                        ].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

          </table>
          </div>
        </div>
      )}
    </div>
  );
}

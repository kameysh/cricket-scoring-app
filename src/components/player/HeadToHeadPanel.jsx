import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getHeadToHeadAll, getBowlingHeadToHeadAll } from '../../services/playerService';
import { fmt } from '../../lib/cricketUtils';
import LoadingSkeleton from '../shared/LoadingSkeleton';

function StatCard({ label, value }) {
  return (
    <div className="bg-ink-50 dark:bg-white/5 rounded-xl p-3 text-center">
      <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-bold text-ink-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function HeadToHeadPanel({ batsmanId, inningsIds }) {
  const playerId = batsmanId; // this panel covers the player both as batsman and bowler
  const [batRows, setBatRows] = useState([]);
  const [bowlRows, setBowlRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('bat'); // 'bat' = vs bowlers, 'bowl' = vs batsmen
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    Promise.all([
      getHeadToHeadAll(playerId, inningsIds).catch(() => []),
      getBowlingHeadToHeadAll(playerId, inningsIds).catch(() => []),
    ])
      .then(([bat, bowl]) => { setBatRows(bat); setBowlRows(bowl); })
      .finally(() => setLoading(false));
  }, [playerId, inningsIds]);

  // Default to whichever side has data (a pure bowler opens on Bowling)
  useEffect(() => {
    if (!loading) setMode(batRows.length ? 'bat' : (bowlRows.length ? 'bowl' : 'bat'));
  }, [loading, batRows.length, bowlRows.length]);

  if (loading) return <LoadingSkeleton rows={4} />;

  if (batRows.length === 0 && bowlRows.length === 0) {
    return <p className="text-sm text-ink-400 text-center py-8">No head-to-head data available</p>;
  }

  // ── Detail drill-down ──────────────────────────────────────────────────────
  if (selected) {
    const e = selected;
    const isBat = mode === 'bat';
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white">
          <ChevronLeft size={16} /> {isBat ? 'All bowlers' : 'All batsmen'}
        </button>
        <div>
          <p className="text-xs text-ink-400 uppercase tracking-wide mb-0.5">vs</p>
          <p className="text-base font-bold text-ink-900 dark:text-white">{isBat ? e.bowlerName : e.batsmanName}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Balls" value={e.balls} />
          <StatCard label="Runs" value={e.runs} />
          {isBat
            ? <StatCard label="Dismissed" value={e.dismissals} />
            : <StatCard label="Wickets" value={e.wickets} />}
          {isBat
            ? <StatCard label="SR" value={e.balls > 0 ? fmt(e.sr, 1) : '—'} />
            : <StatCard label="Econ" value={e.balls > 0 ? fmt(e.econ, 1) : '—'} />}
          <StatCard label="Dot %" value={e.balls > 0 ? `${fmt(e.dotPct, 0)}%` : '—'} />
          <StatCard label="4s / 6s" value={`${e.fours} / ${e.sixes}`} />
        </div>
      </div>
    );
  }

  const rows = mode === 'bat' ? batRows : bowlRows;

  return (
    <div className="space-y-3">
      {/* Batting / Bowling toggle */}
      <div className="flex gap-2">
        {[
          { key: 'bat', label: 'vs Bowlers', count: batRows.length },
          { key: 'bowl', label: 'vs Batsmen', count: bowlRows.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setMode(t.key); setSelected(null); }}
            disabled={t.count === 0}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 ${
              mode === t.key ? 'bg-brand-green text-white' : 'bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-400 text-center py-8">
          No {mode === 'bat' ? 'batting' : 'bowling'} head-to-head data
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 px-3 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-white/10">
            <span className="col-span-2">{mode === 'bat' ? 'Bowler' : 'Batsman'}</span>
            <span className="text-right">B</span>
            <span className="text-right">R</span>
            <span className="text-right">{mode === 'bat' ? 'Dis' : 'W'}</span>
          </div>
          {rows.map(e => (
            <button
              key={mode === 'bat' ? e.bowlerId : e.batsmanId}
              onClick={() => setSelected(e)}
              className="w-full grid grid-cols-5 px-3 py-2.5 text-xs card hover:bg-ink-50 dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="col-span-2 font-medium text-ink-800 dark:text-ink-100 truncate">{mode === 'bat' ? e.bowlerName : e.batsmanName}</span>
              <span className="text-right tabular-nums text-ink-600 dark:text-ink-300">{e.balls}</span>
              <span className="text-right tabular-nums font-semibold text-ink-900 dark:text-white">{e.runs}</span>
              <span className="text-right tabular-nums text-ink-600 dark:text-ink-300">{mode === 'bat' ? e.dismissals : e.wickets}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

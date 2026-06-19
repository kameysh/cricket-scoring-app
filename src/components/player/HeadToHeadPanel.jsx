import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getHeadToHeadAll } from '../../services/playerService';
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

export default function HeadToHeadPanel({ batsmanId }) {
  const [bowlers, setBowlers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    getHeadToHeadAll(batsmanId)
      .then(setBowlers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [batsmanId]);

  if (loading) return <LoadingSkeleton rows={4} />;

  if (bowlers.length === 0) {
    return <p className="text-sm text-ink-400 text-center py-8">No head-to-head data available</p>;
  }

  if (selected) {
    const e = selected;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white">
          <ChevronLeft size={16} /> All bowlers
        </button>
        <div>
          <p className="text-xs text-ink-400 uppercase tracking-wide mb-0.5">vs</p>
          <p className="text-base font-bold text-ink-900 dark:text-white">{e.bowlerName}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Balls" value={e.balls} />
          <StatCard label="Runs" value={e.runs} />
          <StatCard label="Dismissed" value={e.dismissals} />
          <StatCard label="SR" value={e.balls > 0 ? fmt(e.sr, 1) : '—'} />
          <StatCard label="Dot %" value={e.balls > 0 ? `${fmt(e.dotPct, 0)}%` : '—'} />
          <StatCard label="4s / 6s" value={`${e.fours} / ${e.sixes}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 px-3 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-white/10">
        <span className="col-span-2">Bowler</span>
        <span className="text-right">B</span>
        <span className="text-right">R</span>
        <span className="text-right">Dis</span>
      </div>
      {bowlers.map(e => (
        <button
          key={e.bowlerId}
          onClick={() => setSelected(e)}
          className="w-full grid grid-cols-5 px-3 py-2.5 text-xs card hover:bg-ink-50 dark:hover:bg-white/5 transition-colors text-left"
        >
          <span className="col-span-2 font-medium text-ink-800 dark:text-ink-100 truncate">{e.bowlerName}</span>
          <span className="text-right tabular-nums text-ink-600 dark:text-ink-300">{e.balls}</span>
          <span className="text-right tabular-nums font-semibold text-ink-900 dark:text-white">{e.runs}</span>
          <span className="text-right tabular-nums text-ink-600 dark:text-ink-300">{e.dismissals}</span>
        </button>
      ))}
    </div>
  );
}

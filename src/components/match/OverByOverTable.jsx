import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

function ballToken(d) {
  if (d.is_wicket) return 'W';
  if (d.extra_type === 'wide') return `Wd${(d.extra_runs || 0) > 1 ? `+${d.extra_runs - 1}` : ''}`;
  if (d.extra_type === 'no_ball') return `Nb${(d.runs_off_bat || 0) > 0 ? `+${d.runs_off_bat}` : ''}`;
  if (d.extra_type === 'bye') return `B${d.extra_runs || 0}`;
  if (d.extra_type === 'leg_bye') return `Lb${d.extra_runs || 0}`;
  return String(d.runs_off_bat || 0);
}

export default function OverByOverTable({ deliveries, playersMap }) {
  const [open, setOpen] = useState(false);

  if (!deliveries?.length) return null;

  // Group by over_number
  const overMap = new Map();
  for (const d of deliveries) {
    const over = d.over_number ?? 0;
    if (!overMap.has(over)) overMap.set(over, []);
    overMap.get(over).push(d);
  }

  const overs = [...overMap.entries()].sort((a, b) => a[0] - b[0]).map(([overNum, balls]) => {
    const runs = balls.reduce((s, d) => s + (d.total_runs_on_delivery ?? 0), 0);
    const wickets = balls.filter(d => d.is_wicket).length;
    const legalBalls = balls.filter(d => d.is_legal_delivery);
    const bowlerId = legalBalls[0]?.bowler_id;
    const bowlerName = bowlerId ? (playersMap?.[bowlerId]?.name || 'Unknown') : '—';
    const tokens = balls.map(ballToken).join('  ');
    return { overNum, runs, wickets, bowlerName, tokens };
  });

  return (
    <div className="card p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full"
      >
        <span className="text-sm font-semibold text-ink-900 dark:text-white">
          📊 Over by Over
        </span>
        {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr className="border-b border-ink-100 dark:border-white/10">
                <th className="py-1.5 pr-2 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap">Ov</th>
                <th className="py-1.5 px-2 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap">Bowler</th>
                <th className="py-1.5 px-2 text-center text-[10px] font-semibold text-ink-400 uppercase tracking-wide">R</th>
                <th className="py-1.5 px-2 text-center text-[10px] font-semibold text-ink-400 uppercase tracking-wide">W</th>
                <th className="py-1.5 pl-2 text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Balls</th>
              </tr>
            </thead>
            <tbody>
              {overs.map(({ overNum, runs, wickets, bowlerName, tokens }) => (
                <tr key={overNum} className="border-b border-ink-50 dark:border-white/5 last:border-0">
                  <td className="py-1.5 pr-2 font-semibold text-ink-600 dark:text-ink-300">{overNum + 1}</td>
                  <td className="py-1.5 px-2 text-ink-700 dark:text-ink-200 whitespace-nowrap max-w-[80px] truncate">{bowlerName}</td>
                  <td className={`py-1.5 px-2 text-center font-bold tabular-nums ${wickets > 0 ? 'text-red-500' : runs >= 10 ? 'text-brand-green' : 'text-ink-600 dark:text-ink-300'}`}>{runs}</td>
                  <td className="py-1.5 px-2 text-center tabular-nums text-ink-600 dark:text-ink-300">{wickets || '—'}</td>
                  <td className="py-1.5 pl-2 font-mono text-ink-500 dark:text-ink-400 whitespace-nowrap">{tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
